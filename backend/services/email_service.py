import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

# Email configuration
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@example.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

# MailHog configuration (for local development/testing)
# MailHog is a development SMTP server that captures all emails
# Access the web UI at http://localhost:8025 to view sent emails
MAILHOG_HOST = os.getenv("MAILHOG_HOST", "localhost")
MAILHOG_PORT = int(os.getenv("MAILHOG_PORT", "1025"))


def send_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """
    Send an email using MailHog SMTP (for development/testing).
    
    MailHog captures all emails sent through its SMTP server (port 1025)
    and displays them in a web interface (http://localhost:8025).
    This is perfect for testing email functionality without sending real emails.
    """
    return _send_with_mailhog(to_email, subject, html_content, text_content)


def _send_with_mailhog(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """Send email using MailHog SMTP (for testing)"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email

        if text_content:
            part1 = MIMEText(text_content, "plain")
            msg.attach(part1)
        
        part2 = MIMEText(html_content, "html")
        msg.attach(part2)

        with smtplib.SMTP(MAILHOG_HOST, MAILHOG_PORT) as server:
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email with MailHog: {e}")
        return False


def send_verification_email(to_email: str, verification_token: str) -> bool:
    """Send email verification email"""
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
    """Send password reset email"""
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    subject = "Password Reset Request"
    html_content = f"""
    <html>
      <body>
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
      </body>
    </html>
    """
    
    text_content = f"""
    Password Reset Request
    
    You requested to reset your password. Click the link below to reset it:
    {reset_url}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, please ignore this email.
    """
    
    return send_email(to_email, subject, html_content, text_content)


def send_welcome_email(to_email: str) -> bool:
    """Send welcome email after successful registration"""
    subject = "Welcome to Todo App!"
    html_content = f"""
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

