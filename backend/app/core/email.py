import logging
import ssl
import certifi
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("emocare.email")


async def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning("Email not configured — skipping send to %s", to)
        return False
    try:
        # macOS-compatible SSL context using certifi certificates
        tls_context = ssl.create_default_context(cafile=certifi.where())

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.MAIL_FROM
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.MAIL_SERVER,
            port=settings.MAIL_PORT,
            username=settings.MAIL_USERNAME,
            password=settings.MAIL_PASSWORD,
            start_tls=True,
            tls_context=tls_context,
        )
        logger.info("Email sent → %s | %s", to, subject)
        return True
    except Exception as e:
        logger.error("Email failed → %s: %s", to, e)
        return False


# ── Template helpers ──────────────────────────────────────────

def _wrap(title: str, body: str) -> str:
    return f"""
<html><body style="font-family:'Georgia',serif;background:#FFF8F0;margin:0;padding:0;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;
            border:1px solid #DFC4A0;overflow:hidden;box-shadow:0 4px 24px rgba(74,37,8,.1);">
  <div style="background:linear-gradient(135deg,#C8844A,#A06830);padding:28px 32px;">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">EmoCare AI</h1>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;">
      Mental Health Research Platform</p>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#2E1505;font-size:18px;margin:0 0 16px;">{title}</h2>
    {body}
    <hr style="border:none;border-top:1px solid #EDD9C0;margin:28px 0;"/>
    <p style="color:#A06830;font-size:11px;margin:0;">
      Automated message from EmoCare AI · Emergency: 112 · Tele-MANAS: 14416</p>
  </div>
</div></body></html>"""


def _p(t: str) -> str:
    return f'<p style="color:#4A2508;font-size:15px;line-height:1.65;margin:0 0 14px;">{t}</p>'


def _box(label: str, value: str) -> str:
    return f"""<div style="background:#FFF8F0;border:1px solid #DFC4A0;border-radius:8px;
                           padding:12px 16px;margin:8px 0;">
  <span style="font-size:11px;color:#A06830;font-weight:700;text-transform:uppercase;
               letter-spacing:.8px;">{label}</span>
  <div style="color:#2E1505;font-size:15px;font-weight:600;margin-top:4px;">{value}</div>
</div>"""


def _btn(text: str, url: str) -> str:
    return f"""<a href="{url}" style="display:inline-block;background:#C8844A;color:#fff;
   padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;
   font-size:14px;margin:8px 0 20px;">{text}</a>"""


# ── Email senders ─────────────────────────────────────────────

async def send_welcome_email(to: str, full_name: str) -> bool:
    body = (
        _p(f"Welcome to EmoCare AI, <strong>{full_name}</strong>!")
        + _p("Your account has been created successfully. You can now start conversations "
             "with our AI assistant.")
        + _btn("Open EmoCare AI", settings.FRONTEND_URL)
        + _p("<strong>Important:</strong> EmoCare AI is a research prototype — "
             "not a clinical diagnostic tool.")
    )
    return await send_email(
        to, "Welcome to EmoCare AI",
        _wrap("Account Created", body)
    )


async def send_appointment_request_email(
    to: str,
    user_name: str,
    doctor_name: str,
    scheduled_at: str,
    notes: str = "",
) -> bool:
    body = (
        _p(f"Your appointment request has been received, <strong>{user_name}</strong>.")
        + _box("Doctor", doctor_name)
        + _box("Requested Time", scheduled_at)
        + (_box("Notes", notes) if notes else "")
        + _p("You will receive a confirmation email once the admin approves your request.")
    )
    return await send_email(
        to, "Appointment Request Received — EmoCare AI",
        _wrap("Appointment Requested", body)
    )


async def send_new_appointment_notification(
    to: str,
    role: str,
    user_name: str,
    scheduled_at: str,
    doctor_name: str = "TBD",
    notes: str = "",
) -> bool:
    body = (
        _p(f"Hello, a new appointment has been requested by <strong>{user_name}</strong>.")
        + _box("Requested Time", scheduled_at)
        + _box("Selected Therapist", doctor_name)
        + (_box("Notes", notes) if notes else "")
        + _p(f"Please log in to the dashboard to review this request.")
    )
    subject_role = "Admin" if role == "admin" else "Therapist"
    return await send_email(
        to, f"New Appointment Request ({subject_role}) — EmoCare AI",
        _wrap("New Appointment Request", body)
    )


async def send_appointment_confirmed_email(
    to: str,
    user_name: str,
    doctor_name: str,
    scheduled_at: str,
    meeting_link: str,
) -> bool:
    body = (
        _p(f"Your appointment has been confirmed.")
        + _box("Patient", user_name)
        + _box("Doctor", doctor_name)
        + _box("Date & Time", scheduled_at)
        + _box("Meeting Link", f'<a href="{meeting_link}" style="color:#C8844A;text-decoration:none;">{meeting_link}</a>')
        + _p("Please be available at the scheduled time. Contact your admin if you need "
             "to reschedule.")
        + _btn("Join Meeting", meeting_link)
    )
    return await send_email(
        to, "Appointment Confirmed & Meeting Link — EmoCare AI",
        _wrap("Appointment Confirmed", body)
    )


async def send_appointment_cancelled_email(
    to: str,
    user_name: str,
    scheduled_at: str,
    reason: str = "",
) -> bool:
    body = (
        _p(f"Hello <strong>{user_name}</strong>, your appointment scheduled for "
           f"<strong>{scheduled_at}</strong> has been cancelled.")
        + (_box("Reason", reason) if reason else "")
        + _p("Please contact your admin to reschedule.")
    )
    return await send_email(
        to, "Appointment Cancelled — EmoCare AI",
        _wrap("Appointment Cancelled", body)
    )


async def send_password_change_email(to: str, full_name: str) -> bool:
    body = (
        _p(f"Hello <strong>{full_name}</strong>, your EmoCare AI account password "
           f"was recently changed.")
        + _p("If you did not make this change, please contact your administrator immediately.")
    )
    return await send_email(
        to, "Password Changed — EmoCare AI",
        _wrap("Password Changed", body)
    )


async def send_thank_you_email(to: str, user_name: str) -> bool:
    body = (
        _p(f"Hello <strong>{user_name}</strong>,")
        + _p("We appreciate you using our service and we hope the scheduled session was helpful.")
        + _p("If you have any feedback or further concerns, feel free to reach out to us.")
    )
    return await send_email(
        to, "Thank You — EmoCare AI",
        _wrap("Session Completed", body)
    )