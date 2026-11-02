import re
from datetime import date

from .errors import bad_request

EMAIL_RE = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
INT_RE = re.compile(r"-?[0-9]+")
MAX_SAFE_INTEGER = 2**53 - 1


def _is_blank(value):
    return value is None or (isinstance(value, str) and value.strip() == "")


def _check_string(value, rule):
    if not isinstance(value, str):
        return None, f"{rule['label']} must be text."
    trimmed = value.strip()
    if rule.get("max") and len(trimmed) > rule["max"]:
        return None, f"{rule['label']} must be at most {rule['max']} characters."
    return trimmed, None


def _check_int(value, rule):
    n = value
    if isinstance(value, str) and INT_RE.fullmatch(value.strip()):
        n = int(value.strip())
    # json 5.0 means 5 (javascript can't tell them apart either); bool is an int subclass in python
    if isinstance(n, float) and n.is_integer():
        n = int(n)
    if isinstance(n, bool) or not isinstance(n, int):
        return None, f"{rule['label']} must be a whole number."
    if "min" in rule and n < rule["min"]:
        return None, f"{rule['label']} must be at least {rule['min']}."
    if "max" in rule and n > rule["max"]:
        return None, f"{rule['label']} must be at most {rule['max']}."
    return n, None


def _check_date(value, rule):
    if not isinstance(value, str) or not DATE_RE.fullmatch(value.strip()):
        return None, f"{rule['label']} must be a date in YYYY-MM-DD format."
    trimmed = value.strip()
    try:
        # rejects things like 2026-02-30
        date.fromisoformat(trimmed)
    except ValueError:
        return None, f"{rule['label']} is not a real calendar date."
    return trimmed, None


def _check_email(value, rule):
    trimmed, error = _check_string(value, rule)
    if error:
        return None, error
    email = trimmed.lower()
    if not EMAIL_RE.fullmatch(email):
        return None, f"{rule['label']} must be a valid email address."
    return email, None


_CHECKERS = {"string": _check_string, "int": _check_int, "date": _check_date, "email": _check_email}


def validate(body, spec):
    """validates body against a spec like {"name": {"type": "string", "required": True, "max": 100, "label": "Name"}}.

    returns a clean dict (missing optional fields become None) or raises a 400 with per-field messages.
    """
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object.")
    clean = {}
    fields = {}
    for key, rule in spec.items():
        raw = body.get(key)
        if _is_blank(raw):
            if rule.get("required"):
                fields[key] = f"{rule['label']} is required."
            else:
                clean[key] = rule.get("default")
            continue
        value, error = _CHECKERS[rule["type"]](raw, rule)
        if error:
            fields[key] = error
        else:
            clean[key] = value
    if fields:
        raise bad_request("Please fix the highlighted fields.", fields)
    return clean


def check_password(password):
    """8+ characters, at least one letter and one number, and at most 72 bytes (bcrypt's input limit)."""
    if not isinstance(password, str) or password == "":
        return "Password is required."
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if len(password.encode("utf-8")) > 72:
        return "Password must be at most 72 bytes long."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        return "Password must include at least one letter and one number."
    return None


def parse_id(raw):
    if isinstance(raw, str) and re.fullmatch(r"[0-9]+", raw) and int(raw) <= MAX_SAFE_INTEGER:
        return int(raw)
    return None


# field specs shared by the routes (and mirrored by the frontend forms); identical to version 1
CHARACTER_SPEC = {
    "name": {"type": "string", "required": True, "max": 100, "label": "Name"},
    "species": {"type": "string", "max": 100, "label": "Species"},
    "role": {"type": "string", "max": 100, "label": "Role"},
    "level": {"type": "int", "min": 0, "max": 10000, "label": "Level"},
    "health": {"type": "int", "min": -1000000, "max": 1000000, "label": "Health"},
    "maxHealth": {"type": "int", "min": 0, "max": 1000000, "label": "Max health"},
    "experience": {"type": "int", "min": 0, "max": 1000000000, "label": "Experience"},
    "abilities": {"type": "string", "max": 5000, "label": "Powers & abilities"},
    "biography": {"type": "string", "max": 5000, "label": "Biography"},
}

ATTRIBUTE_SPEC = {
    "name": {"type": "string", "required": True, "max": 50, "label": "Attribute name"},
    "value": {"type": "string", "required": True, "max": 100, "label": "Attribute value"},
}

EQUIPMENT_SPEC = {
    "itemName": {"type": "string", "required": True, "max": 100, "label": "Item name"},
    "itemType": {"type": "string", "max": 50, "label": "Item type"},
    "quantity": {"type": "int", "min": 0, "max": 1000000, "label": "Quantity", "default": 1},
    "description": {"type": "string", "max": 1000, "label": "Description"},
}

JOURNAL_SPEC = {
    "sessionDate": {"type": "date", "required": True, "label": "Session date"},
    "title": {"type": "string", "required": True, "max": 150, "label": "Session title"},
    "campaignName": {"type": "string", "max": 100, "label": "Campaign name"},
    "attendees": {"type": "string", "max": 500, "label": "Players attending"},
    "events": {"type": "string", "max": 5000, "label": "Important events"},
    "rewards": {"type": "string", "max": 2000, "label": "Rewards"},
    "notes": {"type": "string", "max": 5000, "label": "Notes"},
}

REGISTER_SPEC = {
    "email": {"type": "email", "required": True, "max": 254, "label": "Email"},
    "displayName": {"type": "string", "max": 50, "label": "Display name"},
}

MAX_ATTRIBUTES_PER_CHARACTER = 50
