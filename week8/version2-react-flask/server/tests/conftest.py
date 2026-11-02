import itertools

import pytest

from app import create_app

TEST_SECRET = "test-secret-that-is-long-enough"
_counter = itertools.count(1)


@pytest.fixture
def make_app(tmp_path):
    """returns a factory for a fresh app with its own temporary database file."""
    apps = itertools.count(1)

    def factory():
        return create_app({
            "session_secret": TEST_SECRET,
            "bcrypt_rounds": 4,
            "database_path": str(tmp_path / f"test{next(apps)}.db"),
        })

    return factory


@pytest.fixture
def app(make_app):
    return make_app()


def register_user(app, **overrides):
    """registers a fresh user and returns (client, user, password); the client keeps its session cookie."""
    n = next(_counter)
    client = app.test_client()
    body = {"email": f"user{n}@example.com", "password": "password123", "displayName": f"User {n}", **overrides}
    res = client.post("/api/auth/register", json=body)
    assert res.status_code == 201, res.get_json()
    return client, res.get_json()["user"], body["password"]


def create_character(client, **body):
    res = client.post("/api/characters", json={"name": "Thorne Ashford", **body})
    assert res.status_code == 201, res.get_json()
    return res.get_json()["character"]


def query(app, sql, params=()):
    from app.db import connect

    conn = connect(app.config["RCC"]["database_path"])
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()
