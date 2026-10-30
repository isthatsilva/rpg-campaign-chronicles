import crypto from 'node:crypto';
import { unauthorized } from './errors.js';

export const SESSION_COOKIE = 'rcc_session';

function hashToken(token, secret) {
    // only the hmac is stored, so a leaked database can't be used to hijack sessions
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function parseCookies(header) {
    const cookies = {};
    if (!header) return cookies;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        try {
            cookies[key] = decodeURIComponent(value);
        } catch {
            cookies[key] = value;
        }
    }
    return cookies;
}

function cookieOptions(config) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
        path: '/',
    };
}

export function createSession(db, config, res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const ttlMs = config.sessionTtlDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
        .run(userId, hashToken(token, config.sessionSecret), expiresAt);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: ttlMs });
}

export function destroySession(db, config, req, res) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token, config.sessionSecret));
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

// attaches req.user when the request carries a valid, unexpired session cookie
export function loadSession(db, config) {
    const findSession = db.prepare(`
        SELECT u.id, u.email, u.display_name, u.created_at, s.expires_at, s.id AS session_id
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`);
    const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');

    return (req, res, next) => {
        req.user = null;
        const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        if (token) {
            const row = findSession.get(hashToken(token, config.sessionSecret));
            if (row && row.expires_at > new Date().toISOString()) {
                req.user = { id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at };
            } else if (row) {
                deleteSession.run(row.session_id);
            }
        }
        next();
    };
}

export function requireAuth(req, res, next) {
    if (!req.user) return next(unauthorized());
    next();
}
