"""
Web Push - VAPID configuration, notification payloads and delivery.

Never log VAPID keys, subscription endpoints or their keys: an endpoint is a
capability to push to a user's browser.
"""

import json
import logging
import os
from datetime import UTC, datetime

import requests
from pywebpush import WebPushException, webpush
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.push_subscription import PushSubscription
from models.todo import Todo
from models.user import User
from services.email_service import get_text
from services.push_endpoints import is_allowed_push_endpoint

logger = logging.getLogger(__name__)

NOTIFICATION_ICON = "/icons/icon-192.png"
NOTIFICATION_URL = "/todos"
MAX_TITLE_LENGTH = 100
# The push service gives up delivering after this many seconds.
PUSH_TTL_SECONDS = 3600
PUSH_TIMEOUT_SECONDS = 10
# Answers of a push service meaning the subscription no longer exists.
GONE_STATUS_CODES = (404, 410)
MINUTES_PER_DAY = 1440
MAX_PUSH_SUBSCRIPTIONS_PER_USER = 20


def vapid_public_key() -> str | None:
    """The public VAPID key browsers subscribe with, if configured."""
    return os.getenv("VAPID_PUBLIC_KEY") or None


def vapid_private_key() -> str | None:
    """The private VAPID key used to sign pushes, if configured."""
    return os.getenv("VAPID_PRIVATE_KEY") or None


def vapid_subject() -> str:
    """Contact the push services may use: VAPID_SUBJECT or mailto: EMAIL_FROM."""
    return os.getenv("VAPID_SUBJECT") or (
        "mailto:" + os.getenv("EMAIL_FROM", "noreply@example.com")
    )


def push_enabled() -> bool:
    """Whether both VAPID keys are configured (otherwise push is switched off)."""
    return bool(vapid_public_key() and vapid_private_key())


def no_redirect_session() -> requests.Session:
    """A session that fails on a redirect instead of following it (SSRF guard)."""
    session = requests.Session()
    session.max_redirects = 0
    return session


def webpush_send(subscription_info: dict, data: str) -> None:
    """
    Send one encrypted push message. The only caller of pywebpush.webpush.

    Args:
        subscription_info: {"endpoint": ..., "keys": {"p256dh": ..., "auth": ...}}.
        data: The message body (JSON text).

    Raises:
        WebPushException: If the push service rejects the message.
    """
    webpush(
        subscription_info=subscription_info,
        requests_session=no_redirect_session(),
        data=data,
        vapid_private_key=vapid_private_key(),
        vapid_claims={"sub": vapid_subject()},
        ttl=PUSH_TTL_SECONDS,
        timeout=PUSH_TIMEOUT_SECONDS,
    )


def notification_payload(title: str, body: str, tag: str | None = None) -> dict:
    """
    Build a notification in the Angular service worker (ngsw) push format.

    Args:
        title: Notification title.
        body: Notification text.
        tag: Replaces an earlier notification with the same tag.

    Returns:
        dict: {"notification": {...}} ready to be JSON-encoded.
    """
    notification: dict = {
        "title": title,
        "body": body,
        "icon": NOTIFICATION_ICON,
        "badge": NOTIFICATION_ICON,
        "data": {
            "onActionClick": {
                "default": {
                    "operation": "navigateLastFocusedOrOpen",
                    "url": NOTIFICATION_URL,
                }
            }
        },
    }
    if tag:
        notification["tag"] = tag
    return {"notification": notification}


def reminder_body(todo: Todo, language: str) -> str:
    """Text under a reminder's title: the due time, or today / tomorrow."""
    if todo.due_time is not None:
        return get_text(
            language, "push", "due_at", time=todo.due_time.strftime("%H:%M")
        )
    if (todo.reminder_offset_minutes or 0) >= MINUTES_PER_DAY:
        return get_text(language, "push", "due_tomorrow")
    return get_text(language, "push", "due_today")


