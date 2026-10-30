# Resume prompt (paste this into a new Claude Code session opened in `week8/`)

We're continuing my CS146S Week 8 assignment ("RPG Campaign Chronicles" in 3 stacks). Before doing anything:

1. Read `week8-prompt.md` (my full rules and phases; they all still apply), then `dev-log.md` (what's done, every decision I confirmed, and the problems we hit). Also skim `version1-react-express/README.md` for the API contract and schema.
2. Don't redo or rewrite finished work. **Phase 0 and Phase 1 are complete.** Version 1 (`version1-react-express/`) runs, and all 19 API tests plus the browser click-through passed.
3. Never modify `rpg-character-creator/`.

Confirmed decisions (details in dev-log.md):
- Plans (simulated, no payments or card fields): Free $0/10, Adventurer $5/15, Hero $10/25, Legend $15/50.
- Email + password + optional display name. Sessions use an httpOnly cookie backed by a `sessions` table (HMAC-hashed token).
- "Powers & Abilities" is kept as an `abilities` field. The social footer stays as decoration.
- **V2:** React (copy of the V1 client, only the proxy port changes) + **Flask on Python 3.11+** (venv) + its own SQLite DB, with the **same API contract** and the same `schema.sql`. Use bcrypt and stdlib sqlite3; write pytest tests equivalent to V1's (auth, ownership, plan limit incl. concurrency, cascade, validation).
- **V3:** bolt.new + Vue + **Supabase** (I'm creating a Supabase account). I'm allowed to have `bolt-prompt.md` written early.

Where we stopped: Phase 1 is done and I was reviewing V1 by hand.

Next steps, in order:
1. Ask me if I found anything to change in V1 while testing it. Fix those first.
2. Write `bolt-prompt.md` (Phase 3 deliverable; self-contained, since Bolt can't read my files).
3. Phase 2: build `version2-react-flask/`, run its tests, write its README, log milestones with real `date` timestamps in `dev-log.md`, then **stop for my approval**.

Ask me any questions you need before starting each phase.
