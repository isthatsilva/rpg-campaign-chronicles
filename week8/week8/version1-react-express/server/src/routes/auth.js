import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { withWriteTransaction } from '../db.js';
import { HttpError, badRequest } from '../errors.js';
import { createSession, destroySession, requireAuth } from '../auth.js';
import { validate, checkPassword, registerSpec } from '../validation.js';

const toUser = (row) => ({ id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at });

export function authRouter(db, config) {
    const router = Router();
    // compared against when the email doesn't exist, so a wrong email takes as long as a wrong password
    const dummyHash = bcrypt.hashSync('not-a-real-password-1', config.bcryptRounds);

    router.post('/register', async (req, res) => {
        const body = req.body ?? {};
        let clean;
        const passwordError = checkPassword(body.password);
        try {
            clean = validate(body, registerSpec);
        } catch (err) {
            if (passwordError) err.fields.password = passwordError;
            throw err;
        }
        if (passwordError) throw badRequest('Please fix the highlighted fields.', { password: passwordError });

        if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(clean.email)) {
            throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'This email is already registered.' });
        }
        const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);

        let user;
        try {
            user = withWriteTransaction(db, () => {
                const { lastInsertRowid } = db
                    .prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
                    .run(clean.email, passwordHash, clean.displayName);
                // every new account starts on the free plan
                db.prepare("INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, 'free', 'active')").run(lastInsertRowid);
                return db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
            });
        } catch (err) {
            // two simultaneous registrations with the same email: the unique index catches the loser
            if (String(err.message).includes('UNIQUE constraint failed: users.email')) {
                throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'This email is already registered.' });
            }
            throw err;
        }
        createSession(db, config, res, user.id);
        res.status(201).json({ user: toUser(user) });
    });

    router.post('/login', async (req, res) => {
        const body = req.body ?? {};
        const fields = {};
        if (typeof body.email !== 'string' || !body.email.trim()) fields.email = 'Email is required.';
        if (typeof body.password !== 'string' || !body.password) fields.password = 'Password is required.';
        if (Object.keys(fields).length) throw badRequest('Please enter your email and password.', fields);

        const row = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email.trim().toLowerCase());
        const ok = await bcrypt.compare(body.password, row ? row.password_hash : dummyHash);
        if (!row || !ok) {
            throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
        }
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
        createSession(db, config, res, row.id);
        res.json({ user: toUser(row) });
    });

    router.post('/logout', (req, res) => {
        destroySession(db, config, req, res);
        res.status(204).end();
    });

    router.get('/me', requireAuth, (req, res) => {
        res.json({ user: req.user });
    });

    return router;
}