def reminder_payload(todo: Todo, user: User) -> dict:
    """
    Notification for a todo's reminder, in the user's language.

    Args:
        todo: The todo being reminded about.
        user: Its owner.

    Returns:
        dict: Payload in the ngsw format, tagged todo-<id>.
    """
    return notification_payload(
        title=todo.title[:MAX_TITLE_LENGTH],
        body=reminder_body(todo, user.language),
        tag=f"todo-{todo.id}",
    )


def _status_code(error: WebPushException) -> int | None:
    return getattr(getattr(error, "response", None), "status_code", None)


def send_to_user(db: Session, user: User, payload: dict) -> int:
    """
    Push a notification to every browser the user has subscribed.

    Subscriptions the push service reports as gone (404/410) are deleted; other
    failures are logged without the endpoint and the subscription is kept.

    Args:
        db: Database session.
        user: The recipient.
        payload: Notification payload (see notification_payload).

    Returns:
        int: Number of browsers the message was delivered to.
    """
    rows = [
        (s.id, s.endpoint, s.p256dh, s.auth)
        for s in db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id)
        .all()
    ]
    # End the read transaction: no database transaction stays open (holding
    # locks) while we wait on push services.
    db.commit()
    data = json.dumps(payload)
    delivered_ids: list[int] = []
    gone_ids: list[int] = []
    for subscription_id, endpoint, p256dh, auth in rows:
        if not is_allowed_push_endpoint(endpoint):
            logger.warning(
                "Skipping subscription %s: endpoint not on a known push service",
                subscription_id,
            )
            continue
        info = {"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}}
        try:
            webpush_send(info, data)
        except WebPushException as error:
            status_code = _status_code(error)
            if status_code in GONE_STATUS_CODES:
                gone_ids.append(subscription_id)
            else:
                logger.warning(
                    "Push failed for subscription %s (status %s)",
                    subscription_id,
                    status_code,
                )
        except Exception as error:  # noqa: BLE001 - one bad browser must not stop the rest
            logger.warning(
                "Push failed for subscription %s (%s)",
                subscription_id,
                type(error).__name__,
            )
        else:
            delivered_ids.append(subscription_id)
    if delivered_ids or gone_ids:
        if gone_ids:
            db.query(PushSubscription).filter(PushSubscription.id.in_(gone_ids)).delete(
                synchronize_session=False
            )
        if delivered_ids:
            db.query(PushSubscription).filter(
                PushSubscription.id.in_(delivered_ids)
            ).update({"last_used_at": datetime.now(UTC)}, synchronize_session=False)
        db.commit()
    return len(delivered_ids)


def _find_by_endpoint(db: Session, endpoint: str) -> PushSubscription | None:
    return (
        db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    )


def _make_room(db: Session, user_id: int) -> None:
    """Delete the user's oldest subscriptions so one more fits under the cap."""
    stale = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user_id)
        .order_by(
            PushSubscription.last_used_at.asc().nulls_first(),
            PushSubscription.created_at.asc(),
        )
        .all()
    )
    for subscription in stale[
        : max(0, len(stale) - MAX_PUSH_SUBSCRIPTIONS_PER_USER + 1)
    ]:
        db.delete(subscription)


def store_subscription(
    db: Session,
    user_id: int,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str | None,
) -> bool:
    """
    Create the subscription, or move an existing endpoint to the user.

    Keeps at most MAX_PUSH_SUBSCRIPTIONS_PER_USER per user (the oldest go). A
    concurrent insert of the same endpoint is retried once as an update.

    Returns:
        bool: True if a row was created, False if an existing one was updated.
    """
    for attempt in range(2):
        existing = _find_by_endpoint(db, endpoint)
        if existing is None:
            _make_room(db, user_id)
            db.add(
                PushSubscription(
                    user_id=user_id,
                    endpoint=endpoint,
                    p256dh=p256dh,
                    auth=auth,
                    user_agent=user_agent,
                )
            )
            created = True
        else:
            if existing.user_id != user_id:
                _make_room(db, user_id)
            existing.user_id = user_id
            existing.p256dh = p256dh
            existing.auth = auth
            existing.user_agent = user_agent
            created = False
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if attempt == 1:
                raise
            continue
        return created
    raise AssertionError("unreachable")
