# RPG Campaign Chronicles: Version 2 (React + Flask + SQLite)

The same app as Version 1, with the Express backend rewritten in **Python / Flask**. The React client is
Version 1's client, unchanged except for where its dev server forwards `/api` (Flask on port 5001).
The API contract (URLs, JSON shapes, status codes, error format) and the SQLite schema are identical,
so either backend can serve the same frontend.

| | |
|---|---|
| Frontend | React 19 + React Router 7, built with Vite 8 (`client/`, shared with V1) |
| Backend | Python 3.11+ / Flask 3.1 (`server/`) |
| Database | SQLite via Python's built-in `sqlite3`, stored in `server/data/app.db`; same `schema.sql` as V1 |
| Auth | `bcrypt`-hashed passwords, httpOnly session cookie backed by a `sessions` table |
| Tests | `pytest`, 19 tests (ports of V1's tests, plus a threaded-server race test) |
| Built with | Claude Code (AI pair programmer) |

## Prerequisites

- **Python 3.11 or newer.** Developed on Python 3.14.6, and the test suite was also run on 3.12.15. Python 3.11 wasn't available on the dev machine, but the code uses no syntax newer than 3.11.
- **Node.js 22.13+** for the React dev server (developed on Node 26.11.1 / npm 11.20.0).
- No database server: SQLite is built into Python, and the file is created on first start.

## Setup

```bash
cd week8/version2-react-flask

# 1. backend
cd server
python3 -m venv venv
source venv/bin/activate            # windows: venv\Scripts\activate
pip install -r requirements-dev.txt # runtime deps + pytest (requirements.txt alone for runtime)
cp .env.example .env
# put a long random value in SESSION_SECRET, e.g. paste the output of:
python -c "import secrets; print(secrets.token_hex(32))"

# 2. frontend
cd ../client
npm install
```

## Run (development: two terminals)

```bash
# terminal 1: API on http://localhost:5001
cd week8/version2-react-flask/server
source venv/bin/activate
python run.py

# terminal 2: React app on http://localhost:5173
cd week8/version2-react-flask/client
npm run dev
```

Open **http://localhost:5173**. Vite forwards every `/api/*` request to Flask, so the cookie stays same-origin and no CORS setup is needed.

**Why port 5001 and not Flask's usual 5000:** on macOS 12+, the AirPlay Receiver (ControlCenter) already listens on port 5000 and answers
with `403 AirTunes`. Requests to `localhost:5000` never reach Flask.

### Run (single port, production-style)

```bash
cd week8/version2-react-flask/client && npm run build
cd ../server && python run.py
```

Open **http://localhost:5001**. When `client/dist` exists, Flask serves the built React app as well as the API.
`run.py` uses Flask's built-in threaded server, which is fine for this project. A real deployment would put it behind a WSGI server such as gunicorn.

## Tests

```bash
cd week8/version2-react-flask/server
source venv/bin/activate
pytest
```

19 tests, ported one-to-one from V1, so both backends are checked against the same behavior:
- **Auth (`test_auth.py`):**
  - registration hashes passwords with bcrypt
  - duplicate email returns 409 (case-insensitive)
  - password and email rules
  - wrong password and unknown email return the same 401
  - an over-72-byte password at login gets a clean 401, not a crash
  - logout revokes the session server-side
  - every protected route returns 401 without a session
  - the plans list is public
- **Ownership (`test_ownership.py`):**
  - another user gets 404 for every read/write on someone else's characters, attributes, equipment and journal, including mixing their own character id with another user's item ids
  - journals are per character
- **Plans (`test_plans.py`):**
  - the 11th character on Free gets a 403
  - plan changes are validated and kept as history
  - a downgrade keeps all characters, blocks creates and still allows edits
  - **two race tests:** 10 parallel creates on one threaded Flask server, and 24 parallel creates spread over **2 separate server processes sharing one DB file**. Exactly the plan limit succeeds in each.
- **Characters (`test_characters.py`):**
  - CRUD for characters, attributes, equipment and journal
  - cascade delete
  - per-field 400 validation (impossible dates, negative or fractional or boolean quantities)
  - invalid JSON returns 400, wrong content type 415, oversized body 413, bad ids and unknown routes 404, all without stack traces

**Checking that the race tests can fail:** with the `BEGIN IMMEDIATE` lock temporarily removed from `db.write_transaction`, the
two-process test failed (18 characters created on a 10-character plan). The single-process threaded test still passed, because
Python's GIL rarely lets the threads interleave at exactly the wrong moment. The two-process test is the one that proves the lock works.

The UI was also tested end-to-end in headless Chrome against Flask: register → plan → create with custom attribute → equipment
validation and add → journal → reload → account meter → delete → logout / bad login / login → plan limit 403 in the UI → downgrade
warning and over-limit dashboard. All 11 checks pass. That script isn't part of this folder; see `../dev-log.md`.

## Environment configuration

`server/.env` (copy from `server/.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5001` | API port |
| `DATABASE_PATH` | `./data/app.db` | SQLite file, relative to `server/` |
| `SESSION_SECRET` | none, **required** (min 16 chars) | HMAC key used to hash session tokens before storing them. The server refuses to start without it. |
| `SESSION_TTL_DAYS` | `7` | How long a login lasts |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost (tests use 4 for speed) |

`client/.env` (optional, from `client/.env.example`): `API_PROXY_TARGET` (default `http://127.0.0.1:5001`) and `CLIENT_PORT` (default `5173`).

## Features and API

Identical to Version 1. See `../version1-react-express/README.md` for the feature list and the API table.

## Project structure

```
version2-react-flask/
├── client/                    V1's React app (only vite.config.js / .env.example changed: proxy -> 127.0.0.1:5001)
└── server/
    ├── run.py                 entry point (python run.py)
    ├── requirements.txt       Flask, bcrypt, python-dotenv (pinned)
    ├── requirements-dev.txt   + pytest
    ├── app/__init__.py        create_app: json parsing, 415/413 checks, sessions, blueprints, optional SPA serving
    ├── app/schema.sql         copy of V1's schema
    ├── app/db.py              per-request sqlite connections, foreign keys, BEGIN IMMEDIATE transactions, WAL
    ├── app/auth.py            sessions + require_auth
    ├── app/validation.py      field specs and checks (same rules and messages as V1)
    ├── app/errors.py          {"error": {code, message, fields}} responses; 500s are logged, never sent
    ├── app/routes/            auth, plans/subscription, characters (+ generic child CRUD)
    └── tests/                 pytest suites
```

## Differences from Version 1 (and why)

- **One SQLite connection per request** instead of one shared connection. Flask serves requests on multiple threads, and a
  `sqlite3` connection must not be shared between threads. So unlike V1, requests in one process really do run at the same time,
  and the `BEGIN IMMEDIATE` count-and-insert is what stops them going over the plan limit.
- Python's `sqlite3` is opened with `isolation_level=None` so it doesn't start transactions on its own. All transactions
  are the explicit `BEGIN IMMEDIATE ... COMMIT` in `db.write_transaction`.
- **bcrypt 5 raises an error for passwords over 72 bytes**, where V1's `bcryptjs` silently cut them short. Registration already rejects them;
  login treats them as a wrong password (401) instead of crashing.
- Express's `express.json()` behavior is reproduced by hand: only objects and arrays are accepted, and `NaN`/`Infinity` are rejected
  as invalid JSON (Python's `json` module would otherwise accept them).
- A 405 (known URL, wrong method) is reported as 404 `NOT_FOUND`, matching V1.

## Known issues / limitations

Same as Version 1: no login rate limiting, password reset or account deletion; plan changes are simulated; expired sessions are cleaned up lazily.

## Manual fixes after generation

1. **Port 5000 taken by macOS AirPlay.** Found by checking the port before starting: `lsof` showed ControlCenter listening, and `curl` got
   `403 AirTunes`. Fix: default to 5001.
2. **Proxy target `localhost` vs `127.0.0.1`.** Flask binds IPv4 `127.0.0.1`, and Node can resolve `localhost` to IPv6 `::1`, so the client
   now forwards to `127.0.0.1:5001` explicitly.
3. **The client folder was first committed with `node_modules/` and `dist/`** (from a Windows machine). The `node_modules/.bin/vite`
   script had no execute permission on macOS, and the native binaries were Windows-only. Fix: a root `.gitignore`; those folders were removed
   from git (`git rm --cached`) and are rebuilt by `npm install`.
