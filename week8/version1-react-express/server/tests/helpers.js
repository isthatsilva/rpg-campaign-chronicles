import http from 'node:http';
import request from 'supertest';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export const TEST_SECRET = 'test-secret-that-is-long-enough';

export function makeApp() {
    const config = loadConfig({ sessionSecret: TEST_SECRET, bcryptRounds: 4, databasePath: ':memory:' });
    const db = openDatabase(':memory:');
    // one real listening server per test app; supertest would otherwise start a new one per request.
    // unref() lets the test process exit without closing it explicitly.
    const server = http.createServer(createApp(db, config)).listen(0);
    server.unref();
    return { app: server, db };
}

let counter = 0;

// registers a fresh user and returns a supertest agent that keeps its session cookie
export async function registerUser(app, overrides = {}) {
    counter += 1;
    const agent = request.agent(app);
    const body = { email: `user${counter}@example.com`, password: 'password123', displayName: `User ${counter}`, ...overrides };
    const res = await agent.post('/api/auth/register').send(body);
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { agent, user: res.body.user, password: body.password };
}

export async function createCharacter(agent, body = {}) {
    const res = await agent.post('/api/characters').send({ name: 'Thorne Ashford', ...body });
    if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.character;
}
