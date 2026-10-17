"""
Email service - Email sending functionality with dual-mode support:
- Development: MailHog (captures emails, no real sending)
- Production: Real SMTP (Brevo / SendGrid / Gmail / etc.)

Controlled by the USE_MAILHOG environment variable (default: true).
"""

import json
import logging
import os
import smtplib
import ssl
from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

logger = logging.getLogger(__name__)

# ── Email sender & frontend ───────────────────────────────────────────────────
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@example.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

# ── Mode switch ───────────────────────────────────────────────────────────────
# Set USE_MAILHOG=false in production to use real SMTP (Brevo etc.)
USE_MAILHOG = os.getenv("USE_MAILHOG", "true").lower() == "true"

# ── MailHog (dev) ─────────────────────────────────────────────────────────────
MAILHOG_HOST = os.getenv("MAILHOG_HOST", "mailhog")
MAILHOG_PORT = int(os.getenv("MAILHOG_PORT", "1025"))

# ── Real SMTP / Brevo (prod) ──────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# Load translations
BASE_DIR = Path(__file__).resolve().parent.parent
I18N_DIR = BASE_DIR / "i18n"


def load_translations() -> dict[str, Any]:
    """Load translation files from i18n directory."""
    translations = {}
    for lang in ["en", "pl"]:
        try:
            file_path = I18N_DIR / f"{lang}.json"
            if file_path.exists():
                with open(file_path, "r", encoding="utf-8") as f:
                    translations[lang] = json.load(f)
            else:
                logger.warning("Translation file not found: %s", file_path)
                translations[lang] = {}
        except Exception:
            logger.exception("Error loading translation for %s", lang)
            translations[lang] = {}
    return translations


TRANSLATIONS = load_translations()


def get_text(lang: str, category: str, key: str, **kwargs) -> str:
    """Get translated text and format it with kwargs."""
    lang = lang if lang in TRANSLATIONS else "en"

    # Try to get text for requested language
    text = TRANSLATIONS.get(lang, {}).get(category, {}).get(key, "")

    # Fallback to English if missing
    if not text and lang != "en":
        text = TRANSLATIONS.get("en", {}).get(category, {}).get(key, "")

    if kwargs:
        try:
            return text.format(**kwargs)
        except KeyError as e:
            logger.warning("Missing format key %s for %s.%s.%s", e, lang, category, key)
            return text
    return text


def _plural_category(lang: str, count: int) -> str:
    """CLDR plural category for an integer count ("one", "few", "many", "other")."""
    if count == 1:
        return "one"
    if lang == "pl":
        if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
            return "few"
        return "many"
    return "other"


def format_hours(lang: str, count: int) -> str:
    """Translated duration, e.g. "1 hour" / "24 godziny"."""
    lang = lang if lang in TRANSLATIONS else "en"
    forms = TRANSLATIONS[lang]["units"]["hours"]
    return forms[_plural_category(lang, count)].format(count=count)


# ── Templates ─────────────────────────────────────────────────────────────────
# Jinja2 templates in templates/email/: <name>.html (extends base.html) and
# <name>.txt (extends base.txt), texts in i18n/<lang>.json under "<name>".
TEMPLATES = Environment(
    loader=FileSystemLoader(BASE_DIR / "templates" / "email"),
    autoescape=select_autoescape(["html"]),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

# The app's dark theme (PrimeNG Aura, "Ocean Depth" cyan palette). Emails are
# dark only and always use this palette, whatever the user picked in the app.
EMAIL_COLORS = {
    "bg": "#09090b",  # surface-950
    "card": "#18181b",  # surface-900
    "border": "#27272a",  # surface-800
    "text": "#fafafa",  # surface-0
    "muted": "#a1a1aa",  # surface-400
    "primary": "#22d3ee",  # cyan-400, dark primary
    "primary_contrast": "#18181b",
    "primary_from": "#06b6d4",  # cyan-500, app icon gradient
    "primary_to": "#0e7490",  # cyan-700
    "notice_bg": "#0b2329",
    "glow": "#0c2a31",
}
EMAIL_FONT = (
    "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"
)


def render_email(
    template: str, language: str, to_email: str, **params: Any
) -> tuple[str, str, str]:
    """
    Render an email in the given language.

    `params` fill the {placeholders} of the template's texts and are also
    available in the template itself (e.g. `action_url`).

    Returns:
        (subject, html, text)
    """
    lang = language if language in TRANSLATIONS else "en"
    texts = {
        key: get_text(lang, template, key, **params)
        for key in TRANSLATIONS["en"][template]
    }
    common = {
        key: get_text(lang, "common", key, email=to_email, year=datetime.now(UTC).year)
        for key in TRANSLATIONS["en"]["common"]
    }
    context = {
        **params,
        "lang": lang,
        "t": texts,
        "common": common,
        "c": EMAIL_COLORS,
        "font": EMAIL_FONT,
        "frontend_url": FRONTEND_URL,
        "logo_url": f"{FRONTEND_URL}/icons/icon-192.png",
    }
    html = TEMPLATES.get_template(f"{template}.html").render(context)
    text = TEMPLATES.get_template(f"{template}.txt").render(context)
    return texts["subject"], html, text


def _mask_email(email: str) -> str:
    """Mask an email address for logging, e.g. 'j***@example.com'."""
    local, _, domain = email.partition("@")
    if not domain:
        return "***"
    return f"{local[:1] or '*'}***@{domain}"


def send_email(
    to_email: str, subject: str, html_content: str, text_content: str | None = None
) -> bool:
    """
    Send an email.

    - Development (USE_MAILHOG=true): routes through MailHog — no auth, no TLS.
    - Production (USE_MAILHOG=false): routes through real SMTP (Brevo etc.) with STARTTLS.
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))

        msg.attach(MIMEText(html_content, "html"))

        if USE_MAILHOG:
            # Dev mode — MailHog: no auth, no TLS
            with smtplib.SMTP(MAILHOG_HOST, MAILHOG_PORT) as server:
                server.send_message(msg)
            logger.info(
                "Email sent via MailHog to %s | Subject: %s",
                _mask_email(to_email),
                subject,
            )
        else:
            # Prod mode — real SMTP with STARTTLS (Brevo / SendGrid / etc.)
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(
                "Email sent via SMTP to %s | Subject: %s",
                _mask_email(to_email),
                subject,
            )

        return True
    except Exception:
        logger.exception("Error sending email to %s", _mask_email(to_email))
        return False


def send_templated_email(
    to_email: str, template: str, language: str = "en", **params: Any
) -> bool:
    """Render the `template` email in `language` and send it."""
    subject, html, text = render_email(template, language, to_email, **params)
    return send_email(to_email, subject, html, text)


def send_verification_email(
    to_email: str, verification_token: str, expires_in_hours: int, language: str = "en"
) -> bool:
    """Send the email address confirmation link."""
    return send_templated_email(
        to_email,
        "email_verification",
        language,
        action_url=f"{FRONTEND_URL}/verify-email/{verification_token}",
        duration=format_hours(language, expires_in_hours),
    )


def send_password_reset_email(
    to_email: str, reset_token: str, expires_in_hours: int, language: str = "en"
) -> bool:
    """Send the password reset link."""
    return send_templated_email(
        to_email,
        "password_reset",
        language,
        action_url=f"{FRONTEND_URL}/reset-password/{reset_token}",
        duration=format_hours(language, expires_in_hours),
    )
