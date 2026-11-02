import sqlite3

import bcrypt
from flask import Blueprint, current_app, g, jsonify

from ..auth import create_session, destroy_session, require_auth
from ..db import get_db, iso_now, write_transaction
from ..errors import HttpError, bad_request
from ..validation import REGISTER_SPEC, check_password, validate
from . import request_body

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _to_user(row):
    return {"id": row["id"], "email": row["email"], "displayName": row["display_name"], "createdAt": row["created_at"]}


def _email_taken():
    return HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.", {"email": "This email is already registered."})


def _dummy_hash():
    # compared against when the email doesn't exist, so a wrong email takes as long as a wrong password
    rcc = current_app.config["RCC"]
    if "dummy_hash" not in rcc:
        rcc["dummy_hash"] = bcrypt.hashpw(b"not-a-real-password-1", bcrypt.gensalt(rcc["bcrypt_rounds"]))
    return rcc["dummy_hash"]


@bp.post("/register")
def register():
    body = request_body()
    password_error = check_password(body.get("password") if isinstance(body, dict) else None)
    try:
        clean = validate(body, REGISTER_SPEC)
    except HttpError as err:
        if password_error and err.fields is not None:
            err.fields["password"] = password_error
        raise
    if password_error:
        raise bad_request("Please fix the highlighted fields.", {"password": password_error})

    conn = get_db()
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (clean["email"],)).fetchone():
        raise _email_taken()
    rounds = current_app.config["RCC"]["bcrypt_rounds"]
    password_hash = bcrypt.hashpw(body["password"].encode("utf-8"), bcrypt.gensalt(rounds)).decode()

    try:
        with write_transaction(conn):
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
                (clean["email"], password_hash, clean["displayName"]),
            )
            # every new account starts on the free plan
            conn.execute("INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, 'free', 'active')", (cur.lastrowid,))
            user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    except sqlite3.IntegrityError as err:
        # two simultaneous registrations with the same email: the unique index catches the loser
        if "UNIQUE constraint failed: users.email" in str(err):
            raise _email_taken() from None
        raise

    response = jsonify({"user": _to_user(user)})
    create_session(response, user["id"])
    return response, 201


@bp.post("/login")
def login():
    body = request_body()
    if not isinstance(body, dict):
        body = {}
    email, password = body.get("email"), body.get("password")
    fields = {}
    if not isinstance(email, str) or not email.strip():
        fields["email"] = "Email is required."
    if not isinstance(password, str) or not password:
        fields["password"] = "Password is required."
    if fields:
        raise bad_request("Please enter your email and password.", fields)

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    password_bytes = password.encode("utf-8")
    # bcrypt 5 refuses inputs over 72 bytes; registration never allows them, so such a login can't match
    too_long = len(password_bytes) > 72
    stored = row["password_hash"].encode() if row and not too_long else _dummy_hash()
    ok = bcrypt.checkpw(password_bytes[:72], stored)
    if not row or too_long or not ok:
        raise HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")

    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (iso_now(),))
    response = jsonify({"user": _to_user(row)})
    create_session(response, row["id"])
    return response


@bp.post("/logout")
def logout():
    response = current_app.response_class(status=204)
    destroy_session(response)
    return response


@bp.get("/me")
@require_auth
def me():
    return jsonify({"user": g.user})
