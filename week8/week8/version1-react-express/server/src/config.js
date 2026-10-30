import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function intFromEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) throw new Error(`${name} must be an integer`);
    return value;
}

export function loadConfig(overrides = {}) {
    const config = {
        port: intFromEnv('PORT', 4000),
        databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH || './data/app.db'),
        sessionSecret: process.env.SESSION_SECRET,
        sessionTtlDays: intFromEnv('SESSION_TTL_DAYS', 7),
        cookieSecure: process.env.COOKIE_SECURE === 'true',
        bcryptRounds: intFromEnv('BCRYPT_ROUNDS', 12),
        ...overrides,
    };
    if (!config.sessionSecret || config.sessionSecret.length < 16) {
        throw new Error('SESSION_SECRET is missing or too short (min 16 chars). Copy .env.example to .env and set it.');
    }
    return config;
}
