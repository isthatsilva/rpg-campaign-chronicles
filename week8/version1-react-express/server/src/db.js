import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export function openDatabase(databasePath) {
    if (databasePath !== ':memory:') {
        fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    }
    const db = new DatabaseSync(databasePath);
    // sqlite leaves foreign keys off by default, which would silently skip ON DELETE CASCADE
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    // the transaction makes a second process starting at the same moment wait instead of
    // racing us through CREATE TABLE / INSERT
    withWriteTransaction(db, () => {
        db.exec(fs.readFileSync(schemaPath, 'utf8'));
        runMigrations(db);
    });
    if (databasePath !== ':memory:') enableWal(db);
    return db;
}

// one-time data migrations, tracked in sqlite's user_version so each runs once per database file.
// (a character whose owner later removes every attribute must not get the defaults back on restart.)
const BACKFILL_DND_DEFAULTS = `
    INSERT INTO character_attributes (character_id, name, value, position)
    SELECT c.id, d.name, '10', d.position
    FROM characters c
    CROSS JOIN (SELECT 'Strength' AS name, 0 AS position UNION ALL SELECT 'Dexterity', 1
                UNION ALL SELECT 'Constitution', 2 UNION ALL SELECT 'Intelligence', 3
                UNION ALL SELECT 'Wisdom', 4 UNION ALL SELECT 'Charisma', 5) d
    WHERE NOT EXISTS (SELECT 1 FROM character_attributes a WHERE a.character_id = c.id)
    ORDER BY c.id, d.position`;

function runMigrations(db) {
    const { user_version: version } = db.prepare('PRAGMA user_version').get();
    if (version < 1) {
        // 1: characters created before the form prefilled the d&d defaults get them once
        db.exec(BACKFILL_DND_DEFAULTS);
        db.exec('PRAGMA user_version = 1');
    }
}

// switching to wal ignores busy_timeout, so retry briefly if another process holds the file.
// the mode is stored in the database file, so once any process succeeds it sticks for all.
function enableWal(db) {
    for (let attempt = 0; attempt < 50; attempt++) {
        try {
            db.exec('PRAGMA journal_mode = WAL');
            return;
        } catch (err) {
            if (err.errcode !== 5) throw err; // 5 = SQLITE_BUSY
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
    }
    console.warn('could not enable WAL mode; continuing with the default journal mode');
}

// runs fn inside a write transaction. BEGIN IMMEDIATE grabs the write lock up front,
// so a "count then insert" inside fn can't race with another writer.
export function withWriteTransaction(db, fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}
