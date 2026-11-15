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

## 2026-10-30: moved to the shared repo
- My partner (GitHub: GalaxyResonance-BA) and I now share https://github.com/GalaxyResonance-BA/RPG-gametracker_SWEPRAC-QU. All work from here on happens in that clone. The old copy in modern-software-dev-assignments/week8 is no longer updated.

## 2026-11-02 (partner): V2 client and first Bolt prompt
- My partner pushed `dc67202 "V2 + bolt prompt"`: a copy of the V1 React client in `version2-react-flask/client/` and a first draft of `bolt-prompt.md`. The Flask server wasn't started yet.
- That commit also included `client/node_modules/` (555 files, from Windows) and `client/dist/`.

## 2026-11-02 17:21 EST: Phase 2 (V2: Flask) started
- Repo cleanup: added a root `.gitignore` (.DS_Store, node_modules, dist, venv, __pycache__, .env, *.db), and untracked node_modules/dist/week8/.DS_Store with `git rm --cached` (the files stay on disk). The `.DS_Store` files inside `rpg-character-creator/` were left alone (that folder is never modified).
- Only Python 3.14 (system) and 3.12 (uv) are on this machine. The venv uses 3.14, the code avoids anything newer than 3.11, and the tests were also run on 3.12.
- Problem: **macOS AirPlay Receiver listens on port 5000** (`lsof` showed ControlCenter; `curl` got `403 AirTunes`). Fix: V2 defaults to port 5001 instead of the planned 5000.
- Built `server/`: Flask 3.1.3, bcrypt 5.0.0, python-dotenv 1.2.4 (pinned), the same schema.sql, the same API contract, field rules and error messages as V1. Each request gets its own SQLite connection (Flask is threaded), and the count+insert runs inside BEGIN IMMEDIATE.
- **V2 API first ran: 2026-11-02 17:26 EST.** All 19 pytest tests (ported from V1 plus a threaded race test) passed on the first run, about 5 minutes after starting.
- I didn't trust a first-try pass, so I removed the write lock on purpose: the 2-process race test failed (18 characters on a 10-character plan), so it really catches the bug. The in-process threaded test still passed without the lock (the GIL makes that race rare), so the 2-process test is the real proof. Lock restored, 19/19 again, and 19/19 on Python 3.12.
- Problem: bcrypt 5 throws on passwords over 72 bytes (bcryptjs in V1 cuts them short). Login now returns a clean 401 for those, and a test covers it.
- Problem: the committed `node_modules/.bin/vite` had no execute permission and was a Windows shim calling `node.exe`, and the native rolldown binary was win32-only. Root cause: node_modules was committed from Windows. Fix: untracked it, ran `npm install` (adds the macOS binaries), and ran vite via `node node_modules/vite/bin/vite.js` locally. A fresh clone plus `npm install` doesn't have this problem.
- Client: the proxy now points to `http://127.0.0.1:5001`, because Flask binds IPv4 only and Node may resolve `localhost` to `::1`. Nothing else in the client changed.
- **V2 full app (React → Vite proxy → Flask) first ran and all core UI features worked: 2026-11-02 ~17:29 EST.** Headless Chrome: all 11 checks passed (register, plan, character with custom attribute, equipment validation, journal, reload, account meter, delete, logout/bad login/login, plan-limit 403 in the UI, downgrade/over-limit). Single-port mode (Flask serving `client/dist`) checked too.
- A screenshot seemed to show the wrong tab highlighted. Root cause: the original design's 0.3s color transition, captured mid-fade. After 600ms it's correct, so it isn't a bug.
- V1 rechecked in the new location: npm install, 19/19 tests pass, client builds.
- Rewrote `bolt-prompt.md`:
  - plan limit as a Postgres BEFORE INSERT trigger with a row lock, raising ERRCODE 42501 (PostgREST returns 403)
  - plan changes only through a `change_plan` security-definer function, with history
  - RLS on every table, including the child tables via the parent character
  - CHECK constraints matching the V1 validation rules
  - the exact color/font tokens from style.css (the earlier draft said "parchment", but the real palette is dark indigo with gold)
  - Popular ribbon, D&D defaults button, Powers & Abilities field, pinned versions, `.env.example`
  - a short checklist for us (turn off email confirmation, minimum password length 8)
