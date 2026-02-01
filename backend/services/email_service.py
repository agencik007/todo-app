"""
Email service - Email sending functionality using MailHog with i18n support.
"""

import os
import json
import smtplib
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any

# Email configuration
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@example.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

# MailHog configuration (for local development/testing)
MAILHOG_HOST = os.getenv("MAILHOG_HOST", "localhost")
MAILHOG_PORT = int(os.getenv("MAILHOG_PORT", "1025"))

# Load translations
BASE_DIR = Path(__file__).resolve().parent.parent
I18N_DIR = BASE_DIR / "i18n"


def load_translations() -> Dict[str, Any]:
    """Load translation files from i18n directory."""
    translations = {}
    for lang in ["en", "pl"]:
        try:
            file_path = I18N_DIR / f"{lang}.json"
            if file_path.exists():
                with open(file_path, "r", encoding="utf-8") as f:
                    translations[lang] = json.load(f)
            else:
                print(f"Warning: Translation file not found: {file_path}")
                translations[lang] = {}
        except Exception as e:
            print(f"Error loading translation for {lang}: {e}")
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
            print(f"Missing format key {e} for {lang}.{category}.{key}")
            return text
    return text


def _get_html_template(lang: str, title: str, content: str) -> str:
    """Wrap content in a nice HTML template."""
    footer_text = get_text(lang, "common", "footer_automated")
    copyright_text = get_text(lang, "common", "footer_copyright")

    return f"""
    <!DOCTYPE html>
    <html lang="{lang}">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; }}
            .header {{ background-color: #6366f1; padding: 24px; text-align: center; }}
            .header h2 {{ color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }}
            .content {{ padding: 32px 24px; }}
            .button-container {{ text-align: center; margin: 30px 0; }}
            .button {{ display: inline-block; padding: 14px 28px; background-color: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s; }}
            .button:hover {{ background-color: #4f46e5; }}
            .footer {{ background-color: #f3f4f6; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
            .link-text {{ word-break: break-all; color: #6366f1; }}
            p {{ margin-bottom: 16px; }}
            h3 {{ color: #111827; margin-top: 0; font-size: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Todo App</h2>
            </div>
            <div class="content">
                <h3>{title}</h3>
                {content}
            </div>
            <div class="footer">
                <p>{footer_text}</p>
                <p>{copyright_text}</p>
            </div>
        </div>
    </body>
    </html>
    """


def send_email(
    to_email: str, subject: str, html_content: str, text_content: Optional[str] = None
) -> bool:
    """
    Send an email using MailHog SMTP.
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))

        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(MAILHOG_HOST, MAILHOG_PORT) as server:
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_verification_email(
    to_email: str, verification_token: str, language: str = "en"
) -> bool:
    """
    Send email verification email.
    """
    verification_url = f"{FRONTEND_URL}/verify-email/{verification_token}"

    subject = get_text(language, "email_verification", "subject")
    title = get_text(language, "email_verification", "title")
    greeting = get_text(language, "email_verification", "greeting")
    message = get_text(language, "email_verification", "message")
    button_text = get_text(language, "email_verification", "button_text")
    fallback_text = get_text(language, "email_verification", "fallback_text")
    ignore_text = get_text(language, "email_verification", "ignore_text")

    html_body = f"""
        <p>{greeting}</p>
        <p>{message}</p>
        <div class="button-container">
            <a href="{verification_url}" class="button">{button_text}</a>
        </div>
        <p>{fallback_text}</p>
        <p><a href="{verification_url}" class="link-text">{verification_url}</a></p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #6b7280; font-size: 14px;">{ignore_text}</p>
    """

    html_content = _get_html_template(language, title, html_body)

    text_content = f"""
    {title}
    
    {greeting}
    
    {message}
    
    {verification_url}
    
    {ignore_text}
    """

    return send_email(to_email, subject, html_content, text_content)


def send_password_reset_email(
    to_email: str, reset_token: str, language: str = "en"
) -> bool:
    """
    Send password reset email.
    """
    # 1 hour expiry
    hours = 1
    reset_url = f"{FRONTEND_URL}/reset-password/{reset_token}"

    subject = get_text(language, "password_reset", "subject")
    title = get_text(language, "password_reset", "title")
    greeting = get_text(language, "password_reset", "greeting")
    message = get_text(language, "password_reset", "message")
    action_text = get_text(language, "password_reset", "action_text")
    button_text = get_text(language, "password_reset", "button_text")
    fallback_text = get_text(language, "password_reset", "fallback_text")
    expiry_text = get_text(language, "password_reset", "expiry_text", hours=hours)
    ignore_text = get_text(language, "password_reset", "ignore_text")

    html_body = f"""
        <p>{greeting}</p>
        <p>{message}</p>
        <p>{action_text}</p>
        <div class="button-container">
            <a href="{reset_url}" class="button">{button_text}</a>
        </div>
        <p>{fallback_text}</p>
        <p><a href="{reset_url}" class="link-text">{reset_url}</a></p>
        <p><strong>{expiry_text}</strong></p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #6b7280; font-size: 14px;">{ignore_text}</p>
    """

    html_content = _get_html_template(language, title, html_body)

    text_content = f"""
    {title}
    
    {greeting}
    
    {message}
    
    {reset_url}
    
    {expiry_text}
    
    {ignore_text}
    """

    return send_email(to_email, subject, html_content, text_content)
