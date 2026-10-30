import { Router } from 'express';
import { withWriteTransaction } from '../db.js';
import { HttpError, badRequest } from '../errors.js';
import { requireAuth } from '../auth.js';

const toPlan = (row) => ({
    id: row.id,
    name: row.name,
    characterLimit: row.character_limit,
    priceCents: row.price_cents,
    currency: row.currency,
});

// the current plan plus usage numbers the dashboard and account page need
export function getSubscriptionSummary(db, userId) {
    const row = db.prepare(`
        SELECT s.status, s.started_at, p.*
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ? AND s.status = 'active'`).get(userId);
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM characters WHERE user_id = ?').get(userId);
    return {
        plan: toPlan(row),
        status: row.status,
        startedAt: row.started_at,
        characterCount: count,
        characterLimit: row.character_limit,
        remaining: Math.max(0, row.character_limit - count),
        canCreate: count < row.character_limit,
        // true after a downgrade below the current number of characters
        overLimit: count > row.character_limit,
    };
}

export function plansRouter(db) {
    const router = Router();

    router.get('/plans', (req, res) => {
        const rows = db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order').all();
        res.json({ plans: rows.map(toPlan) });
    });

    router.get('/subscription', requireAuth, (req, res) => {
        res.json({ subscription: getSubscriptionSummary(db, req.user.id) });
    });

    // simulated plan change: no payment is collected or recorded
    router.put('/subscription', requireAuth, (req, res) => {
        const planId = req.body?.planId;
        if (typeof planId !== 'string' || !planId) {
            throw badRequest('Please choose a plan.', { planId: 'Plan is required.' });
        }
        const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId);
        if (!plan) throw badRequest('That plan does not exist.', { planId: 'Unknown plan.' });

        withWriteTransaction(db, () => {
            const current = db.prepare("SELECT plan_id FROM subscriptions WHERE user_id = ? AND status = 'active'").get(req.user.id);
            if (current?.plan_id === plan.id) {
                throw new HttpError(409, 'ALREADY_ON_PLAN', `You are already on the ${plan.name} plan.`);
            }
            const now = new Date().toISOString();
            // keep the old row as history instead of overwriting it
            db.prepare("UPDATE subscriptions SET status = 'canceled', ends_at = ? WHERE user_id = ? AND status = 'active'")
                .run(now, req.user.id);
            db.prepare("INSERT INTO subscriptions (user_id, plan_id, status, started_at) VALUES (?, ?, 'active', ?)")
                .run(req.user.id, plan.id, now);
        });
        res.json({ subscription: getSubscriptionSummary(db, req.user.id) });
    });

    return router;
}