- **Phase 2 done; stopping for my approval.**

## 2026-11-02 18:55 EST: Phase 3 (V3: bolt.new) first export reviewed
- I pasted `bolt-prompt.md` into bolt.new (free plan; Bolt's Supabase connection needs Pro, so I didn't use it) and exported to `version3-vue-bolt/project/`.
- Review result: **Bolt produced a polished UI mockup, not a working app.**
  - Login was faked with `setTimeout`, and all characters/equipment/journal/plans were hardcoded sample data in a single 19 KB `App.vue`.
  - Only `supabase.auth.getUser()` was ever called.
  - The design matched the prompt well: magic border, corners, Popular ribbon, D&D defaults button, phone layout. It builds without errors.
- The SQL migration was mostly correct: 7 tables with CHECK constraints, a signup trigger (profile + Free subscription), a plan-limit trigger with a row lock raising 42501, `change_plan` with history, and RLS on every table.
- Problems found in the SQL:
  - a policy loop includes `characters`, which has no `character_id`, so the script would fail partway
  - Free was renamed "Wanderer"
  - health can't be negative
- Likely cause of the mockup: without a connected database, Bolt filled screens with sample data, and my "don't use Bolt's Supabase integration" line probably pushed it further that way. The prompt was also very large for the free plan's output limit, and it never said "no fake data" explicitly.
- Decision (me): ask Bolt to finish it (option A) rather than wiring it up by hand. The unmodified export is committed (`67205b9`) as a record. The zip was identical to the folder, so I deleted it.
- Wrote `bolt-followup-prompt.md`: two smaller messages (1: no fake data, SQL fixes, router/pages, auth, plans, characters; 2: profile tabs, account page, cleanup).

## 2026-11-02 19:13 EST: Phase 3: second Bolt export (after the follow-up prompts)
- I sent both follow-up messages in the same Bolt chat and exported again.
- This time it's a real app: router plus one page per screen, an auth store, real Supabase auth, and every screen reads and writes Supabase with no sample data. All three SQL fixes were made. It builds with no type errors.
- Saved unmodified as commit `575e4eb` (zip identical to the folder, deleted).
- I ran the SQL migration in the Supabase SQL editor: success on the first try.
- Key: I used the new **publishable** key (not the legacy anon key, which retires in early 2027). Checked directly with Bolt's pinned supabase-js 2.45.4: reads, sign-up (signup trigger creates the profile and Free subscription) and RLS-checked inserts all work.
- **V3 first ran against the real database: 2026-11-02 ~19:20 EST.**
- Problem (browser test): **a reload while signed in redirected to /login.** Root cause: `App.vue` and the router guard both call `loadAuth()`, and the second call returned at once because of a `started` flag, before the session had loaded. Fix: all callers await one shared promise.
- Problem (browser test): **horizontal scroll at phone width (18px).** Root cause: the 🌿/🔥 corner spans were outside the positioned `.frame`, so they were placed against the page. Fix: moved them into `.frame`, added phone offsets, and set `overflow-x: clip` on `.app-shell`. Two wrong guesses first:
  - `overflow-x: hidden` on `.app-shell` didn't clip them, because it isn't their containing block
  - on `body` it only stopped manual scrolling; the page was still wider than the screen
