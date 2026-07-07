"""Transactional email sending via SMTP (Gmail).

If SMTP credentials are not configured, the verification link is logged to the
console instead of being sent, so the flow stays testable in local development.
"""

from email.message import EmailMessage

import aiosmtplib

from app.config import settings


def _verification_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/verify-email?token={token}"


def _build_verification_message(to_email: str, name: str, link: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = settings.FROM_EMAIL or settings.SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = "Verify your email for BLOOM 🌱"

    greeting = f"Hi {name}," if name else "Hi,"
    msg.set_content(
        f"{greeting}\n\n"
        f"Welcome to BLOOM! Please confirm your email address to activate your account:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours. "
        f"If you didn't create a BLOOM account, you can safely ignore this email.\n\n"
        f"— The BLOOM team"
    )
    msg.add_alternative(
        f"""\
<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #2f3e34;">
  <h2 style="color: #5a8f69;">🌱 Welcome to BLOOM</h2>
  <p>{greeting}</p>
  <p>Please confirm your email address to activate your account.</p>
  <p style="text-align: center; margin: 28px 0;">
    <a href="{link}" style="background: #5a8f69; color: #fff; text-decoration: none;
       padding: 12px 28px; border-radius: 999px; font-weight: 600; display: inline-block;">
       Verify my email
    </a>
  </p>
  <p style="font-size: 13px; color: #7a857d;">
    Or paste this link into your browser:<br>
    <a href="{link}">{link}</a>
  </p>
  <p style="font-size: 13px; color: #7a857d;">
    This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.
    If you didn't create a BLOOM account, you can safely ignore this email.
  </p>
</div>""",
        subtype="html",
    )
    return msg


def _reset_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/reset-password?token={token}"


def _build_reset_message(to_email: str, name: str, link: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = settings.FROM_EMAIL or settings.SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = "Reset your BLOOM password"

    greeting = f"Hi {name}," if name else "Hi,"
    msg.set_content(
        f"{greeting}\n\n"
        f"We received a request to reset your BLOOM password. Click the link below to choose a new one:\n\n"
        f"{link}\n\n"
        f"This link expires in 1 hour. If you didn't request this, you can safely ignore this email — "
        f"your password will stay unchanged.\n\n"
        f"— The BLOOM team"
    )
    msg.add_alternative(
        f"""\
<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #2f3e34;">
  <h2 style="color: #5a8f69;">🌱 Reset your password</h2>
  <p>{greeting}</p>
  <p>We received a request to reset your BLOOM password.</p>
  <p style="text-align: center; margin: 28px 0;">
    <a href="{link}" style="background: #5a8f69; color: #fff; text-decoration: none;
       padding: 12px 28px; border-radius: 999px; font-weight: 600; display: inline-block;">
       Reset my password
    </a>
  </p>
  <p style="font-size: 13px; color: #7a857d;">
    Or paste this link into your browser:<br>
    <a href="{link}">{link}</a>
  </p>
  <p style="font-size: 13px; color: #7a857d;">
    This link expires in 1 hour. If you didn't request this, you can safely ignore this email —
    your password will stay unchanged.
  </p>
</div>""",
        subtype="html",
    )
    return msg


async def _send_or_log(message: EmailMessage, to_email: str, dev_link: str, label: str) -> None:
    """Shared send logic: real SMTP send, or a console-logged link in dev."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[DEV] Email not configured. {label} link for {to_email}:\n  {dev_link}")
        return

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"[OK] {label} email sent to {to_email}")
    except Exception as e:
        # Don't crash the request if the mail server hiccups; log the link as a fallback.
        print(f"[WARN] Failed to send {label.lower()} email to {to_email}: {e}")
        print(f"[DEV] {label} link: {dev_link}")


async def send_verification_email(to_email: str, name: str, token: str) -> None:
    """Send (or, in dev, log) the account verification email."""
    link = _verification_link(token)
    await _send_or_log(_build_verification_message(to_email, name, link), to_email, link, "Verification")


async def send_password_reset_email(to_email: str, name: str, token: str) -> None:
    """Send (or, in dev, log) the password reset email."""
    link = _reset_link(token)
    await _send_or_log(_build_reset_message(to_email, name, link), to_email, link, "Password reset")
