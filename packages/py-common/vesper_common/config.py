"""Settings shared by every Vesper service.

One .env drives all thirteen services; a service only overrides SERVICE_NAME and PORT.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Every variable is VESPER_-prefixed: VESPER_DATABASE_URL sets `database_url`.
    # Without the prefix a stray DATABASE_URL or DEBUG from the surrounding shell would
    # silently reconfigure the service, and the compose file's settings would be ignored.
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="VESPER_", extra="ignore", case_sensitive=False
    )

    service_name: str = "vesper"
    environment: str = "development"
    debug: bool = True

    # One PostgreSQL database in development, one schema per bounded context.
    database_url: str = "postgresql+psycopg://vesper:vesper@localhost:5432/vesper"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12
    refresh_token_days: int = 14
    # Guest QR tokens are short-lived and scoped to one occupied room.
    guest_token_minutes: int = 60 * 8

    # Resorts run on local time; every stored timestamp is UTC and rendered here.
    property_timezone: str = "Asia/Kolkata"
    currency: str = "INR"

    # Generation runs on Groq's free API. The model line-up there changes, so this is
    # a setting rather than a constant — GET /concierge/models lists what the key can
    # actually serve.
    groq_api_key: str | None = None
    concierge_model: str = "llama-3.3-70b-versatile"

    # Sentiment and retrieval embeddings run locally, not through Groq: they score every
    # rating and every passage, which would burn the free tier's request budget in
    # minutes. Both download weights on first use, so both are opt-in — a cold
    # deployment must not make the first guest to rate their breakfast wait for a
    # 500MB download.
    sentiment_use_transformer: bool = False
    sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    concierge_use_embeddings: bool = False

    # Shadow mode lets every executor preview without touching the world.
    shadow_mode_default: bool = False

    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"

    # Internal service discovery — docker-compose service names.
    identity_url: str = "http://identity-service:8001"
    property_url: str = "http://property-service:8002"
    staff_url: str = "http://staff-service:8003"
    guest_url: str = "http://guest-service:8004"
    inventory_url: str = "http://inventory-service:8005"
    frontdesk_url: str = "http://frontdesk-service:8006"
    action_url: str = "http://action-service:8007"
    revenue_url: str = "http://revenue-service:8008"
    maintenance_url: str = "http://maintenance-service:8009"
    workforce_url: str = "http://workforce-service:8010"
    guest_intel_url: str = "http://guest-intel-service:8011"
    notification_url: str = "http://notification-service:8012"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
