# RPG Campaign Chronicles: Version 1 (React + Express + SQLite)

A system-neutral tabletop RPG character manager with a personal campaign journal for each character.
Users register, pick a simulated subscription tier (which sets their character limit), and manage
characters, custom attributes, equipment and session journals.

| | |
|---|---|
| Frontend | React 19 + React Router 7, built with Vite 8 (`client/`) |
| Backend | Node.js + Express 5 (`server/`) |
| Database | SQLite through Node's built-in `node:sqlite` module, stored in `server/data/app.db` |
| Auth | bcrypt-hashed passwords (`bcryptjs`), httpOnly session cookie backed by a `sessions` table |
| Tests | `node:test` + `supertest` (API tests), 20 tests |
| Built with | Claude Code (AI pair programmer) |

## Prerequisites

- **Node.js 22.13 or newer** (`node:sqlite` is built in from 22.13 onward). Developed and tested on **Node 26.11.1 / npm 11.20.0** on macOS.
  On Node 22 or 23 you may see an `ExperimentalWarning` for `node:sqlite`. It's harmless.
- No database server to install: SQLite runs inside the Node process and the file is created automatically.
- No native build tools needed (`bcryptjs` is pure JavaScript).

## Setup

```bash
cd week8/version1-react-express

# 1. backend
cd server
npm install
cp .env.example .env
# put a long random value in SESSION_SECRET, e.g. paste the output of:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. frontend
cd ../client
npm install
# optional: cp .env.example .env (only needed if you change ports)
```

## Run (development: two terminals)

