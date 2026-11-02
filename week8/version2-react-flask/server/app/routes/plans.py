from flask import Blueprint, g, jsonify

from ..auth import require_auth
from ..db import get_db, iso_now, write_transaction
from ..errors import HttpError, bad_request
from . import request_body

bp = Blueprint("plans", __name__, url_prefix="/api")


def _to_plan(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "characterLimit": row["character_limit"],
        "priceCents": row["price_cents"],
        "currency": row["currency"],
    }


def get_subscription_summary(conn, user_id):
    """the current plan plus usage numbers the dashboard and account page need."""
    row = conn.execute(
        """SELECT s.status, s.started_at, p.*
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id
           WHERE s.user_id = ? AND s.status = 'active'""",
        (user_id,),
    ).fetchone()
    count = conn.execute("SELECT COUNT(*) FROM characters WHERE user_id = ?", (user_id,)).fetchone()[0]
    limit = row["character_limit"]
    return {
        "plan": _to_plan(row),
        "status": row["status"],
        "startedAt": row["started_at"],
        "characterCount": count,
        "characterLimit": limit,
        "remaining": max(0, limit - count),
        "canCreate": count < limit,
        # true after a downgrade below the current number of characters
        "overLimit": count > limit,
    }


@bp.get("/plans")
def list_plans():
    rows = get_db().execute("SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order").fetchall()
    return jsonify({"plans": [_to_plan(r) for r in rows]})


@bp.get("/subscription")
@require_auth
def get_subscription():
    return jsonify({"subscription": get_subscription_summary(get_db(), g.user["id"])})


@bp.put("/subscription")
@require_auth
def change_plan():
    """simulated plan change: no payment is collected or recorded."""
    body = request_body()
    plan_id = body.get("planId") if isinstance(body, dict) else None
    if not isinstance(plan_id, str) or not plan_id:
        raise bad_request("Please choose a plan.", {"planId": "Plan is required."})
    conn = get_db()
    plan = conn.execute("SELECT * FROM plans WHERE id = ? AND is_active = 1", (plan_id,)).fetchone()
    if not plan:
        raise bad_request("That plan does not exist.", {"planId": "Unknown plan."})

    user_id = g.user["id"]
    with write_transaction(conn):
        current = conn.execute(
            "SELECT plan_id FROM subscriptions WHERE user_id = ? AND status = 'active'", (user_id,)
        ).fetchone()
        if current and current["plan_id"] == plan["id"]:
            raise HttpError(409, "ALREADY_ON_PLAN", f"You are already on the {plan['name']} plan.")
        now = iso_now()
        # keep the old row as history instead of overwriting it
        conn.execute(
            "UPDATE subscriptions SET status = 'canceled', ends_at = ? WHERE user_id = ? AND status = 'active'",
            (now, user_id),
        )
        conn.execute(
            "INSERT INTO subscriptions (user_id, plan_id, status, started_at) VALUES (?, ?, 'active', ?)",
            (user_id, plan["id"], now),
        )
    return jsonify({"subscription": get_subscription_summary(conn, user_id)})
