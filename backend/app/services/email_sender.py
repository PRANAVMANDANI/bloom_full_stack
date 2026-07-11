"""Transactional email sending via Brevo's HTTP API.

Uses HTTPS (Brevo's REST API), not SMTP — cloud hosts (including Render's
free tier) commonly block outbound SMTP ports entirely or throttle them
heavily, which can hang or silently fail a request. A plain HTTPS POST has
no such problem.

If BREVO_API_KEY is not configured, the code/link is logged to the console
instead of being sent, so the flow stays testable in local development.
"""

import httpx

from app.config import settings

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


def _reset_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/reset-password?token={token}"


def _otp_content(name: str, code: str) -> tuple[str, str, str]:
    """Returns (subject, html, text) for the verification-code email."""
    greeting = f"Hi {name}," if name else "Hi,"
    subject = f"{code} is your BLOOM verification code"
    text = (
        f"{greeting}\n\n"
        f"Welcome to BLOOM! Enter this code to verify your email address:\n\n"
        f"    {code}\n\n"
        f"The code expires in {settings.OTP_EXPIRE_MINUTES} minutes. "
        f"If you didn't create a BLOOM account, you can safely ignore this email.\n\n"
        f"— The BLOOM team"
    )
    html = f"""\
<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #2f3e34;">
  <h2 style="color: #5a8f69;">🌱 Welcome to BLOOM</h2>
  <p>{greeting}</p>
  <p>Enter this code to verify your email address:</p>
  <p style="text-align: center; margin: 28px 0;">
    <span style="display: inline-block; background: #eef4ef; color: #2f3e34; border-radius: 12px;
       padding: 14px 28px; font-size: 32px; font-weight: 700; letter-spacing: 10px;
       font-family: 'SF Mono', Consolas, monospace;">{code}</span>
  </p>
  <p style="font-size: 13px; color: #7a857d;">
    The code expires in {settings.OTP_EXPIRE_MINUTES} minutes.
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


async def _send_or_log(to_email: str, subject: str, html: str, text: str, dev_secret: str, label: str) -> None:
    """Shared send logic: real Brevo API call, or a console-logged code/link in dev."""
    if not settings.BREVO_API_KEY:
        print(f"[DEV] Email not configured. {label} for {to_email}:\n  {dev_secret}")
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
            print(f"[DEV] {label}: {dev_secret}")
            return
        print(f"[OK] {label} email sent to {to_email}")
    except Exception as e:
        # Don't crash the request if Brevo hiccups; log the code/link as a fallback.
        print(f"[WARN] Failed to send {label.lower()} email to {to_email}: {e}")
        print(f"[DEV] {label}: {dev_secret}")


async def send_otp_email(to_email: str, name: str, code: str) -> None:
    """Send (or, in dev, log) the 6-digit verification code email."""
    subject, html, text = _otp_content(name, code)
    await _send_or_log(to_email, subject, html, text, code, "Verification code")


async def send_password_reset_email(to_email: str, name: str, token: str) -> None:
    """Send (or, in dev, log) the password reset email."""
    link = _reset_link(token)
    subject, html, text = _reset_content(name, link)
    await _send_or_log(to_email, subject, html, text, link, "Password reset link")
