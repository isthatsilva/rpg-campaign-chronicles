-- rpg campaign chronicles schema (shared across versions 1 and 2)
-- foreign keys must be enabled per connection: PRAGMA foreign_keys = ON

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    display_name  TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS plans (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    character_limit INTEGER NOT NULL CHECK (character_limit > 0),
    price_cents     INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    currency        TEXT    NOT NULL DEFAULT 'USD',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id                  TEXT    NOT NULL REFERENCES plans(id),
    status                   TEXT    NOT NULL CHECK (status IN ('active', 'canceled')),
    started_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ends_at                  TEXT,
    -- reserved for a real billing provider; never holds card data
    provider_subscription_id TEXT
);
-- at most one active subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_subscription
    ON subscriptions(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS characters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    species    TEXT,
    role       TEXT,
    level      INTEGER,
    health     INTEGER,
    max_health INTEGER,
    experience INTEGER,
    abilities  TEXT,
    biography  TEXT,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);

CREATE TABLE IF NOT EXISTS character_attributes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    value        TEXT    NOT NULL,
    position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_attributes_character ON character_attributes(character_id);

CREATE TABLE IF NOT EXISTS equipment (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    item_name    TEXT    NOT NULL,
    item_type    TEXT,
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    description  TEXT
);
CREATE INDEX IF NOT EXISTS idx_equipment_character ON equipment(character_id);

CREATE TABLE IF NOT EXISTS journal_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    session_date  TEXT    NOT NULL,
    campaign_name TEXT,
    title         TEXT    NOT NULL,
    attendees     TEXT,
    events        TEXT,
    rewards       TEXT,
    notes         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_journal_character ON journal_entries(character_id);

-- plan catalog (simulated pricing; no real payments)
INSERT OR IGNORE INTO plans (id, name, character_limit, price_cents, sort_order) VALUES
    ('free',       'Free',       10,    0, 1),
    ('adventurer', 'Adventurer', 15,  500, 2),
    ('hero',       'Hero',       25, 1000, 3),
    ('legend',     'Legend',     50, 1500, 4);
