import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import current_app, g

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def connect(database_path):
    # isolation_level=None turns off python's implicit transactions, so BEGIN/COMMIT are ours.
    # timeout sets sqlite's busy timeout: a writer waits up to 5s for the lock instead of failing.
    conn = sqlite3.connect(database_path, timeout=5, isolation_level=None)
    conn.row_factory = sqlite3.Row
    # sqlite leaves foreign keys off by default, which would silently skip ON DELETE CASCADE
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_database(database_path):
    Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    conn = connect(database_path)
    try:
        # BEGIN IMMEDIATE makes a second process starting at the same moment wait instead of
        # racing us through CREATE TABLE / INSERT. it's part of the script because executescript
        # commits any transaction that was opened before it.
        try:
            conn.executescript("BEGIN IMMEDIATE;\n" + SCHEMA_PATH.read_text() + "\nCOMMIT;")
        except Exception:
            if conn.in_transaction:
                conn.execute("ROLLBACK")
            raise
        with write_transaction(conn):
            _run_migrations(conn)
        _enable_wal(conn)
    finally:
        conn.close()


# one-time data migrations, tracked in sqlite's user_version so each runs once per database file.
# (a character whose owner later removes every attribute must not get the defaults back on restart.)
BACKFILL_DND_DEFAULTS = """
    INSERT INTO character_attributes (character_id, name, value, position)
    SELECT c.id, d.name, '10', d.position
    FROM characters c
    CROSS JOIN (SELECT 'Strength' AS name, 0 AS position UNION ALL SELECT 'Dexterity', 1
                UNION ALL SELECT 'Constitution', 2 UNION ALL SELECT 'Intelligence', 3
                UNION ALL SELECT 'Wisdom', 4 UNION ALL SELECT 'Charisma', 5) d
    WHERE NOT EXISTS (SELECT 1 FROM character_attributes a WHERE a.character_id = c.id)
    ORDER BY c.id, d.position"""


def _run_migrations(conn):
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version < 1:
        # 1: characters created before the form prefilled the d&d defaults get them once
        conn.execute(BACKFILL_DND_DEFAULTS)
        conn.execute("PRAGMA user_version = 1")


# switching to wal ignores the busy timeout, so retry briefly if another process holds the file.
# the mode is stored in the database file, so once any process succeeds it sticks for all.
def _enable_wal(conn):
    for _ in range(50):
        try:
            conn.execute("PRAGMA journal_mode = WAL")
            return
        except sqlite3.OperationalError as err:
            if "locked" not in str(err) and "busy" not in str(err):
                raise
            time.sleep(0.1)
    print("could not enable WAL mode; continuing with the default journal mode")


def get_db():
    # one connection per request: sqlite connections must not be shared across the server's threads
    if "db" not in g:
        g.db = connect(current_app.config["RCC"]["database_path"])
    return g.db


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


@contextmanager
def write_transaction(conn):
    # BEGIN IMMEDIATE grabs the write lock up front, so a "count then insert" inside the
    # block can't race with another writer (another thread or another process)
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


def iso_now(delta=None):
    # same format as javascript's toISOString(), so timestamps match version 1 and compare as text
    moment = datetime.now(timezone.utc) + (delta or timedelta())
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")
