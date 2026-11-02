# Resume prompt (paste this into a new Claude Code session opened in `/Users/davidsilva/cs146s/RPG-gametracker_SWEPRAC-QU/week8/`)

This is the shared repo with my partner (GalaxyResonance-BA). Run `git pull` before starting and commit often. The old copy in `modern-software-dev-assignments/week8` is out of date.

We're continuing my CS146S Week 8 assignment ("RPG Campaign Chronicles" in 3 stacks). Before doing anything:

1. Read `week8-prompt.md` (my full rules and phases; they all still apply), then `dev-log.md` (what's done, every decision I confirmed, and the problems we hit). Also skim `version1-react-express/README.md` for the API contract and schema.
2. Don't redo or rewrite finished work. **Phases 0, 1 and 2 are complete.** V1 (`version1-react-express/`) and V2 (`version2-react-flask/`, Flask on port 5001) both run, and each has 19 passing tests plus a browser click-through. `bolt-prompt.md` is written.
3. Never modify `rpg-character-creator/`.

Confirmed decisions (details in dev-log.md):
- Plans (simulated, no payments or card fields): Free $0/10, Adventurer $5/15, Hero $10/25, Legend $15/50.
- Email + password + optional display name. Sessions use an httpOnly cookie backed by a `sessions` table (HMAC-hashed token).
- "Powers & Abilities" is kept as an `abilities` field. The social footer stays as decoration.
- **V2:** React (copy of the V1 client, only the proxy port changes) + **Flask on Python 3.11+** (venv) + its own SQLite DB, with the **same API contract** and the same `schema.sql`. Use bcrypt and stdlib sqlite3; write pytest tests equivalent to V1's (auth, ownership, plan limit incl. concurrency, cascade, validation).
- **V3:** bolt.new + Vue + **Supabase** (I'm creating a Supabase account). I'm allowed to have `bolt-prompt.md` written early.

Where we stopped: Phase 2 is done, waiting for my approval.

Next steps, in order:
1. Ask me whether V2 needs changes.
2. Phase 3: I run `bolt-prompt.md` in bolt.new (with Supabase) and export to `week8/version3-vue-bolt/`. Then you review it against V1/V2 (RLS, plan-limit trigger, validation, no card fields), fix it, document it, and log it.
3. Phase 4: clean re-run of all three versions, fill `writeup.md` (leave Name/SUNet ID/hours as TODO; include my partner and who did what), rubric check.

Ask me any questions you need before starting each phase.
