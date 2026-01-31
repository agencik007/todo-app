"""
Email service - Email sending functionality using MailHog.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

# Email configuration
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@example.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

# MailHog configuration (for local development/testing)
MAILHOG_HOST = os.getenv("MAILHOG_HOST", "localhost")
MAILHOG_PORT = int(os.getenv("MAILHOG_PORT", "1025"))


def send_email(
    to_email: str, 
    subject: str, 
    html_content: str, 
    text_content: Optional[str] = None
) -> bool:
    """
    Send an email using MailHog SMTP.
    
    MailHog captures all emails and displays them in a web interface
    at http://localhost:8025. Perfect for development/testing.
    
    Args:
        to_email: Recipient email address.
        subject: Email subject line.
        html_content: HTML content of the email.
        text_content: Optional plain text content.
        
    Returns:
        bool: True if email was sent successfully, False otherwise.
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


def send_verification_email(to_email: str, verification_token: str) -> bool:
    """
    Send email verification email.
    
    Args:
        to_email: Recipient email address.
        verification_token: Token for email verification.
        
    Returns:
        bool: True if email was sent successfully.
    """
    verification_url = f"{FRONTEND_URL}/verify-email?token={verification_token}"

    subject = "Verify your email address"
    html_content = f"""
    <html>
      <body>
        <h2>Email Verification</h2>
        <p>Thank you for registering! Please click the link below to verify your email address:</p>
        <p><a href="{verification_url}">{verification_url}</a></p>
        <p>If you didn't create an account, please ignore this email.</p>
      </body>
    </html>
    """

    text_content = f"""
    Email Verification
    
    Thank you for registering! Please click the link below to verify your email address:
    {verification_url}
    
    If you didn't create an account, please ignore this email.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Send password reset email.
    
    Args:
        to_email: Recipient email address.
        reset_token: Token for password reset.
        
    Returns:
        bool: True if email was sent successfully.
    """
    reset_url = f"{FRONTEND_URL}/reset-password/{reset_token}"

    subject = "Resetowanie hasła - Todo App"
    html_content = f"""
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }}
            .header {{ text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }}
            .content {{ padding: 20px 0; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px; }}
            .footer {{ font-size: 12px; color: #777; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="color: #6366f1;">Todo App</h2>
            </div>
            <div class="content">
                <h3>Cześć!</h3>
                <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w aplikacji Todo App.</p>
                <p>Kliknij w poniższy przycisk, aby ustawić nowe hasło:</p>
                <div style="text-align: center;">
                    <a href="{reset_url}" class="button">Zresetuj hasło</a>
                </div>
                <p>Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:</p>
                <p style="word-break: break-all;"><a href="{reset_url}">{reset_url}</a></p>
                <p>Ten link wygaśnie za <strong>1 godzinę</strong>.</p>
                <p>Jeśli to nie Ty prosiłeś o reset hasła, możesz zignorować tę wiadomość.</p>
            </div>
            <div class="footer">
                <p>Ta wiadomość została wysłana automatycznie. Prosimy na nią nie odpowiadać.</p>
                <p>&copy; 2026 Todo App</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Resetowanie hasła - Todo App
    
    Cześć!
    
    Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w aplikacji Todo App.
    Kliknij w poniższy link, aby ustawić nowe hasło:
    
    {reset_url}
    
    Ten link wygaśnie za 1 godzinę.
    
    Jeśli to nie Ty prosiłeś o reset hasła, możesz zignorować tę wiadomość.
    
    Ta wiadomość została wysłana automatycznie. Prosimy na nią nie odpowiadać.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_welcome_email(to_email: str) -> bool:
    """
    Send welcome email after successful registration.
    
    Args:
        to_email: Recipient email address.
        
    Returns:
        bool: True if email was sent successfully.
    """
    subject = "Welcome to Todo App!"
    html_content = """
    <html>
      <body>
        <h2>Welcome to Todo App!</h2>
        <p>Thank you for joining us. Your account has been successfully created.</p>
        <p>Start managing your tasks right away!</p>
      </body>
    </html>
    """

    text_content = """
    Welcome to Todo App!
    
    Thank you for joining us. Your account has been successfully created.
    Start managing your tasks right away!
    """

    return send_email(to_email, subject, html_content, text_content)
