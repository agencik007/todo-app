"""
Push routes - Web Push subscriptions and a test notification.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from config.api_messages import ApiMessages, api_error, api_success
from config.auth import get_current_verified_user
from config.database import get_db
from config.rate_limit import create_limiter
from models.push_subscription import PushSubscription
from models.schemas import (
    PushConfig,
    PushResult,
    PushSubscriptionCreate,
    PushSubscriptionDelete,
)
from models.user import User
from routes.todo import suggestion_rate_limit_key
from services import push_service
from services.email_service import get_text

router = APIRouter(prefix="/push", tags=["push"])

USER_AGENT_MAX_LENGTH = 255

limiter = create_limiter(suggestion_rate_limit_key)


def require_push_enabled() -> None:
    """Dependency: answer 503 PUSH_UNAVAILABLE when no VAPID keys are configured."""
    if not push_service.push_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(ApiMessages.PUSH_UNAVAILABLE),
        )


@router.get("/config", response_model=PushConfig)
def get_push_config(
    current_user: User = Depends(get_current_verified_user),
) -> PushConfig:
    """Whether push is available and the public key to subscribe with."""
    enabled = push_service.push_enabled()
    return PushConfig(
        enabled=enabled, public_key=push_service.vapid_public_key() if enabled else None
    )


@router.post(
    "/subscriptions",
    response_model=PushResult,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_push_enabled)],
)
@limiter.limit("20/minute")
def subscribe(
    request: Request,
    response: Response,
    subscription: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> dict:
    """
    Store a browser's push subscription for the current user.

    An endpoint that already exists (e.g. a shared device last used by someone
    else) is moved to the current user and its keys are updated (200).
    """
    endpoint = str(subscription.endpoint)
    user_agent = (
        subscription.user_agent[:USER_AGENT_MAX_LENGTH]
        if subscription.user_agent
        else None
    )
    created = push_service.store_subscription(
        db,
        current_user.id,
        endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        user_agent,
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return api_success(ApiMessages.PUSH_SUBSCRIBED)


@router.delete(
    "/subscriptions", response_model=PushResult, response_model_exclude_none=True
)
def unsubscribe(
    body: PushSubscriptionDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> dict:
    """Remove one of the current user's subscriptions (idempotent)."""
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == str(body.endpoint),
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return api_success(ApiMessages.PUSH_UNSUBSCRIBED)


@router.post(
    "/test",
    response_model=PushResult,
    dependencies=[Depends(require_push_enabled)],
)
@limiter.limit("5/minute")
def send_test_push(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> dict:
    """Send a test notification to every browser the current user subscribed."""
    language = current_user.language
    payload = push_service.notification_payload(
        title=get_text(language, "push", "test_title"),
        body=get_text(language, "push", "test_body"),
        tag="push-test",
    )
    sent = push_service.send_to_user(db, current_user, payload)
    return api_success(ApiMessages.PUSH_TEST_SENT, sent=sent)
