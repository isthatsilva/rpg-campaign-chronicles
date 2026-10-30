import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeApp, registerUser } from './helpers.js';

describe('auth', () => {
    test('register creates a user on the free plan, hashes the password, and logs in', async () => {
        const { app, db } = makeApp();
        const agent = request.agent(app);
        const res = await agent.post('/api/auth/register')
            .send({ email: '  Thorne@Example.COM ', password: 'secret123', displayName: 'Thorne' });
        assert.equal(res.status, 201);
        assert.equal(res.body.user.email, 'thorne@example.com');
        assert.equal(res.body.user.password_hash, undefined);
        const cookie = res.headers['set-cookie'][0];
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);

        const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('thorne@example.com');
        assert.notEqual(row.password_hash, 'secret123');
        assert.match(row.password_hash, /^\$2[aby]\$/);

        const me = await agent.get('/api/auth/me');
        assert.equal(me.status, 200);
        const sub = await agent.get('/api/subscription');
        assert.equal(sub.body.subscription.plan.id, 'free');
        assert.equal(sub.body.subscription.characterLimit, 10);
    });

    test('duplicate email is rejected with 409, case-insensitively', async () => {
        const { app } = makeApp();
        await registerUser(app, { email: 'dup@example.com' });
        const res = await request(app).post('/api/auth/register').send({ email: 'DUP@example.com', password: 'password123' });
        assert.equal(res.status, 409);
        assert.equal(res.body.error.code, 'EMAIL_TAKEN');
    });

    test('register validates email, password strength and display name', async () => {
        const { app } = makeApp();
        const res = await request(app).post('/api/auth/register')
            .send({ email: 'not-an-email', password: 'short', displayName: 'x'.repeat(51) });
        assert.equal(res.status, 400);
        assert.ok(res.body.error.fields.email);
        assert.ok(res.body.error.fields.password);
        assert.ok(res.body.error.fields.displayName);

        const noDigit = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'onlyletters' });
        assert.equal(noDigit.status, 400);
        assert.match(noDigit.body.error.fields.password, /letter and one number/);
    });

    test('login: wrong password and unknown email both give the same 401', async () => {
        const { app } = makeApp();
        await registerUser(app, { email: 'login@example.com', password: 'password123' });
        const wrong = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'nope12345' });
        const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope12345' });
        assert.equal(wrong.status, 401);
        assert.equal(unknown.status, 401);
        assert.equal(wrong.body.error.message, unknown.body.error.message);

        const missing = await request(app).post('/api/auth/login').send({});
        assert.equal(missing.status, 400);

        const ok = await request(app).post('/api/auth/login').send({ email: 'LOGIN@example.com', password: 'password123' });
        assert.equal(ok.status, 200);
    });

    test('logout destroys the session server-side, so a replayed cookie stops working', async () => {
        const { app } = makeApp();
        const agent = request.agent(app);
        const reg = await agent.post('/api/auth/register').send({ email: 'out@example.com', password: 'password123' });
        const cookie = reg.headers['set-cookie'][0].split(';')[0];
        assert.equal((await agent.post('/api/auth/logout')).status, 204);
        const replay = await request(app).get('/api/auth/me').set('Cookie', cookie);
        assert.equal(replay.status, 401);
    });

    test('protected routes return 401 without a session', async () => {
        const { app } = makeApp();
        for (const [method, url] of [
            ['get', '/api/auth/me'], ['get', '/api/subscription'], ['put', '/api/subscription'],
            ['get', '/api/characters'], ['post', '/api/characters'], ['get', '/api/characters/1'],
            ['get', '/api/characters/1/journal'], ['delete', '/api/characters/1/equipment/1'],
        ]) {
            const res = await request(app)[method](url).send({});
            assert.equal(res.status, 401, `${method} ${url}`);
        }
        const forged = await request(app).get('/api/characters').set('Cookie', 'rcc_session=deadbeef');
        assert.equal(forged.status, 401);
    });

    test('plans list is public and has the four tiers', async () => {
        const { app } = makeApp();
        const res = await request(app).get('/api/plans');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.plans.map((p) => [p.id, p.characterLimit]),
            [['free', 10], ['adventurer', 15], ['hero', 25], ['legend', 50]]);
    });
});
