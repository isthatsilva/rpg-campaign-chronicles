# Week 8 Dev Log

Timestamps come from `date` on my machine (EDT).

## 2026-10-28 20:12 EDT: Phase 0 (analysis and plan)
- Read assignment.md, RPG_Campaign_Chronicles.md, writeup.md, rpg-character-creator/public/*.
- Findings: the old frontend only wires login/dashboard/form in JS. Register, pricing, checkout and logs are HTML only. Level and stats are never saved. It uses localStorage, has no real auth, and builds cards with innerHTML (XSS risk). Attributes, equipment, journal CRUD, profile and account pages are missing.
- Conflicts found: the requirements doc rubric (15/15/10, no Bolt line) differs from assignment.md (10/10/10/10 with Bolt). assignment.md wins. The requirements doc names V3 "vue-express", but Bolt is required, so V3 = `version3-vue-bolt`.

## 2026-10-28 20:34 EDT: decisions confirmed by me (the human)
- Name: "RPG Campaign Chronicles". Login: email + password + optional display name.
- Plans (simulated, no payment): Free $0/10, Adventurer $5/15, Hero $10/25, Legend $15/50.
- Payment Portal removed and replaced by a confirm dialog. No card fields.
- localStorage replaced by the API. Sessions use an httpOnly cookie backed by a `sessions` table (token stored as a SHA-256 hash).
- "Powers & Abilities" kept as an optional `abilities` text field. Social footer kept as decoration.
- Race/class become free-text Species/Role. The STR–CHA grid becomes a custom attribute editor with optional D&D defaults.
- V1 deps: built-in `node:sqlite` + `bcryptjs` (avoids native builds on Node 26). V2: Flask + `bcrypt` + stdlib `sqlite3`.
- V3: bolt.new with Supabase (I'll create a Supabase account).
- Prompting note: the AI asked before deciding anything that conflicted between my old frontend and the requirements doc. Today's stopping point is the end of Phase 1.

## 2026-10-28 20:42 EDT: V1 backend (Express + node:sqlite) built and tested
- Built schema.sql (7 tables, ON DELETE CASCADE, one-active-subscription partial index), config/.env, httpOnly cookie sessions (HMAC-hashed tokens), validation module, auth/plans/characters routes, and generic CRUD for attributes/equipment/journal.
- **V1 API first ran: 2026-10-28 20:39 EDT** (curl smoke test: register → free plan → create character with attributes → profile → validation 400s).
- **Core API features first worked: 2026-10-28 ~20:45 EDT.** 19/19 node:test + supertest tests pass (auth, ownership isolation, plan limits incl. downgrade, cascade delete, validation, malformed JSON).
- Problem: a curl smoke test failed because zsh doesn't word-split unquoted variables (`$C`), so curl got mangled arguments. Fix: ran the script under `bash -c`. That first broken run also left a stray server on port 4100, which I stopped.
- Problem: the cross-process concurrency test (2 server processes, 1 DB file, 24 parallel creates) crashed one server at startup with "database is locked". Root cause: `PRAGMA journal_mode=WAL` doesn't honor busy_timeout when two processes open a new DB at once. Fix: run schema setup inside BEGIN IMMEDIATE and retry the WAL switch on SQLITE_BUSY. The test now passes 3/3 runs: exactly 10 created, 14 rejected with 403.
- Problem: supertest created a new server per request in parallel tests (MaxListenersExceededWarning). Fix: one listening, unref'd server per test app.

## 2026-10-28 20:52 EDT: V1 frontend (React + Vite) built, integrated, Phase 1 complete
- Migrated the Realm Forge design into React components. style.css was copied unchanged and app.css adds styles for the new screens. Routes: /login, /register, /plans, /account, /characters, /characters/new, /characters/:id (tabs: overview/attributes, equipment, journal), /characters/:id/edit.
- **V1 full app (UI + API) first ran: 2026-10-28 ~21:25 EDT.** Production build compiled on the first try.
- Tested end-to-end in headless Chrome (playwright-core, installed only in a scratch folder, using the installed Chrome with a throwaway profile). 15 main-flow checks plus 5 plan-limit checks all pass: register → plan confirm → create with custom attributes → attribute/equipment/journal CRUD with validation → reload persistence → edit → separate journals → delete with confirm → account usage → logout/login → phone width; full Free plan, server 403 shown in the UI, downgrade warning, over-limit dashboard.
- **All core features working in the UI: 2026-10-28 ~21:35 EDT.**
- Problem: the browser test couldn't find equipment/journal fields by label. Root cause: `<label>` had no `htmlFor` and inputs had no id (an accessibility bug). Fix: the Field component auto-generates and links ids.
- Problem: favicon 404 in the console → inline SVG favicon. Uneven profile header buttons → shared padding rule. Long emails overflowing the header → overflow-wrap.
- Reviewed screenshots by eye. Fonts, magic-border, glow, ribbon and 🌿/🔥 ornaments all carried over. Saved to version1-react-express/docs/screenshots/.
- Permission note: a broad `pkill` and an `rm` in a scratch folder were blocked by Claude Code's safety checks. I switched to having the test print the child's stderr, and to stopping background servers by task id.
- Wrote README.md (prereqs, setup, run, env, tests, deviations, known issues, manual fixes). Final: 19/19 API tests pass, build OK.

## 2026-10-28 21:00 EDT: Phase 1 review pause, decisions for Phase 2
- I'm trying V1 myself before continuing.
- Decided: V2 Flask targets **Python 3.11+** (in a venv), even though my machine has 3.14.
- Decided: V2 reuses the V1 React client unchanged except for the proxy port.
- Decided: write `bolt-prompt.md` early (before/alongside V2) so I can run Bolt in parallel.
- Resume instructions saved in `resume-prompt.md`.
