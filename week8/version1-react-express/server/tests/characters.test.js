import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, registerUser, createCharacter } from './helpers.js';

describe('characters and their records', () => {
    test('full character crud with optional, system-neutral fields', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);
        // only a name is required: no race, class or d&d stats needed
        const minimal = await createCharacter(agent, { name: 'Nameless Investigator' });
        assert.equal(minimal.level, null);
        assert.equal(minimal.species, null);

        const created = await createCharacter(agent, {
            name: 'Thorne Ashford', species: 'Human', role: 'Ranger', level: 5, health: 42, maxHealth: 50,
            experience: 1200, abilities: 'Tracking', biography: 'A wandering ranger.',
            attributes: [{ name: 'Strength', value: '14' }, { name: 'Sanity', value: 'Shaken' }],
        });
        const profile = (await agent.get(`/api/characters/${created.id}`)).body.character;
        assert.equal(profile.maxHealth, 50);
        assert.deepEqual(profile.attributes.map((a) => [a.name, a.value]), [['Strength', '14'], ['Sanity', 'Shaken']]);

        const updated = await agent.put(`/api/characters/${created.id}`).send({ ...profile, level: 6, health: 50 });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.character.level, 6);

        assert.equal((await agent.delete(`/api/characters/${created.id}`)).status, 204);
        assert.equal((await agent.get(`/api/characters/${created.id}`)).status, 404);
    });

    test('attribute, equipment and journal crud', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);
        const c = await createCharacter(agent);
        const base = `/api/characters/${c.id}`;

        const attr = (await agent.post(`${base}/attributes`).send({ name: 'Magic', value: '7' })).body.item;
        assert.equal((await agent.put(`${base}/attributes/${attr.id}`).send({ name: 'Magic', value: '9' })).body.item.value, '9');
        assert.equal((await agent.delete(`${base}/attributes/${attr.id}`)).status, 204);
        assert.deepEqual((await agent.get(`${base}/attributes`)).body.items, []);

        const item = (await agent.post(`${base}/equipment`).send({ itemName: 'Healing Potion', itemType: 'Consumable', quantity: 3 })).body.item;
        assert.equal(item.quantity, 3);
        const defaulted = (await agent.post(`${base}/equipment`).send({ itemName: 'Longbow' })).body.item;
        assert.equal(defaulted.quantity, 1);
        assert.equal((await agent.put(`${base}/equipment/${item.id}`).send({ itemName: 'Healing Potion', quantity: 2 })).body.item.quantity, 2);
        assert.equal((await agent.delete(`${base}/equipment/${defaulted.id}`)).status, 204);
        assert.equal((await agent.get(`${base}/equipment`)).body.items.length, 1);

        const entry = (await agent.post(`${base}/journal`).send({
            sessionDate: '2026-10-25', campaignName: 'The Lost Kingdom', title: 'The Forgotten Temple',
            attendees: 'Alex, Sarah, Mike', events: 'Defeated a guardian', rewards: '200 XP', notes: 'Return next session',
        })).status;
        assert.equal(entry, 201);
        const [saved] = (await agent.get(`${base}/journal`)).body.items;
        assert.equal(saved.attendees, 'Alex, Sarah, Mike');
        const edited = await agent.put(`${base}/journal/${saved.id}`).send({ ...saved, title: 'Temple, Part 1' });
        assert.equal(edited.body.item.title, 'Temple, Part 1');
        assert.equal((await agent.delete(`${base}/journal/${saved.id}`)).status, 204);
        assert.equal((await agent.delete(`${base}/journal/${saved.id}`)).status, 404);
    });

    test('deleting a character cascades to attributes, equipment and journal entries', async () => {
        const { app, db } = makeApp();
        const { agent } = await registerUser(app);
        const keep = await createCharacter(agent, { name: 'Keeper', attributes: [{ name: 'Luck', value: '3' }] });
        const c = await createCharacter(agent, { name: 'Doomed', attributes: [{ name: 'Strength', value: '14' }] });
        await agent.post(`/api/characters/${c.id}/equipment`).send({ itemName: 'Sword' });
        await agent.post(`/api/characters/${c.id}/journal`).send({ sessionDate: '2026-10-25', title: 'Last stand' });

        assert.equal((await agent.delete(`/api/characters/${c.id}`)).status, 204);
        for (const table of ['character_attributes', 'equipment', 'journal_entries']) {
            const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE character_id = ?`).get(c.id);
            assert.equal(n, 0, `${table} should be empty for the deleted character`);
        }
        const { n } = db.prepare('SELECT COUNT(*) AS n FROM character_attributes WHERE character_id = ?').get(keep.id);
        assert.equal(n, 1);
    });

    test('validation errors return 400 with per-field messages', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);

        const noName = await agent.post('/api/characters').send({ name: '   ', level: 'abc', maxHealth: -1 });
        assert.equal(noName.status, 400);
        assert.equal(noName.body.error.code, 'VALIDATION_ERROR');
        assert.deepEqual(Object.keys(noName.body.error.fields).sort(), ['level', 'maxHealth', 'name']);

        const badAttr = await agent.post('/api/characters').send({ name: 'Ok', attributes: [{ name: '', value: '1' }] });
        assert.equal(badAttr.status, 400);
        // the failed create must not have used up a slot
        assert.equal((await agent.get('/api/characters')).body.characters.length, 0);

        const c = await createCharacter(agent);
        const base = `/api/characters/${c.id}`;
        assert.equal((await agent.post(`${base}/equipment`).send({ itemName: 'Arrows', quantity: -1 })).status, 400);
        assert.equal((await agent.post(`${base}/equipment`).send({ itemName: 'Arrows', quantity: 1.5 })).status, 400);
        assert.equal((await agent.post(`${base}/attributes`).send({ name: 'Wits' })).status, 400);

        const badJournal = await agent.post(`${base}/journal`).send({ sessionDate: '2026-02-30' });
        assert.equal(badJournal.status, 400);
        assert.ok(badJournal.body.error.fields.sessionDate);
        assert.ok(badJournal.body.error.fields.title);

        assert.equal((await agent.post(`${base}/journal`).send({ sessionDate: '10/25/2026', title: 'x' })).status, 400);
        assert.equal((await agent.post('/api/characters').send({ name: 'x'.repeat(101) })).status, 400);
    });

    test('malformed requests and unknown ids are handled without leaking internals', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);

        const badJson = await agent.post('/api/characters').set('Content-Type', 'application/json').send('{"name": ');
        assert.equal(badJson.status, 400);
        assert.equal(badJson.body.error.code, 'INVALID_JSON');
        assert.equal(JSON.stringify(badJson.body).includes('at '), false);

        const notJson = await agent.post('/api/characters').set('Content-Type', 'text/plain').send('name=x');
        assert.equal(notJson.status, 415);

        assert.equal((await agent.post('/api/characters').send([1, 2])).status, 400);
        assert.equal((await agent.get('/api/characters/abc')).status, 404);
        assert.equal((await agent.get('/api/characters/999999')).status, 404);
        assert.equal((await agent.get('/api/nope')).status, 404);
    });
});
