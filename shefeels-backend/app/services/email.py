from email.mime.multipart import MIMEMultipart
from email.mime.text     import MIMEText
import aiosmtplib
from app.core.config import settings   # your pydantic Settings class
from app.services.app_config import get_config_value_from_cache
from app.core.config import settings
async def send_email(*, subject: str, to: list[str], html: str, text: str | None = None) -> None:
    email_from = settings.SMTP_USER
    hostname = settings.SMTP_HOST
    port = settings.SMTP_PORT
    msg            = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = email_from
    msg["To"]      = ", ".join(to)

    msg.attach(MIMEText(text or "Please view in an HTML-compatible client", "plain"))
    msg.attach(MIMEText(html, "html"))
    print(f"[DEBUG] Sending email to {to} with subject: {subject}")
    
    await aiosmtplib.send(
        msg,
        hostname=hostname,
        port=port,
        username=email_from,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )
