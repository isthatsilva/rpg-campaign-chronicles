// direct database/api checks for version 3 (run: npm run test:api).
// these exercise the same guarantees versions 1 and 2 test on their servers (plan limits, ownership,
// validation, cascade), but against supabase without the vue app, the way an attacker calling the
// api directly would. needs .env, and creates throwaway accounts in the supabase project each run
// (rcc.api.*@gmail.com); delete them under authentication -> users when you're done.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const envPath = new URL('../.env', import.meta.url);
if (!fs.existsSync(envPath)) {
    console.error('missing .env: copy .env.example to .env and fill in your supabase url and key');
    process.exit(1);
}
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
let failures = 0;
async function check(name, fn) {
    try { await fn(); console.log(`✓ ${name}`); } catch (err) { failures += 1; console.log(`✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`); }
}
async function newUser(tag) {
    const sb = client();
    const email = `rcc.api.${tag}.${stamp}@gmail.com`;
    const { data, error } = await sb.auth.signUp({ email, password: 'password123' });
    if (error || !data.session) throw new Error(`signup failed: ${error?.message}`);
    return { sb, id: data.user.id, email };
}

const alice = await newUser('alice');
const bob = await newUser('bob');
const anon = client();

await check('plan limit: 10 characters on Free, the 11th is rejected with 42501 / HTTP 403', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `Hero ${i}` }));
    for (const row of rows) {
        const { error } = await alice.sb.from('characters').insert(row);
        assert.equal(error, null);
    }
    const extra = await alice.sb.from('characters').insert({ name: 'One too many' });
    assert.equal(extra.status, 403, `status ${extra.status}`);
    assert.equal(extra.error.code, '42501');
    assert.match(extra.error.message, /^PLAN_LIMIT_REACHED: Your Free plan allows 10 characters and you have 10\./);
});

await check('plan limit holds under 24 parallel inserts from a fresh account (exactly 10 succeed)', async () => {
    const racer = await newUser('racer');
    const results = await Promise.all(Array.from({ length: 24 }, (_, i) => racer.sb.from('characters').insert({ name: `Racer ${i}` })));
    const ok = results.filter((r) => !r.error).length;
    const blocked = results.filter((r) => r.error?.code === '42501').length;
    const { count } = await racer.sb.from('characters').select('id', { count: 'exact', head: true });
    assert.deepEqual({ ok, blocked, count }, { ok: 10, blocked: 14, count: 10 });
});

const { data: bobChar } = await bob.sb.from('characters').insert({ name: 'Bob Hero' }).select().single();
const { data: bobItem } = await bob.sb.from('equipment').insert({ character_id: bobChar.id, item_name: 'Sword' }).select().single();
const { data: bobEntry } = await bob.sb.from('journal_entries').insert({ character_id: bobChar.id, session_date: '2026-10-25', title: 'Secret' }).select().single();
const { data: bobAttr } = await bob.sb.from('character_attributes').insert({ character_id: bobChar.id, name: 'Sanity', value: '50' }).select().single();

await check("rls: alice can't see bob's characters, attributes, equipment, journal, profile or subscription", async () => {
    const names = (await alice.sb.from('characters').select('name')).data.map((c) => c.name);
    assert.ok(!names.includes('Bob Hero'));
    assert.equal((await alice.sb.from('characters').select('*').eq('id', bobChar.id)).data.length, 0);
    for (const table of ['character_attributes', 'equipment', 'journal_entries']) {
        assert.equal((await alice.sb.from(table).select('*').eq('character_id', bobChar.id)).data.length, 0, table);
    }
    assert.equal((await alice.sb.from('profiles').select('*').eq('id', bob.id)).data.length, 0);
    assert.equal((await alice.sb.from('subscriptions').select('*').eq('user_id', bob.id)).data.length, 0);
});

await check("rls: alice can't change or delete bob's rows, or plant rows on his character", async () => {
    await alice.sb.from('characters').update({ name: 'Hacked' }).eq('id', bobChar.id);
    await alice.sb.from('characters').delete().eq('id', bobChar.id);
    await alice.sb.from('equipment').update({ item_name: 'Stolen' }).eq('id', bobItem.id);
    await alice.sb.from('journal_entries').delete().eq('id', bobEntry.id);
    await alice.sb.from('character_attributes').update({ value: '0' }).eq('id', bobAttr.id);
    const planted = await alice.sb.from('equipment').insert({ character_id: bobChar.id, item_name: 'Planted' });
    assert.ok(planted.error, 'insert onto another user\'s character must fail');
    const stolen = await alice.sb.from('characters').insert({ name: 'Disguised', user_id: bob.id });
    assert.ok(stolen.error, 'insert with another user_id must fail');
    const after = (await bob.sb.from('characters').select('name, equipment(item_name), journal_entries(title), character_attributes(value)').eq('id', bobChar.id).single()).data;
    assert.deepEqual(after, { name: 'Bob Hero', equipment: [{ item_name: 'Sword' }], journal_entries: [{ title: 'Secret' }], character_attributes: [{ value: '50' }] });
});

await check("rls: a user can't move their own record onto another user's character", async () => {
    const { data: mine } = await alice.sb.from('characters').select('id').limit(1).single();
    const { data: item } = await alice.sb.from('equipment').insert({ character_id: mine.id, item_name: 'Rope' }).select().single();
    const moved = await alice.sb.from('equipment').update({ character_id: bobChar.id }).eq('id', item.id);
    assert.ok(moved.error, 'moving a row onto another user\'s character must fail');
});

