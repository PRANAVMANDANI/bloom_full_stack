"""Transactional email sending via Brevo's HTTP API.

Uses HTTPS (Brevo's REST API), not SMTP — cloud hosts (including Render's
free tier) commonly block outbound SMTP ports entirely or throttle them
heavily, which can hang or silently fail a request. A plain HTTPS POST has
no such problem.

If BREVO_API_KEY is not configured, the link is logged to the console
instead of being sent, so the flow stays testable in local development.
"""

import httpx

from app.config import settings

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


def _verification_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/verify-email?token={token}"


def _reset_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/reset-password?token={token}"


def _verification_content(name: str, link: str) -> tuple[str, str, str]:
    """Returns (subject, html, text) for the verification email."""
    greeting = f"Hi {name}," if name else "Hi,"
    subject = "Verify your email for BLOOM 🌱"
    text = (
        f"{greeting}\n\n"
        f"Welcome to BLOOM! Please confirm your email address to activate your account:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours. "
        f"If you didn't create a BLOOM account, you can safely ignore this email.\n\n"
        f"— The BLOOM team"
    )
    html = f"""\
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
</div>"""
    return subject, html, text


def _reset_content(name: str, link: str) -> tuple[str, str, str]:
    """Returns (subject, html, text) for the password reset email."""
    greeting = f"Hi {name}," if name else "Hi,"
    subject = "Reset your BLOOM password"
    text = (
        f"{greeting}\n\n"
        f"We received a request to reset your BLOOM password. Click the link below to choose a new one:\n\n"
        f"{link}\n\n"
        f"This link expires in 1 hour. If you didn't request this, you can safely ignore this email — "
        f"your password will stay unchanged.\n\n"
        f"— The BLOOM team"
    )
    html = f"""\
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
</div>"""
    return subject, html, text


async def _send_or_log(to_email: str, subject: str, html: str, text: str, dev_link: str, label: str) -> None:
    """Shared send logic: real Brevo API call, or a console-logged link in dev."""
    if not settings.BREVO_API_KEY:
        print(f"[DEV] Email not configured. {label} link for {to_email}:\n  {dev_link}")
        return

    payload = {
        "sender": {"name": settings.FROM_NAME, "email": settings.FROM_EMAIL},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(BREVO_SEND_URL, json=payload, headers=headers)
        if response.status_code >= 400:
            print(f"[WARN] Brevo rejected {label.lower()} email to {to_email}: "
                  f"{response.status_code} {response.text}")
            print(f"[DEV] {label} link: {dev_link}")
            return
        print(f"[OK] {label} email sent to {to_email}")
    except Exception as e:
        # Don't crash the request if Brevo hiccups; log the link as a fallback.
        print(f"[WARN] Failed to send {label.lower()} email to {to_email}: {e}")
        print(f"[DEV] {label} link: {dev_link}")


async def send_verification_email(to_email: str, name: str, token: str) -> None:
    """Send (or, in dev, log) the account verification email."""
    link = _verification_link(token)
    subject, html, text = _verification_content(name, link)
    await _send_or_log(to_email, subject, html, text, link, "Verification")


async def send_password_reset_email(to_email: str, name: str, token: str) -> None:
    """Send (or, in dev, log) the password reset email."""
    link = _reset_link(token)
    subject, html, text = _reset_content(name, link)
    await _send_or_log(to_email, subject, html, text, link, "Password reset")
