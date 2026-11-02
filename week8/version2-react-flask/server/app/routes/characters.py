from flask import Blueprint, g, jsonify

from ..auth import require_auth
from ..db import get_db, write_transaction
from ..errors import HttpError, bad_request, not_found
from ..validation import (
    ATTRIBUTE_SPEC,
    CHARACTER_SPEC,
    EQUIPMENT_SPEC,
    JOURNAL_SPEC,
    MAX_ATTRIBUTES_PER_CHARACTER,
    parse_id,
    validate,
)
from . import request_body

bp = Blueprint("characters", __name__, url_prefix="/api/characters")

# api field name -> database column, per resource
CHARACTER_COLUMNS = {
    "name": "name", "species": "species", "role": "role", "level": "level", "health": "health",
    "maxHealth": "max_health", "experience": "experience", "abilities": "abilities", "biography": "biography",
}
ATTRIBUTE_COLUMNS = {"name": "name", "value": "value"}
EQUIPMENT_COLUMNS = {"itemName": "item_name", "itemType": "item_type", "quantity": "quantity", "description": "description"}
JOURNAL_COLUMNS = {
    "sessionDate": "session_date", "title": "title", "campaignName": "campaign_name", "attendees": "attendees",
    "events": "events", "rewards": "rewards", "notes": "notes",
}
TIMESTAMPS = {"createdAt": "created_at", "updatedAt": "updated_at"}
NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"


def _row_mapper(columns, extra=None):
    mapping = {**columns, **(extra or {})}
    return lambda row: {"id": row["id"], **{field: row[column] for field, column in mapping.items()}}


to_character = _row_mapper(CHARACTER_COLUMNS, TIMESTAMPS)

# the three per-character child resources share one generic crud implementation
CHILD_RESOURCES = {
    "attributes": {
        "table": "character_attributes", "columns": ATTRIBUTE_COLUMNS, "spec": ATTRIBUTE_SPEC,
        "to_api": _row_mapper(ATTRIBUTE_COLUMNS), "order": "position, id", "label": "Attribute",
    },
    "equipment": {
        "table": "equipment", "columns": EQUIPMENT_COLUMNS, "spec": EQUIPMENT_SPEC,
        "to_api": _row_mapper(EQUIPMENT_COLUMNS), "order": "item_name COLLATE NOCASE, id", "label": "Item",
    },
    "journal": {
        "table": "journal_entries", "columns": JOURNAL_COLUMNS, "spec": JOURNAL_SPEC,
        "to_api": _row_mapper(JOURNAL_COLUMNS, TIMESTAMPS), "order": "session_date DESC, id DESC",
        "label": "Journal entry", "timestamps": True,
    },
}


def _validate_attribute_list(items):
    if items is None:
        return []
    if not isinstance(items, list):
        raise bad_request("Attributes must be a list.", {"attributes": "Attributes must be a list."})
    if len(items) > MAX_ATTRIBUTES_PER_CHARACTER:
        raise bad_request(
            f"A character can have at most {MAX_ATTRIBUTES_PER_CHARACTER} attributes.", {"attributes": "Too many attributes."}
        )
    clean = []
    for i, item in enumerate(items):
        try:
            clean.append(validate(item, ATTRIBUTE_SPEC))
        except HttpError as err:
            first = next(iter(err.fields.values())) if err.fields else err.message
            message = f"Attribute #{i + 1}: {first}"
            raise bad_request(message, {"attributes": message}) from None
    return clean


def _load_owned_character(conn, raw_id):
    # every lookup is scoped by user_id, so another user's id simply isn't found (404, not 403)
    character_id = parse_id(raw_id)
    row = character_id and conn.execute(
        "SELECT * FROM characters WHERE id = ? AND user_id = ?", (character_id, g.user["id"])
    ).fetchone()
    if not row:
        raise not_found("Character not found.")
    return row


def _insert_attributes(conn, character_id, attributes, start_position=0):
    conn.executemany(
        "INSERT INTO character_attributes (character_id, name, value, position) VALUES (?, ?, ?, ?)",
        [(character_id, a["name"], a["value"], start_position + i) for i, a in enumerate(attributes)],
    )


@bp.get("")
@require_auth
def list_characters():
    rows = get_db().execute(
        "SELECT * FROM characters WHERE user_id = ? ORDER BY name COLLATE NOCASE, id", (g.user["id"],)
    ).fetchall()
    return jsonify({"characters": [to_character(r) for r in rows]})


