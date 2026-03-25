"""App settings and configuration loader.

Behavior:
- Values are read from environment variables if present.
- Otherwise values are read from the repository `.env` file.
- If neither environment nor `.env` provide a value, the class default is used.

If you want `.env` to be loaded from a different path, update the
`env_file` path in `model_config` below.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import os


# Load .env into the process environment and let it override existing
# environment variables so .env values take precedence when Settings
# reads from the environment. This matches the requested behaviour: use
# `.env` first, then fall back to values defined in this module.
env_path = Path(__file__).resolve().parents[2] / ".env"
if env_path.exists():
    # override=True will place .env values into os.environ even if
    # variables already exist in the environment.
    load_dotenv(dotenv_path=str(env_path), override=True)


class Settings(BaseSettings):
    #DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/honeylove_prod

    orm_mode: bool = True
    DEBUG: bool = True
    DATABASE_URL: str = ""
    OPENAI_API_KEY: str = ""
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: str = ""
    SMTP_PORT: int = 587
    SMTP_PASSWORD: str = ""

    # Frontend/Backend URL defaults - these can be overridden by env or
    FRONTEND_URL: str = "https://honeylove.ai"
    BACKEND_URL: str = "https://api.honeylove.ai"

    # FRONTEND_URL: str = "http://localhost:5173"
    # BACKEND_URL: str = "http://localhost:8000"

    API_TOKEN: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_BUCKET_NAME: str = "honeylove-backend-672911155558-us-east-1-assets"
    AWS_REGION: str = "us-east-1"

    # AWS_REGION: str = "eu-north-1"
    # AWS_BUCKET_NAME: str = "aichat-pronily"
    # Stripe keys (present in your .env). Declare them here so
    # pydantic doesn't treat them as unexpected/extra inputs.
    STRIPE_API_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_PUBLISHABLE_KEY: str | None = None

    # PayGate (https://paygate.to) integration settings
    PAYGATE_MERCHANT_ADDRESS: str | None = (
        None  # Your USDC (Polygon) wallet address to receive instant payouts
    )
    PAYGATE_DEFAULT_PROVIDER: str | None = "moonpay"
    # to the repository root `.env` (two parents up from this file).
    GEOIP_DB: str = "/app/data/GeoLite2-City.mmdb"
    TOGETHER_AI_API_KEY: str | None = None
    AETHERLAB_API_KEY: str | None = None
    ELEVENLABS_API_KEY: str | None = None
    # TagadaPay integration settings
    TAGADA_API_KEY: str | None = None
    TAGADA_BASE_URL: str = "https://app.tagadapay.com"  # Production URL
    TAGADA_STORE_ID: str | None = None
    TAGADA_WEBHOOK_SECRET: str | None = None
    # Google OAuth client id for ID token verification
    GOOGLE_CLIENT_ID: str | None = None
    # Google OAuth client secret (used for server-side code exchange)
    GOOGLE_CLIENT_SECRET: str | None = None
    # Optional override for the OAuth redirect base (e.g. https://honeylove.ai)
    GOOGLE_OAUTH_REDIRECT_URL: str | None = None
    # Redis connection URL for pub/sub (used for broadcasts)
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Editor API settings (for image generation/editing)
    ai_editor_api_key: str | None = None
    ai_editor_api_url: str | None = None

    # S3 presigned URL expiry in seconds. Override in `.env` to change how
    # long generated presigned URLs are valid for. Default matches previous
    # behavior used in the codebase (10 hours = 36000 seconds).
    S3_PRESIGNED_EXPIRES: int = 36000

    ##sugarlab api keys
    SUGARLAB_API_KEY: str = ""
    
    # FAL AI Key
    FAL_KEY: str | None = None

    # Kie.ai API Key
    KIE_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
