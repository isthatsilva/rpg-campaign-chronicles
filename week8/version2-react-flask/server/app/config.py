import os
from pathlib import Path

from dotenv import load_dotenv

SERVER_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(SERVER_ROOT / ".env")


def _int_from_env(name, fallback):
    raw = os.environ.get(name, "")
    if raw == "":
        return fallback
    try:
        return int(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be an integer") from None


def load_config(overrides=None):
    database_path = os.environ.get("DATABASE_PATH") or "./data/app.db"
    config = {
        "port": _int_from_env("PORT", 5001),
        "database_path": str((SERVER_ROOT / database_path).resolve()),
        "session_secret": os.environ.get("SESSION_SECRET"),
        "session_ttl_days": _int_from_env("SESSION_TTL_DAYS", 7),
        "cookie_secure": os.environ.get("COOKIE_SECURE") == "true",
        "bcrypt_rounds": _int_from_env("BCRYPT_ROUNDS", 12),
    }
    config.update(overrides or {})
    if not config["session_secret"] or len(config["session_secret"]) < 16:
        raise RuntimeError(
            "SESSION_SECRET is missing or too short (min 16 chars). Copy .env.example to .env and set it."
        )
    return config