@bp.post("")
@require_auth
def create_character():
    body = request_body()
    clean = validate(body, CHARACTER_SPEC)
    attributes = _validate_attribute_list(body.get("attributes"))
    conn = get_db()
    user_id = g.user["id"]

    with write_transaction(conn):
        # count and insert in one write transaction so parallel requests can't both squeeze under the limit
        plan = conn.execute(
            """SELECT p.character_limit, p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id
               WHERE s.user_id = ? AND s.status = 'active'""",
            (user_id,),
        ).fetchone()
        count = conn.execute("SELECT COUNT(*) FROM characters WHERE user_id = ?", (user_id,)).fetchone()[0]
        limit = plan["character_limit"]
        if count >= limit:
            raise HttpError(
                403, "PLAN_LIMIT_REACHED",
                f"Your {plan['name']} plan allows {limit} characters and you have {count}. "
                "Delete a character or upgrade your plan to create another.",
            )
        cols = list(CHARACTER_COLUMNS.values())
        cur = conn.execute(
            f"INSERT INTO characters (user_id, {', '.join(cols)}) VALUES (?, {', '.join('?' for _ in cols)})",
            (user_id, *(clean[f] for f in CHARACTER_COLUMNS)),
        )
        _insert_attributes(conn, cur.lastrowid, attributes)
        created = conn.execute("SELECT * FROM characters WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"character": to_character(created)}), 201


@bp.get("/<character_id>")
@require_auth
def get_character(character_id):
    conn = get_db()
    row = _load_owned_character(conn, character_id)
    children = {
        key: [
            r["to_api"](child)
            for child in conn.execute(
                f"SELECT * FROM {r['table']} WHERE character_id = ? ORDER BY {r['order']}", (row["id"],)
            ).fetchall()
        ]
        for key, r in CHILD_RESOURCES.items()
    }
    return jsonify({
        "character": {
            **to_character(row),
            "attributes": children["attributes"],
            "equipment": children["equipment"],
            "journalEntries": children["journal"],
        }
    })


@bp.put("/<character_id>")
@require_auth
def update_character(character_id):
    conn = get_db()
    row = _load_owned_character(conn, character_id)
    clean = validate(request_body(), CHARACTER_SPEC)
    sets = ", ".join(f"{c} = ?" for c in CHARACTER_COLUMNS.values())
    conn.execute(
        f"UPDATE characters SET {sets}, updated_at = {NOW_SQL} WHERE id = ? AND user_id = ?",
        (*(clean[f] for f in CHARACTER_COLUMNS), row["id"], g.user["id"]),
    )
    return jsonify({"character": to_character(_load_owned_character(conn, character_id))})


@bp.delete("/<character_id>")
@require_auth
def delete_character(character_id):
    conn = get_db()
    row = _load_owned_character(conn, character_id)
    # attributes, equipment and journal entries go with it via ON DELETE CASCADE
    conn.execute("DELETE FROM characters WHERE id = ? AND user_id = ?", (row["id"], g.user["id"]))
    return "", 204


# generic crud for /<character_id>/{attributes,equipment,journal}

RESOURCE = "<any(attributes, equipment, journal):resource>"


def _load_child(conn, r, character, raw_item_id):
    item_id = parse_id(raw_item_id)
    row = item_id and conn.execute(
        f"SELECT * FROM {r['table']} WHERE id = ? AND character_id = ?", (item_id, character["id"])
    ).fetchone()
    if not row:
        raise not_found(f"{r['label']} not found.")
    return row


@bp.get(f"/<character_id>/{RESOURCE}")
@require_auth
def list_children(character_id, resource):
    r = CHILD_RESOURCES[resource]
    conn = get_db()
    character = _load_owned_character(conn, character_id)
    rows = conn.execute(
        f"SELECT * FROM {r['table']} WHERE character_id = ? ORDER BY {r['order']}", (character["id"],)
    ).fetchall()
    return jsonify({"items": [r["to_api"](row) for row in rows]})


@bp.post(f"/<character_id>/{RESOURCE}")
@require_auth
def create_child(character_id, resource):
    r = CHILD_RESOURCES[resource]
    conn = get_db()
    character = _load_owned_character(conn, character_id)
    clean = validate(request_body(), r["spec"])
    with write_transaction(conn):
        if resource == "attributes":
            count, max_pos = conn.execute(
                "SELECT COUNT(*), COALESCE(MAX(position), -1) FROM character_attributes WHERE character_id = ?",
                (character["id"],),
            ).fetchone()
            if count >= MAX_ATTRIBUTES_PER_CHARACTER:
                raise bad_request(f"A character can have at most {MAX_ATTRIBUTES_PER_CHARACTER} attributes.")
            _insert_attributes(conn, character["id"], [clean], max_pos + 1)
            created = conn.execute("SELECT * FROM character_attributes WHERE id = last_insert_rowid()").fetchone()
        else:
            cols = list(r["columns"].values())
            cur = conn.execute(
                f"INSERT INTO {r['table']} (character_id, {', '.join(cols)}) VALUES (?, {', '.join('?' for _ in cols)})",
                (character["id"], *(clean[f] for f in r["columns"])),
            )
            created = conn.execute(f"SELECT * FROM {r['table']} WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"item": r["to_api"](created)}), 201


@bp.put(f"/<character_id>/{RESOURCE}/<item_id>")
@require_auth
def update_child(character_id, resource, item_id):
    r = CHILD_RESOURCES[resource]
    conn = get_db()
    character = _load_owned_character(conn, character_id)
    child = _load_child(conn, r, character, item_id)
    clean = validate(request_body(), r["spec"])
    sets = ", ".join(f"{c} = ?" for c in r["columns"].values())
    touch = f", updated_at = {NOW_SQL}" if r.get("timestamps") else ""
    conn.execute(
        f"UPDATE {r['table']} SET {sets}{touch} WHERE id = ? AND character_id = ?",
        (*(clean[f] for f in r["columns"]), child["id"], character["id"]),
    )
    return jsonify({"item": r["to_api"](_load_child(conn, r, character, item_id))})


@bp.delete(f"/<character_id>/{RESOURCE}/<item_id>")
@require_auth
def delete_child(character_id, resource, item_id):
    r = CHILD_RESOURCES[resource]
    conn = get_db()
    character = _load_owned_character(conn, character_id)
    child = _load_child(conn, r, character, item_id)
    conn.execute(f"DELETE FROM {r['table']} WHERE id = ? AND character_id = ?", (child["id"], character["id"]))
    return "", 204
