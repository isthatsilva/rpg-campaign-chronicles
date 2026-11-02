import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from werkzeug.serving import make_server

from conftest import TEST_SECRET, create_character, query, register_user

SERVER_ROOT = Path(__file__).resolve().parent.parent


def test_free_plan_blocks_the_11th_character_with_403(app):
    client, _, _ = register_user(app)
    for i in range(10):
        create_character(client, name=f"Hero {i}")
    res = client.post("/api/characters", json={"name": "One too many"})
    assert res.status_code == 403
    assert res.get_json()["error"]["code"] == "PLAN_LIMIT_REACHED"
    sub = client.get("/api/subscription").get_json()["subscription"]
    assert (sub["characterCount"], sub["remaining"], sub["canCreate"]) == (10, 0, False)


def test_plan_change_validates_the_plan_id_and_keeps_history(app):
    client, user, _ = register_user(app)
    assert client.put("/api/subscription", json={"planId": "platinum"}).status_code == 400
    assert client.put("/api/subscription", json={}).status_code == 400
    assert client.put("/api/subscription", json={"planId": "free"}).status_code == 409

    res = client.put("/api/subscription", json={"planId": "hero"})
    assert res.status_code == 200
    sub = res.get_json()["subscription"]
    assert sub["plan"]["id"] == "hero"
    assert sub["characterLimit"] == 25

    rows = query(app, "SELECT plan_id, status FROM subscriptions WHERE user_id = ? ORDER BY id", (user["id"],))
    assert [(r["plan_id"], r["status"]) for r in rows] == [("free", "canceled"), ("hero", "active")]


def test_downgrade_keeps_characters_blocks_new_ones_and_still_allows_editing(app):
    client, _, _ = register_user(app)
    client.put("/api/subscription", json={"planId": "adventurer"})
    chars = [create_character(client, name=f"Hero {i}") for i in range(12)]

    down = client.put("/api/subscription", json={"planId": "free"})
    assert down.status_code == 200
    sub = down.get_json()["subscription"]
    assert sub["overLimit"] is True
    assert sub["characterCount"] == 12

    assert len(client.get("/api/characters").get_json()["characters"]) == 12
    assert client.post("/api/characters", json={"name": "Blocked"}).status_code == 403
    assert client.put(f"/api/characters/{chars[0]['id']}", json={"name": "Renamed"}).status_code == 200
    assert client.post(f"/api/characters/{chars[0]['id']}/journal",
                       json={"sessionDate": "2026-10-25", "title": "Still journaling"}).status_code == 201

    # delete down to 9 and creation works again
    for c in chars[:3]:
        client.delete(f"/api/characters/{c['id']}")
    assert client.post("/api/characters", json={"name": "Allowed"}).status_code == 201


def _post_json(url, body, cookie=None):
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, res.headers.get("Set-Cookie")
    except urllib.error.HTTPError as err:
        return err.code, None


def _race(urls, cookie, attempts):
    with ThreadPoolExecutor(max_workers=attempts) as pool:
        futures = [
            pool.submit(_post_json, f"{urls[i % len(urls)]}/api/characters", {"name": f"Racer {i}"}, cookie)
            for i in range(attempts)
        ]
        return [f.result()[0] for f in futures]


def test_parallel_creates_on_the_threaded_server_never_exceed_the_limit(app):
    # unlike version 1's single-threaded node process, flask serves each request on its own
    # thread with its own sqlite connection, so these requests really do run at the same time
    server = make_server("127.0.0.1", 0, app, threaded=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        status, set_cookie = _post_json(f"{base}/api/auth/register", {"email": "threads@example.com", "password": "password123"})
        assert status == 201
        cookie = set_cookie.split(";")[0]
        for i in range(8):
            assert _post_json(f"{base}/api/characters", {"name": f"Hero {i}"}, cookie)[0] == 201

        statuses = _race([base], cookie, 10)
        assert statuses.count(201) == 2, statuses
        assert statuses.count(403) == 8, statuses
    finally:
        server.shutdown()
    [[n]] = query(app, "SELECT COUNT(*) FROM characters")
    assert n == 10


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_until_up(base, proc, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"server exited early: {proc.stderr.read().decode()}")
        try:
            with urllib.request.urlopen(f"{base}/api/plans", timeout=1):
                return
        except OSError:
            time.sleep(0.1)
    raise TimeoutError(f"server at {base} did not start")


def test_parallel_creates_across_two_server_processes_sharing_one_database_never_exceed_the_limit(tmp_path):
    db_path = tmp_path / "race.db"
    ports = [_free_port(), _free_port()]
    env = {**os.environ, "DATABASE_PATH": str(db_path), "SESSION_SECRET": TEST_SECRET, "BCRYPT_ROUNDS": "4"}
    # both processes start at the same moment against a brand-new database file, which also
    # exercises the BEGIN IMMEDIATE schema setup and the wal retry in db.py
    procs = [
        subprocess.Popen([sys.executable, "run.py"], cwd=SERVER_ROOT, env={**env, "PORT": str(port)},
                         stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for port in ports
    ]
    bases = [f"http://127.0.0.1:{port}" for port in ports]
    try:
        for base, proc in zip(bases, procs):
            _wait_until_up(base, proc)
        status, set_cookie = _post_json(f"{bases[0]}/api/auth/register", {"email": "race@example.com", "password": "password123"})
        assert status == 201
        cookie = set_cookie.split(";")[0]

        statuses = _race(bases, cookie, 24)
        assert statuses.count(201) == 10, statuses
        assert statuses.count(403) == 14, statuses
    finally:
        for proc in procs:
            proc.terminate()
            proc.wait(timeout=10)
            proc.stderr.close()
