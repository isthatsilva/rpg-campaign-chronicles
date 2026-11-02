import re

from conftest import query, register_user


def test_register_creates_user_on_free_plan_hashes_password_and_logs_in(app):
    client = app.test_client()
    res = client.post("/api/auth/register", json={"email": "  Thorne@Example.COM ", "password": "secret123", "displayName": "Thorne"})
    assert res.status_code == 201
    user = res.get_json()["user"]
    assert user["email"] == "thorne@example.com"
    assert "password_hash" not in user and "passwordHash" not in user
    cookie = res.headers.getlist("Set-Cookie")[0]
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie

    [row] = query(app, "SELECT password_hash FROM users WHERE email = ?", ("thorne@example.com",))
    assert row["password_hash"] != "secret123"
    assert re.match(r"^\$2[aby]\$", row["password_hash"])

    assert client.get("/api/auth/me").status_code == 200
    sub = client.get("/api/subscription").get_json()["subscription"]
    assert sub["plan"]["id"] == "free"
    assert sub["characterLimit"] == 10


def test_duplicate_email_is_rejected_with_409_case_insensitively(app):
    register_user(app, email="dup@example.com")
    res = app.test_client().post("/api/auth/register", json={"email": "DUP@example.com", "password": "password123"})
    assert res.status_code == 409
    assert res.get_json()["error"]["code"] == "EMAIL_TAKEN"


def test_register_validates_email_password_and_display_name(app):
    client = app.test_client()
    res = client.post("/api/auth/register", json={"email": "not-an-email", "password": "short", "displayName": "x" * 51})
    assert res.status_code == 400
    fields = res.get_json()["error"]["fields"]
    assert {"email", "password", "displayName"} <= fields.keys()

    no_digit = client.post("/api/auth/register", json={"email": "a@b.co", "password": "onlyletters"})
    assert no_digit.status_code == 400
    assert "letter and one number" in no_digit.get_json()["error"]["fields"]["password"]

    too_long = client.post("/api/auth/register", json={"email": "a@b.co", "password": "a1" * 40})
    assert too_long.status_code == 400
    assert "72 bytes" in too_long.get_json()["error"]["fields"]["password"]


def test_login_wrong_password_and_unknown_email_give_the_same_401(app):
    register_user(app, email="login@example.com", password="password123")
    client = app.test_client()
    wrong = client.post("/api/auth/login", json={"email": "login@example.com", "password": "nope12345"})
    unknown = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "nope12345"})
    assert wrong.status_code == 401
    assert unknown.status_code == 401
    assert wrong.get_json()["error"]["message"] == unknown.get_json()["error"]["message"]

    assert client.post("/api/auth/login", json={}).status_code == 400
    # over bcrypt's 72-byte limit: a clean 401, not a 500
    assert client.post("/api/auth/login", json={"email": "login@example.com", "password": "x1" * 50}).status_code == 401

    ok = client.post("/api/auth/login", json={"email": "LOGIN@example.com", "password": "password123"})
    assert ok.status_code == 200


def test_logout_destroys_the_session_so_a_replayed_cookie_stops_working(app):
    client = app.test_client()
    client.post("/api/auth/register", json={"email": "out@example.com", "password": "password123"})
    token = client.get_cookie("rcc_session").value
    assert client.post("/api/auth/logout").status_code == 204

    replay = app.test_client()
    replay.set_cookie("rcc_session", token)
    assert replay.get("/api/auth/me").status_code == 401


def test_protected_routes_return_401_without_a_session(app):
    client = app.test_client()
    for method, url in [
        ("get", "/api/auth/me"), ("get", "/api/subscription"), ("put", "/api/subscription"),
        ("get", "/api/characters"), ("post", "/api/characters"), ("get", "/api/characters/1"),
        ("get", "/api/characters/1/journal"), ("delete", "/api/characters/1/equipment/1"),
    ]:
        res = getattr(client, method)(url, json={})
        assert res.status_code == 401, f"{method} {url}"

    forged = app.test_client()
    forged.set_cookie("rcc_session", "deadbeef")
    assert forged.get("/api/characters").status_code == 401


def test_plans_list_is_public_and_has_the_four_tiers(app):
    res = app.test_client().get("/api/plans")
    assert res.status_code == 200
    assert [(p["id"], p["characterLimit"]) for p in res.get_json()["plans"]] == [
        ("free", 10), ("adventurer", 15), ("hero", 25), ("legend", 50),
    ]
