import { Router } from 'express';
import { withWriteTransaction } from '../db.js';
import { HttpError, badRequest, notFound } from '../errors.js';
import { requireAuth } from '../auth.js';
import {
    validate, parseId, characterSpec, attributeSpec, equipmentSpec, journalSpec, MAX_ATTRIBUTES_PER_CHARACTER,
} from '../validation.js';

// api field name -> database column, per resource
const characterColumns = {
    name: 'name', species: 'species', role: 'role', level: 'level', health: 'health',
    maxHealth: 'max_health', experience: 'experience', abilities: 'abilities', biography: 'biography',
};
const attributeColumns = { name: 'name', value: 'value' };
const equipmentColumns = { itemName: 'item_name', itemType: 'item_type', quantity: 'quantity', description: 'description' };
const journalColumns = {
    sessionDate: 'session_date', title: 'title', campaignName: 'campaign_name', attendees: 'attendees',
    events: 'events', rewards: 'rewards', notes: 'notes',
};

function rowMapper(columns, extra = {}) {
    return (row) => {
        const out = { id: row.id };
        for (const [field, column] of Object.entries(columns)) out[field] = row[column];
        for (const [field, column] of Object.entries(extra)) out[field] = row[column];
        return out;
    };
}

const toCharacter = rowMapper(characterColumns, { createdAt: 'created_at', updatedAt: 'updated_at' });
const toAttribute = rowMapper(attributeColumns);
const toEquipment = rowMapper(equipmentColumns);
const toJournal = rowMapper(journalColumns, { createdAt: 'created_at', updatedAt: 'updated_at' });

const childResources = {
    attributes: { table: 'character_attributes', columns: attributeColumns, spec: attributeSpec, toApi: toAttribute, order: 'position, id', label: 'Attribute' },
    equipment: { table: 'equipment', columns: equipmentColumns, spec: equipmentSpec, toApi: toEquipment, order: 'item_name COLLATE NOCASE, id', label: 'Item' },
    journal: { table: 'journal_entries', columns: journalColumns, spec: journalSpec, toApi: toJournal, order: 'session_date DESC, id DESC', label: 'Journal entry', timestamps: true },
};

function validateAttributeList(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) throw badRequest('Attributes must be a list.', { attributes: 'Attributes must be a list.' });
    if (list.length > MAX_ATTRIBUTES_PER_CHARACTER) {
        throw badRequest(`A character can have at most ${MAX_ATTRIBUTES_PER_CHARACTER} attributes.`, { attributes: 'Too many attributes.' });
    }
    return list.map((item, i) => {
        try {
            return validate(item, attributeSpec);
        } catch (err) {
            const first = err.fields ? Object.values(err.fields)[0] : err.message;
            throw badRequest(`Attribute #${i + 1}: ${first}`, { attributes: `Attribute #${i + 1}: ${first}` });
        }
    });
}

