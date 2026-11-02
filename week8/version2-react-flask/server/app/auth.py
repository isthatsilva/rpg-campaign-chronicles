import hashlib
import hmac
import secrets
from datetime import timedelta
from functools import wraps

from flask import current_app, g, request

from .db import get_db, iso_now
from .errors import unauthorized

SESSION_COOKIE = "rcc_session"


def _config():
    return current_app.config["RCC"]


def _hash_token(token):
    # only the hmac is stored, so a leaked database can't be used to hijack sessions
    secret = _config()["session_secret"].encode()
    return hmac.new(secret, token.encode(), hashlib.sha256).hexdigest()


def _cookie_options():
    return {"httponly": True, "samesite": "Lax", "secure": _config()["cookie_secure"], "path": "/"}


def create_session(response, user_id):
    token = secrets.token_hex(32)
    ttl = timedelta(days=_config()["session_ttl_days"])
    get_db().execute(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (user_id, _hash_token(token), iso_now(ttl)),
    )
    response.set_cookie(SESSION_COOKIE, token, max_age=int(ttl.total_seconds()), **_cookie_options())


def destroy_session(response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        get_db().execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))
    response.delete_cookie(SESSION_COOKIE, **_cookie_options())


def load_session():
    """sets g.user when the request carries a valid, unexpired session cookie."""
    g.user = None
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return
    conn = get_db()
    row = conn.execute(
        """SELECT u.id, u.email, u.display_name, u.created_at, s.expires_at, s.id AS session_id
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ?""",
        (_hash_token(token),),
    ).fetchone()
    if row and row["expires_at"] > iso_now():
        g.user = {
            "id": row["id"],
            "email": row["email"],
            "displayName": row["display_name"],
            "createdAt": row["created_at"],
        }
    elif row:
        conn.execute("DELETE FROM sessions WHERE id = ?", (row["session_id"],))


def require_auth(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not g.get("user"):
            raise unauthorized()
        return view(*args, **kwargs)

    return wrapper