await check('signed-out requests see only the public plans', async () => {
    assert.equal((await anon.from('plans').select('id')).data.length, 4);
    for (const table of ['characters', 'profiles', 'subscriptions', 'equipment', 'journal_entries', 'character_attributes']) {
        const { data } = await anon.from(table).select('*');
        assert.equal((data || []).length, 0, table);
    }
    assert.ok((await anon.from('characters').insert({ name: 'Ghost' })).error);
});

await check('subscriptions and plans cannot be written directly (only through change_plan)', async () => {
    await alice.sb.from('subscriptions').update({ plan_id: 'legend' }).eq('user_id', alice.id);
    const ins = await alice.sb.from('subscriptions').insert({ user_id: alice.id, plan_id: 'legend', status: 'active' });
    assert.ok(ins.error);
    await alice.sb.from('plans').update({ character_limit: 9999 }).eq('id', 'free');
    const { data: plan } = await alice.sb.from('plans').select('character_limit').eq('id', 'free').single();
    assert.equal(plan.character_limit, 10);
    const { data: sub } = await alice.sb.from('subscriptions').select('plan_id').eq('status', 'active').single();
    assert.equal(sub.plan_id, 'free');
});

await check('change_plan validates, keeps history; downgrade keeps characters, blocks creates, allows edits', async () => {
    assert.ok((await alice.sb.rpc('change_plan', { new_plan_id: 'platinum' })).error, 'unknown plan');
    const same = await alice.sb.rpc('change_plan', { new_plan_id: 'free' });
    assert.match(same.error?.message || '', /ALREADY_ON_PLAN/);
    assert.equal((await alice.sb.rpc('change_plan', { new_plan_id: 'adventurer' })).error, null);
    for (let i = 0; i < 2; i++) assert.equal((await alice.sb.from('characters').insert({ name: `Extra ${i}` })).error, null);
    assert.equal((await alice.sb.rpc('change_plan', { new_plan_id: 'free' })).error, null);
    const { data: subs } = await alice.sb.from('subscriptions').select('plan_id,status').order('started_at');
    assert.deepEqual(subs.map((s) => `${s.plan_id}:${s.status}`), ['free:canceled', 'adventurer:canceled', 'free:active']);
    const { data: chars } = await alice.sb.from('characters').select('id');
    assert.equal(chars.length, 12);
    assert.equal((await alice.sb.from('characters').insert({ name: 'Blocked' })).error?.code, '42501');
    assert.equal((await alice.sb.from('characters').update({ name: 'Renamed' }).eq('id', chars[0].id)).error, null);
});

await check('database rejects invalid data even without the frontend (check constraints)', async () => {
    const { data: c } = await bob.sb.from('characters').select('id').eq('id', bobChar.id).single();
    const bad = [
        ['characters', { name: '' }],
        ['characters', { name: 'x'.repeat(101) }],
        ['characters', { name: 'Ok', level: -1 }],
        ['characters', { name: 'Ok', max_health: -5 }],
        ['equipment', { character_id: c.id, item_name: 'Arrows', quantity: -1 }],
        ['journal_entries', { character_id: c.id, session_date: '2026-02-30', title: 'Bad date' }],
        ['journal_entries', { character_id: c.id, session_date: '2026-10-25', title: '' }],
        ['character_attributes', { character_id: c.id, name: 'Wits', value: '' }],
    ];
    for (const [table, row] of bad) {
        const { error } = await bob.sb.from(table).insert(row);
        assert.ok(error, `${table} ${JSON.stringify(row).slice(0, 60)} should be rejected`);
    }
    const neg = await bob.sb.from('characters').update({ health: -3 }).eq('id', c.id).select('health').single();
    assert.equal(neg.data?.health, -3, 'negative current health is allowed (like v1/v2)');
});

await check('attribute limit: 50 per character', async () => {
    const rows = Array.from({ length: 49 }, (_, i) => ({ character_id: bobChar.id, name: `Stat ${i}`, value: '1', position: i + 1 }));
    assert.equal((await bob.sb.from('character_attributes').insert(rows)).error, null);
    const extra = await bob.sb.from('character_attributes').insert({ character_id: bobChar.id, name: 'Fifty-one', value: '1' });
    assert.match(extra.error?.message || '', /ATTRIBUTE_LIMIT_REACHED/);
});

await check('deleting a character cascades to its attributes, equipment and journal', async () => {
    assert.equal((await bob.sb.from('characters').delete().eq('id', bobChar.id)).error, null);
    for (const table of ['character_attributes', 'equipment', 'journal_entries']) {
        assert.equal((await bob.sb.from(table).select('id').eq('character_id', bobChar.id)).data.length, 0, table);
    }
});

await check('profile: users can rename themselves but not change their stored email', async () => {
    assert.equal((await alice.sb.from('profiles').update({ display_name: 'Alice' }).eq('id', alice.id)).error, null);
    await alice.sb.from('profiles').update({ email: 'spoofed@example.com' }).eq('id', alice.id);
    const { data } = await alice.sb.from('profiles').select('email').eq('id', alice.id).single();
    assert.equal(data.email, alice.email, `stored email changed to ${data.email}`);
});

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL API CHECKS PASSED');
console.log(`test accounts: ${alice.email}, ${bob.email}, rcc.api.racer.${stamp}@gmail.com`);
process.exitCode = failures ? 1 : 0;
