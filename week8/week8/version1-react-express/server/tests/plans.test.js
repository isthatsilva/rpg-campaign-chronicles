import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeApp, registerUser, createCharacter, TEST_SECRET } from './helpers.js';

const serverEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/server.js');

describe('plans and character limits', () => {
    test('free plan blocks the 11th character with 403', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);
        for (let i = 0; i < 10; i++) await createCharacter(agent, { name: `Hero ${i}` });
        const res = await agent.post('/api/characters').send({ name: 'One too many' });
        assert.equal(res.status, 403);
        assert.equal(res.body.error.code, 'PLAN_LIMIT_REACHED');
        const sub = (await agent.get('/api/subscription')).body.subscription;
        assert.equal(sub.characterCount, 10);
        assert.equal(sub.remaining, 0);
        assert.equal(sub.canCreate, false);
    });

    test('plan change validates the plan id and keeps history', async () => {
        const { app, db } = makeApp();
        const { agent, user } = await registerUser(app);
        assert.equal((await agent.put('/api/subscription').send({ planId: 'platinum' })).status, 400);
        assert.equal((await agent.put('/api/subscription').send({})).status, 400);
        assert.equal((await agent.put('/api/subscription').send({ planId: 'free' })).status, 409);

        const res = await agent.put('/api/subscription').send({ planId: 'hero' });
        assert.equal(res.status, 200);
        assert.equal(res.body.subscription.plan.id, 'hero');
        assert.equal(res.body.subscription.characterLimit, 25);

        const rows = db.prepare('SELECT plan_id, status FROM subscriptions WHERE user_id = ? ORDER BY id').all(user.id);
        assert.deepEqual(rows.map((r) => [r.plan_id, r.status]), [['free', 'canceled'], ['hero', 'active']]);
    });

    test('downgrade keeps existing characters, blocks new ones, and still allows editing', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);
        await agent.put('/api/subscription').send({ planId: 'adventurer' });
        const chars = [];
        for (let i = 0; i < 12; i++) chars.push(await createCharacter(agent, { name: `Hero ${i}` }));

        const down = await agent.put('/api/subscription').send({ planId: 'free' });
        assert.equal(down.status, 200);
        assert.equal(down.body.subscription.overLimit, true);
        assert.equal(down.body.subscription.characterCount, 12);

        assert.equal((await agent.get('/api/characters')).body.characters.length, 12);
        assert.equal((await agent.post('/api/characters').send({ name: 'Blocked' })).status, 403);
        assert.equal((await agent.put(`/api/characters/${chars[0].id}`).send({ name: 'Renamed' })).status, 200);
        assert.equal((await agent.post(`/api/characters/${chars[0].id}/journal`)
            .send({ sessionDate: '2026-10-25', title: 'Still journaling' })).status, 201);

        // delete down to 9 and creation works again
        for (const c of chars.slice(0, 3)) await agent.delete(`/api/characters/${c.id}`);
        assert.equal((await agent.post('/api/characters').send({ name: 'Allowed' })).status, 201);
    });

    test('parallel creates in one process never exceed the limit', async () => {
        const { app } = makeApp();
        const { agent } = await registerUser(app);
        for (let i = 0; i < 8; i++) await createCharacter(agent, { name: `Hero ${i}` });
        const results = await Promise.all(
            Array.from({ length: 10 }, (_, i) => agent.post('/api/characters').send({ name: `Race ${i}` })),
        );
        const statuses = results.map((r) => r.status);
        assert.equal(statuses.filter((s) => s === 201).length, 2);
        assert.equal(statuses.filter((s) => s === 403).length, 8);
        assert.equal((await agent.get('/api/characters')).body.characters.length, 10);
    });

    // node:sqlite is synchronous, so inside one process requests can't truly interleave.
    // this runs two separate server processes against the same database file so the
    // count + insert really does race, and checks BEGIN IMMEDIATE still holds the line.
    test('parallel creates across two server processes sharing one database never exceed the limit', { timeout: 30000 }, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcc-race-'));
        const dbPath = path.join(dir, 'race.db');
        const ports = [4600 + Math.floor(Math.random() * 300), 4950 + Math.floor(Math.random() * 300)];
        const procs = ports.map((port) => spawn(process.execPath, [serverEntry], {
            env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, SESSION_SECRET: TEST_SECRET, BCRYPT_ROUNDS: '4' },
            stdio: ['ignore', 'pipe', 'pipe'],
        }));
        try {
            await Promise.all(procs.map((p) => new Promise((resolve, reject) => {
                let stderr = '';
                p.stderr.on('data', (d) => { stderr += d; });
                p.stdout.on('data', (d) => { if (String(d).includes('listening')) resolve(); });
                p.on('exit', (code) => reject(new Error(`server exited early with ${code}: ${stderr}`)));
            })));

            const reg = await fetch(`http://localhost:${ports[0]}/api/auth/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'race@example.com', password: 'password123' }),
            });
            assert.equal(reg.status, 201);
            const cookie = reg.headers.get('set-cookie').split(';')[0];

            const attempts = Array.from({ length: 24 }, (_, i) => fetch(`http://localhost:${ports[i % 2]}/api/characters`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ name: `Racer ${i}` }),
            }));
            const statuses = (await Promise.all(attempts)).map((r) => r.status);
            assert.equal(statuses.filter((s) => s === 201).length, 10, `statuses: ${statuses}`);
            assert.equal(statuses.filter((s) => s === 403).length, 14, `statuses: ${statuses}`);

            const list = await fetch(`http://localhost:${ports[1]}/api/characters`, { headers: { Cookie: cookie } });
            assert.equal((await list.json()).characters.length, 10);
        } finally {
            procs.forEach((p) => p.kill());
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