```bash
# terminal 1: API on http://localhost:4000
cd week8/version1-react-express/server
npm run dev          # or: npm start (no auto-reload)

# terminal 2: React app on http://localhost:5173
cd week8/version1-react-express/client
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies every `/api/*` request to the Express
server, so the browser only ever talks to one origin. The session cookie stays same-origin and no CORS setup is needed.

The database file (`server/data/app.db`) and the four plans are created on first start.

### Run (single port, production-style)

```bash
cd week8/version1-react-express/client && npm run build
cd ../server && npm start
```

Open **http://localhost:4000**. When `client/dist` exists, Express serves the built React app as well as the API.

## Tests

```bash
cd week8/version1-react-express/server
npm test
```

20 API tests covering:
- **Auth:** hashing, duplicate email (409), password rules, identical 401 for wrong password and unknown email, logout invalidating the session server-side, and 401 on every protected route.
- **Ownership isolation:** user B gets 404 for every read/update/delete on user A's characters, attributes, equipment and journal, including mixing B's own character id with A's item ids.
- **Plan limits:** 11th character on Free → 403, plan validation and history, downgrade keeps data but blocks creates, and a **concurrency test with 2 separate server processes sharing one DB file firing 24 parallel creates: exactly 10 succeed**.
- **Cascade delete:** a character's attributes, equipment and journal rows are gone after deleting it.
- **Validation:** 400 with per-field messages, impossible dates, invalid JSON, wrong content type (415), bad ids (404), no stack traces.
- **Migration:** an older database's characters with no attributes get the D&D defaults once; removing them all afterwards stays removed after a restart.

The UI was also tested end-to-end in headless Chrome (Playwright): every flow from register → plan → characters
→ attributes/equipment/journal CRUD → delete → account → logout/login, plus the plan-limit and downgrade screens and phone width.
That script isn't part of this folder; see `../dev-log.md`.

## Environment configuration

`server/.env` (copy from `server/.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATABASE_PATH` | `./data/app.db` | SQLite file, relative to `server/` |
| `SESSION_SECRET` | none, **required** (min 16 chars) | HMAC key used to hash session tokens before storing them. The server refuses to start without it. |
| `SESSION_TTL_DAYS` | `7` | How long a login lasts |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost (tests use 4 for speed) |

`client/.env` (optional, from `client/.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `API_PROXY_TARGET` | `http://localhost:4000` | Where Vite forwards `/api` |
| `CLIENT_PORT` | `5173` | Vite dev server port |

## Features

- Register (email, password, optional display name) → choose plan → dashboard. Login/logout. Sessions survive reloads.
- **Plans (simulated, no payments, no card fields):** Free 10 · Adventurer 15 · Hero 25 · Legend 50 characters.
  Limits are enforced on the server inside a `BEGIN IMMEDIATE` transaction (count + insert together).
  A downgrade below your current count keeps all characters, blocks new ones, and shows a warning.
- **Account page:** plan, status, "3 of 10 slots used · 7 remaining" meter.
- **Characters:** only the name is required. Species, role, level, health/max health, experience, powers & abilities and backstory are optional and free text, with no D&D lock-in.
- **Custom attributes:** any name/value pairs (e.g. Sanity = "Shaken"). The create form starts with the six D&D attributes (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma, each 10), which the user can change, remove or add to; "Use D&D defaults" re-adds any that were removed.
  Characters created before this change got the same six once, on the first server start after updating (a one-time migration tracked in SQLite's `user_version`, in `src/db.js`).
- **Equipment:** item name, type, quantity, description, with add/edit/remove.
- **Journal (per character):** session date, campaign, title, players, events, rewards, notes, with add/edit/delete.
  Two characters in the same campaign keep separate journals.
- Deleting a character asks for confirmation and cascades to its attributes, equipment and journal (`ON DELETE CASCADE`, `PRAGMA foreign_keys = ON`).
- Validation on both the client (instant field messages) and the server (authoritative).

## API summary

All JSON. Errors are always `{ "error": { "code", "message", "fields"? } }`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{email, password, displayName?}` → 201, sets cookie, starts on Free |
| POST | `/api/auth/login` | `{email, password}` → 200 / 401 |
| POST | `/api/auth/logout` | 204 |
| GET | `/api/auth/me` | current user / 401 |
| GET | `/api/plans` | public plan list |
| GET / PUT | `/api/subscription` | usage summary / change plan `{planId}` (400 unknown, 409 same plan) |
| GET / POST | `/api/characters` | list own / create (`attributes: [{name,value}]` optional; 403 `PLAN_LIMIT_REACHED`) |
| GET / PUT / DELETE | `/api/characters/:id` | profile includes `attributes`, `equipment`, `journalEntries` |
| GET / POST | `/api/characters/:id/{attributes,equipment,journal}` | list / create |
| PUT / DELETE | `/api/characters/:id/{attributes,equipment,journal}/:itemId` | update / delete |

Another user's id always returns **404**, never 403, so ids can't be probed.

## Project structure

```
version1-react-express/
├── client/                 Vite + React app
│   ├── src/api.js           fetch wrapper (cookies, error mapping, 401 → login)
│   ├── src/AuthContext.jsx  current user + subscription
│   ├── src/validation.js    client-side rules mirroring the server
│   ├── src/components/      AppShell (header/nav/footer), Field, ConfirmDialog, route guards
│   ├── src/pages/           Login, Register, Plans, Account, Dashboard, CharacterForm, CharacterProfile
│   ├── src/profile/         Attributes / Equipment / Journal panels (profile tabs)
│   └── src/styles/          style.css (original design, copied unchanged) + app.css (additions)
├── server/
│   ├── src/schema.sql       tables, cascades, plan seed (also used by version 2)
│   ├── src/db.js            connection, foreign keys, write transactions
│   ├── src/auth.js          sessions + requireAuth
│   ├── src/validation.js    field specs and checks
│   ├── src/routes/          auth, plans/subscription, characters (+ child resources)
│   └── tests/               node:test suites
└── docs/screenshots/       core flows
```

## Deviations from the requirements doc

The requirements doc (`RPG_Campaign_Chronicles.md`) was removed from the repo after the build; it's still in git history.

- **Sessions table added** (not in the suggested schema) so logins are server-side and logout really revokes them.
- **Extra columns:** `characters.max_health` (to show "42/50"), `characters.abilities` (keeps the original "Powers & Abilities" field),
  `created_at`/`updated_at` timestamps, `plans.sort_order`, `character_attributes.position`.
- **Plan ids are text slugs** (`free`, `adventurer`, `hero`, `legend`). Prices are $0/$5/$10/$15 per month, display only.
- **Attribute values are text**, so "14", "d8" and "Shaken" all work.
- **Ownership violations return 404** instead of 403 (doesn't reveal that the id exists).
- From the original Realm Forge frontend: renamed to RPG Campaign Chronicles; username replaced by email; Payment Portal **removed** (plan
  changes are a confirm dialog); `localStorage` replaced by the API; race/class dropdowns became free-text species/role; the fixed
  STR–CHA grid became the custom attribute editor. The social footer was kept as decoration (its links are `#` placeholders).

## Known issues / limitations

- No login rate limiting, password reset, email change, or account deletion (not in scope).
- Plan changes are simulated: no billing provider. `provider_subscription_id` exists but is unused.
- Attributes are kept in creation order. The `position` column exists, but there's no drag-to-reorder UI.
- Expired sessions are cleaned up lazily (on login, or when an expired cookie is presented).
- Editing a character's core fields and its attributes happen in two places: the edit form covers core fields, and attributes are edited inline on the profile's Overview tab.

## Manual fixes after generation

This version was written with Claude Code, then run and tested. Problems found by running it and fixed:

1. **"database is locked" on startup** when two server processes opened a new DB at the same moment (found by the cross-process
   concurrency test). Root cause: `PRAGMA journal_mode=WAL` ignores the busy timeout. Fix: schema setup runs inside `BEGIN IMMEDIATE`, and the WAL switch retries on `SQLITE_BUSY`.
2. **Form labels not linked to inputs** in the equipment and journal forms (found by the browser test, which couldn't find fields by label,
   and it's also a screen-reader problem). Fix: the `Field` component now generates an id and links the label, `aria-invalid` and `aria-describedby` automatically.
3. **Missing favicon 404** in the console. Fix: inline SVG emoji favicon.
4. **Profile header buttons had uneven heights** (link-buttons vs. real buttons). Fix: shared padding rule.
5. Test-only: supertest started a new HTTP server per request in parallel tests (`MaxListenersExceededWarning`). Fix: one listening server per test app.
