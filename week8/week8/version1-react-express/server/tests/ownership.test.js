import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, registerUser, createCharacter } from './helpers.js';

describe('ownership isolation', () => {
    test("a user can't read, change or delete another user's characters or their records", async () => {
        const { app, db } = makeApp();
        const alice = await registerUser(app);
        const bob = await registerUser(app);

        const aliceChar = await createCharacter(alice.agent, { name: 'Alice Hero', attributes: [{ name: 'Sanity', value: '50' }] });
        const item = (await alice.agent.post(`/api/characters/${aliceChar.id}/equipment`).send({ itemName: 'Sword' })).body.item;
        const entry = (await alice.agent.post(`/api/characters/${aliceChar.id}/journal`)
            .send({ sessionDate: '2026-10-25', title: 'The Forgotten Temple' })).body.item;
        const attrId = db.prepare('SELECT id FROM character_attributes WHERE character_id = ?').get(aliceChar.id).id;

        const bobChar = await createCharacter(bob.agent, { name: 'Bob Hero' });

        // list only shows your own
        const list = await bob.agent.get('/api/characters');
        assert.deepEqual(list.body.characters.map((c) => c.name), ['Bob Hero']);

        // direct access by guessed id -> 404 (doesn't even reveal that the id exists)
        const base = `/api/characters/${aliceChar.id}`;
        assert.equal((await bob.agent.get(base)).status, 404);
        assert.equal((await bob.agent.put(base).send({ name: 'Hacked' })).status, 404);
        assert.equal((await bob.agent.delete(base)).status, 404);
        for (const path of ['attributes', 'equipment', 'journal']) {
            assert.equal((await bob.agent.get(`${base}/${path}`)).status, 404, `GET ${path}`);
        }
        assert.equal((await bob.agent.post(`${base}/equipment`).send({ itemName: 'Planted' })).status, 404);
        assert.equal((await bob.agent.put(`${base}/equipment/${item.id}`).send({ itemName: 'Stolen' })).status, 404);
        assert.equal((await bob.agent.delete(`${base}/journal/${entry.id}`)).status, 404);

        // mixing bob's own character id with alice's child ids must not work either
        const mixed = `/api/characters/${bobChar.id}`;
        assert.equal((await bob.agent.put(`${mixed}/equipment/${item.id}`).send({ itemName: 'Stolen' })).status, 404);
        assert.equal((await bob.agent.delete(`${mixed}/journal/${entry.id}`)).status, 404);
        assert.equal((await bob.agent.put(`${mixed}/attributes/${attrId}`).send({ name: 'X', value: '1' })).status, 404);

        // alice's data is untouched
        const after = await alice.agent.get(base);
        assert.equal(after.body.character.name, 'Alice Hero');
        assert.equal(after.body.character.equipment[0].itemName, 'Sword');
        assert.equal(after.body.character.journalEntries.length, 1);
        assert.equal(after.body.character.attributes[0].name, 'Sanity');
    });

    test('journals are per character, even for the same campaign', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);
        const a = await createCharacter(agent, { name: 'Thorne' });
        const b = await createCharacter(agent, { name: 'Mira' });
        await agent.post(`/api/characters/${a.id}/journal`)
            .send({ sessionDate: '2026-10-25', title: 'The Forgotten Temple', campaignName: 'The Lost Kingdom' });
        const bJournal = await agent.get(`/api/characters/${b.id}/journal`);
        assert.deepEqual(bJournal.body.items, []);
    });
});