- Looking at screenshots also showed that the corner marks had **never been visible** in Bolt's version (they were off-screen). The same fix restored them.
- Wrote 12 direct API checks (no Vue app, like an attacker calling Supabase): plan limit 403, **24 parallel inserts → exactly 10**, RLS isolation (read/update/delete/plant/move), signed-out access, locked subscriptions/plans tables, change_plan validation/history/downgrade, CHECK constraints, 50-attribute limit, cascade delete, profile column permissions.
- 11/12 passed at first. Problem: **a user could overwrite their own `profiles.email`.** Root cause: Supabase grants authenticated users UPDATE on every column of new tables, so Bolt's `GRANT UPDATE(display_name)` restricted nothing. Fix: `REVOKE UPDATE` first, then grant display_name only (appended to the migration). I ran the fix SQL; afterwards 12/12 pass and the plan limit still works.
- **All V3 core features working and verified: 2026-11-02 ~19:35 EST.** 13/13 browser checks and 12/12 API checks pass, and the build is clean. The API checks are now in the repo as `npm run test:api`.
- Not done: mutation-testing the race (it would mean breaking the live trigger). Noted in the README.
- Wrote `version3-vue-bolt/README.md` (how V3 differs, setup, tests, how Bolt was prompted, manual fixes, known issues). Bolt's own short README stays in `project/`.
- **Phase 3 done; stopping for my approval.**

## 2026-11-02 19:40 EST: V3 moved out of `project/`
- Bolt exported into `version3-vue-bolt/project/`. Moved the files up one level to match V1/V2 (commit `1846a60`), and kept Bolt's own short README as `README.bolt.md`. Re-checked after the move: build, 12/12 API checks, 13/13 browser checks.
- Added a "How to run everything" section with macOS and Windows commands to the root README (`4b02aad`).

## 2026-11-15 16:32 EST: Phase 4 (final check and writeup)
- Decided (me): no changes to V3 before the final check, with a clean re-run in a fresh clone (so my working copy is untouched), and partner credit limited to what git and dev-log show.
- **Clean re-run:** cloned the GitHub repo into a scratch folder at `4b02aad` and followed only the READMEs (fresh `npm install`, a fresh venv, `.env` from `.env.example` with a new `SESSION_SECRET`; the V3 `.env` was copied from my working copy without printing it). Results:
  - V1: 19/19 tests, 11/11 browser checks, single-port mode OK
  - V2: 19/19 pytest, 11/11 browser checks, single-port mode OK
  - V3: clean `vue-tsc` build, 12/12 `test:api`, 12/12 browser checks
- The scratchpad browser scripts from earlier sessions had been wiped, so I rewrote them. Two first-run failures were test-script mistakes, not app bugs: `getByLabel('Health')` also matched "Max health", and a "deleted" check ran while the dialog still showed the name.
- npm 12 now warns that it skipped install scripts (fsevents). This is harmless: fsevents is an optional macOS file watcher.
- Problem found: V2 README's single-port command (`cd ../server && python run.py`) fails in a fresh terminal because the venv isn't active. Fixed in the README.
- Problem found (screenshots): **V3's custom-attribute rows and journal Edit/Delete links are unstyled** ("Sanity ShakenEditRemove" runs together). Root cause: Bolt's `CharacterDetailPage.vue` uses `inline-record`, `inline-add` and `record-actions`, which `style.css` never defines. The browser tests passed because everything works; it only looks wrong. Not fixed (I'd decided on no V3 changes), but added to V3's known issues.
- Screenshots: V2 and V3 now have `docs/screenshots/` (plans, dashboard, profile overview, journal) like V1, captured during the clean re-run.
- Added an "Environment configuration" section to V3's README, a rubric item it only covered inside Setup.
- Filled in `writeup.md` (Name/SUNet ID/hours left as TODO). It has a who-did-what section and metrics taken from this log.
- **Phase 4 done; stopping for final review.**

## 2026-11-15 16:46 EST: repo cleanup before the final push
- Decided (me): remove what the submission doesn't need: `rpg-character-creator/` (the original vanilla frontend; V1/V2 keep a copy of its `style.css`), `RPG_Campaign_Chronicles.md` (the requirements doc), `week8-prompt.md` (the working rules) and `resume-prompt.md`. This overrides my earlier "never delete rpg-character-creator/" rule. All of them remain in git history (last present in `0b161f7`).
- Updated the references in the root README, writeup and V1 README. Older dev-log entries still name these files as they were at the time.