export function charactersRouter(db) {
    const router = Router();
    router.use(requireAuth);

    // every lookup below is scoped by user_id, so another user's id simply isn't found (404, not 403)
    const findOwned = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?');

    function loadOwnedCharacter(req) {
        const id = parseId(req.params.characterId);
        const row = id && findOwned.get(id, req.user.id);
        if (!row) throw notFound('Character not found.');
        return row;
    }

    function insertAttributes(characterId, attributes, startPosition = 0) {
        const insert = db.prepare('INSERT INTO character_attributes (character_id, name, value, position) VALUES (?, ?, ?, ?)');
        attributes.forEach((attr, i) => insert.run(characterId, attr.name, attr.value, startPosition + i));
    }

    router.get('/', (req, res) => {
        const rows = db.prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY name COLLATE NOCASE, id').all(req.user.id);
        res.json({ characters: rows.map(toCharacter) });
    });

    router.post('/', (req, res) => {
        const clean = validate(req.body ?? {}, characterSpec);
        const attributes = validateAttributeList(req.body?.attributes);

        const created = withWriteTransaction(db, () => {
            // count and insert in one write transaction so parallel requests can't both squeeze under the limit
            const { character_limit: limit, name: planName } = db.prepare(`
                SELECT p.character_limit, p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id
                WHERE s.user_id = ? AND s.status = 'active'`).get(req.user.id);
            const { count } = db.prepare('SELECT COUNT(*) AS count FROM characters WHERE user_id = ?').get(req.user.id);
            if (count >= limit) {
                throw new HttpError(403, 'PLAN_LIMIT_REACHED',
                    `Your ${planName} plan allows ${limit} characters and you have ${count}. Delete a character or upgrade your plan to create another.`);
            }
            const cols = Object.values(characterColumns);
            const { lastInsertRowid } = db.prepare(
                `INSERT INTO characters (user_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`,
            ).run(req.user.id, ...Object.keys(characterColumns).map((f) => clean[f]));
            insertAttributes(lastInsertRowid, attributes);
            return db.prepare('SELECT * FROM characters WHERE id = ?').get(lastInsertRowid);
        });
        res.status(201).json({ character: toCharacter(created) });
    });

    router.get('/:characterId', (req, res) => {
        const row = loadOwnedCharacter(req);
        const children = {};
        for (const [key, r] of Object.entries(childResources)) {
            children[key] = db.prepare(`SELECT * FROM ${r.table} WHERE character_id = ? ORDER BY ${r.order}`).all(row.id).map(r.toApi);
        }
        res.json({
            character: {
                ...toCharacter(row),
                attributes: children.attributes,
                equipment: children.equipment,
                journalEntries: children.journal,
            },
        });
    });

    router.put('/:characterId', (req, res) => {
        const row = loadOwnedCharacter(req);
        const clean = validate(req.body ?? {}, characterSpec);
        const sets = Object.values(characterColumns).map((c) => `${c} = ?`).join(', ');
        db.prepare(`UPDATE characters SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ?`)
            .run(...Object.keys(characterColumns).map((f) => clean[f]), row.id, req.user.id);
        res.json({ character: toCharacter(findOwned.get(row.id, req.user.id)) });
    });

    router.delete('/:characterId', (req, res) => {
        const row = loadOwnedCharacter(req);
        // attributes, equipment and journal entries go with it via ON DELETE CASCADE
        db.prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(row.id, req.user.id);
        res.status(204).end();
    });

    // generic crud for the three per-character child resources
    for (const [path, r] of Object.entries(childResources)) {
        const fields = Object.keys(r.columns);
        const cols = Object.values(r.columns);
        const findChild = db.prepare(`SELECT * FROM ${r.table} WHERE id = ? AND character_id = ?`);
        const touch = r.timestamps ? ", updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : '';

        function loadChild(req, character) {
            const id = parseId(req.params.itemId);
            const row = id && findChild.get(id, character.id);
            if (!row) throw notFound(`${r.label} not found.`);
            return row;
        }

        router.get(`/:characterId/${path}`, (req, res) => {
            const character = loadOwnedCharacter(req);
            const rows = db.prepare(`SELECT * FROM ${r.table} WHERE character_id = ? ORDER BY ${r.order}`).all(character.id);
            res.json({ items: rows.map(r.toApi) });
        });

        router.post(`/:characterId/${path}`, (req, res) => {
            const character = loadOwnedCharacter(req);
            const clean = validate(req.body ?? {}, r.spec);
            const created = withWriteTransaction(db, () => {
                if (path === 'attributes') {
                    const { count, maxPos } = db.prepare('SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS maxPos FROM character_attributes WHERE character_id = ?').get(character.id);
                    if (count >= MAX_ATTRIBUTES_PER_CHARACTER) {
                        throw badRequest(`A character can have at most ${MAX_ATTRIBUTES_PER_CHARACTER} attributes.`);
                    }
                    insertAttributes(character.id, [clean], maxPos + 1);
                    return db.prepare('SELECT * FROM character_attributes WHERE id = last_insert_rowid()').get();
                }
                const { lastInsertRowid } = db.prepare(
                    `INSERT INTO ${r.table} (character_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`,
                ).run(character.id, ...fields.map((f) => clean[f]));
                return db.prepare(`SELECT * FROM ${r.table} WHERE id = ?`).get(lastInsertRowid);
            });
            res.status(201).json({ item: r.toApi(created) });
        });

        router.put(`/:characterId/${path}/:itemId`, (req, res) => {
            const character = loadOwnedCharacter(req);
            const child = loadChild(req, character);
            const clean = validate(req.body ?? {}, r.spec);
            db.prepare(`UPDATE ${r.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${touch} WHERE id = ? AND character_id = ?`)
                .run(...fields.map((f) => clean[f]), child.id, character.id);
            res.json({ item: r.toApi(findChild.get(child.id, character.id)) });
        });

        router.delete(`/:characterId/${path}/:itemId`, (req, res) => {
            const character = loadOwnedCharacter(req);
            const child = loadChild(req, character);
            db.prepare(`DELETE FROM ${r.table} WHERE id = ? AND character_id = ?`).run(child.id, character.id);
            res.status(204).end();
        });
    }

    return router;
}
