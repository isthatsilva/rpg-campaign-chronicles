import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db.js';

const DND = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
const attributesOf = (db, id) => db.prepare('SELECT name, value FROM character_attributes WHERE character_id = ? ORDER BY position, id').all(id)
    .map((a) => `${a.name}=${a.value}`);

describe('database migrations', () => {
    test('existing characters without attributes get the d&d defaults once, and only once', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcc-migrate-'));
        const file = path.join(dir, 'app.db');

        // build a database as it looked before the migration existed (user_version 0)
        let db = openDatabase(file);
        const userId = db.prepare("INSERT INTO users (email, password_hash) VALUES ('old@example.com', 'x')").run().lastInsertRowid;
        const add = db.prepare('INSERT INTO characters (user_id, name) VALUES (?, ?)');
        const empty = add.run(userId, 'Empty Hero').lastInsertRowid;
        const custom = add.run(userId, 'Custom Hero').lastInsertRowid;
        db.prepare("INSERT INTO character_attributes (character_id, name, value, position) VALUES (?, 'Sanity', 'Shaken', 0)").run(custom);
        db.exec('PRAGMA user_version = 0');
        db.close();

        db = openDatabase(file);
        assert.deepEqual(attributesOf(db, empty), DND.map((n) => `${n}=10`));
        assert.deepEqual(attributesOf(db, custom), ['Sanity=Shaken'], 'characters that already have attributes are untouched');
        assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);

        // the user removes every attribute: restarting must not bring the defaults back
        db.prepare('DELETE FROM character_attributes WHERE character_id = ?').run(empty);
        db.close();
        db = openDatabase(file);
        assert.deepEqual(attributesOf(db, empty), []);
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
