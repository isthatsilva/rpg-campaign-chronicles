# Week 8 Write-up
Tip: To preview this markdown file
- On Mac, press `Command (⌘) + Shift + V`
- On Windows/Linux, press `Ctrl + Shift + V`

## Instructions

Fill out all of the `TODO`s in this file.

## Submission Details

Name: **TODO** \
SUNet ID: **TODO** \
Citations: **bolt.new** (generated Version 3 from `bolt-prompt.md` and `bolt-followup-prompt.md`); **Claude Code** (AI pair programmer: wrote Versions 1 and 2, and reviewed, tested and fixed Version 3); **Supabase** (hosted Postgres, Auth and Row Level Security for Version 3); our own earlier vanilla HTML/CSS/JS front end, "Realm Forge" (its `style.css` is reused unchanged in Versions 1 and 2, and Bolt was given its colors and fonts for Version 3; the original folder was removed from the repo after the build and is still in git history).

This assignment took me about **TODO** hours to do. 

### Team: who did what
- **Partner (GitHub: GalaxyResonance-BA):**
  - created the shared GitHub repo and uploaded the week 8 files (Oct 30)
  - copied the Version 1 React client into `version2-react-flask/client/` (Nov 2)
  - wrote the first draft of `bolt-prompt.md` (Nov 2)
- **Me (with Claude Code):**
  - planned the app and made the design decisions (plans, auth, which fields to keep)
  - built Versions 1 and 2 with Claude Code, including the Flask server and all tests
  - ran bolt.new and set up the Supabase project (SQL migration, auth settings, keys) for Version 3
  - reviewed, tested and fixed Version 3, and wrote the READMEs, `dev-log.md` and this write-up

All times below come from `dev-log.md` and git commit times. They measure from when building that version started to when it first ran, and to when every core feature worked.


## App Concept 
```
RPG Campaign Chronicles: a system-neutral tabletop RPG character manager with a campaign journal for each character.

- Accounts: register with email + password (+ optional display name), log in/out, and the session survives
  page reloads. Passwords are always hashed.
- Plans (simulated, no payment, no card fields): Free (10 characters), Adventurer (15), Hero (25), Legend (50).
  Changing plan is a confirm dialog. The character limit is enforced on the server/database, even under
  simultaneous requests. A downgrade below your current count keeps every character but blocks new ones.
- Characters (the primary resource, full CRUD): only the name is required. Species, role, level, health/max
  health, experience, powers & abilities and backstory are optional. Each character has:
    - custom attributes: any name/value pairs (e.g. "Sanity = Shaken"). New characters start with the six
      D&D attributes (Strength through Charisma, each 10), which the user can change, remove or add to
    - equipment (name, type, quantity, description)
    - a session journal (date, campaign, title, players, events, rewards, notes)
  Deleting a character asks for confirmation and removes its attributes, equipment and journal too.
- Privacy: users can only ever see or change their own data.
- Account page: current plan and a "3 of 10 slots used" meter.
- Validation and clear error messages on both the client and the server/database. The dark indigo-and-gold
  "Realm Forge" look also works at phone width.

The same features, data model and rules are built three times: React + Express + SQLite, React + Flask + SQLite,
and Vue + Supabase (generated with bolt.new).
```


## Version #1 Description
```
APP DETAILS:
===============
Folder name: version1-react-express
AI app generation platform: Claude Code (AI pair programmer in the terminal), driven by a phase-by-phase prompt
  (week8-prompt.md, removed from the repo at the end and still in git history)
Tech Stack: JavaScript end to end: React SPA (Vite) + Node.js/Express REST API + SQLite
Persistence: SQLite file (server/data/app.db) through Node's built-in node:sqlite module. 7 tables with
  ON DELETE CASCADE and foreign keys on, plus a sessions table for logins.
Frameworks/Libraries Used:
  - client: React 19.3, React Router 7.18, Vite 8.3
  - server: Express 5.3, bcryptjs 3.0 (password hashing), dotenv
  - tests: node:test + supertest 7.3 (20 API tests); Playwright (headless Chrome) for the UI click-through
(Optional but recommended) Screenshots of core flows: version1-react-express/docs/screenshots/
  (login, plans, dashboard, create-character, profile-overview, equipment, journal, account, downgrade-warning)

REFLECTIONS:
===============
a. Issues encountered per stack and how you resolved them:
  - Two server processes opening a new database at the same moment crashed one of them with "database is
    locked". Switching SQLite to WAL mode ignores the busy timeout. Fix: create the schema inside
    BEGIN IMMEDIATE and retry the WAL switch. Our concurrency test (2 servers, 1 database, 24 simultaneous
    creates) now gives exactly 10 characters on the Free plan every time.
  - The browser test couldn't find the equipment/journal fields by their labels: the <label>s weren't linked
    to their inputs, which is also an accessibility bug. Fix: the shared Field component generates ids and
    links them.
  - Smaller issues:
    - parallel supertest requests each started their own server (MaxListeners warning), so each test now uses
      one shared server
    - a curl smoke test broke because zsh doesn't split unquoted variables (ran it under bash instead)
    - a favicon 404, uneven header buttons, and long emails overflowing the header

b. Prompting (e.g. what required additional guidance; what worked poorly/wel):
  - Worked well:
    - a long, rule-heavy prompt split into phases, with a stop for approval after each phase
    - having the AI analyse the old front end and list open questions before writing code (Phase 0)
    - explicit non-negotiables: hashed passwords, no card fields, secrets only in .env, root-cause fixes,
      never modify the original design folder
  - Needed guidance:
    - my old front end and the requirements doc disagreed (rubric, folder names, fields), so I had to tell it
      that assignment.md wins and decide each conflict myself
    - "Don't claim it works without testing it" mattered: the browser tests caught bugs that unit tests didn't

c. Approximate time-to-first-run and time-to-feature metrics (decisions confirmed 2026-10-28 20:34 EDT):
  - time-to-first-run (API): ~5 minutes (first curl smoke test 20:39)
  - time-to-first-run (full UI + API): ~50 minutes (~21:25)
  - time-to-feature (all core features working in the UI, tested in a browser): ~60 minutes (~21:35)
```

## Version #2 Description
```
APP DETAILS:
===============
Folder name: version2-react-flask
AI app generation platform: Claude Code (AI pair programmer), same phase-by-phase prompt. My partner copied the
  React client over from Version 1.
Tech Stack: React SPA (Vite) + Python/Flask REST API + SQLite (non-JavaScript backend)
Persistence: SQLite file (server/data/app.db) through Python's built-in sqlite3, using the same schema.sql as Version 1
Frameworks/Libraries Used:
  - client: React 19.3, React Router 7.18, Vite 8.3 (the Version 1 client, plus its own crimson color theme
    and the proxy port)
  - server: Flask 3.1.3, bcrypt 5.0.0, python-dotenv 1.2.4, Python 3.11+ in a venv
  - tests: pytest 9.2.0 (20 API tests); Playwright for the UI click-through
(Optional but recommended) Screenshots of core flows: version2-react-flask/docs/screenshots/
  (plans, dashboard, profile-overview, profile-journal)

REFLECTIONS:
===============
a. Issues encountered per stack and how you resolved them:
  - Port 5000 (Flask's default) is taken on macOS by AirPlay Receiver, which answers "403 AirTunes". Fix: V2 uses port 5001.
  - The Vite proxy to "localhost" could resolve to IPv6 (::1), but Flask only listens on IPv4. Fix: the proxy targets 127.0.0.1.
  - The partner's commit included client/node_modules from Windows (a vite shim that calls node.exe and
    win32-only native binaries), so the client wouldn't start on macOS. Fix: added a root .gitignore,
    untracked node_modules/dist, and ran npm install on each machine.
  - bcrypt 5 (Python) raises an error on passwords longer than 72 bytes, where bcryptjs in V1 silently truncates.
    Fix: login returns a normal 401 for those passwords, and a test covers it.
  - Every pytest test passed on the first run, so I removed the write lock on purpose to check that the tests
    can actually fail. The 2-process race test failed (18 characters on a 10-character plan), but the threaded
    one still passed. So the 2-process test is the real proof. Lock restored.
  - Phase 4 clean re-run: the README's single-port command forgot to activate the venv first; fixed.

b. Prompting (e.g. what required additional guidance; what worked poorly/wel):
  - What made V2 fast: "same API contract, same schema.sql, port V1's tests" plus Version 1's README as the
    spec. The React client only needed the proxy port changed. Later, at my request, V2 got its own
    "crimson ember" color theme (one extra CSS file) so it doesn't look identical to V1.
  - Needed guidance:
    - which Python version to target (3.11+, even though the machine has 3.14)
    - that the client should be reused rather than rewritten
    - an explicit request to prove the race test can fail, since a first-try pass isn't proof

c. Approximate time-to-first-run and time-to-feature metrics (Flask work started 2026-11-02 17:21 EST;
   the client copy was already done by my partner):
  - time-to-first-run (API): ~5 minutes (17:26, all 19 pytest tests passing)
  - time-to-first-run and time-to-feature (full UI through Flask, all core features in the browser): ~8 minutes (~17:29)
  - Phase complete with repo cleanup, mutation check and docs: ~12 minutes (commit at 17:33)
```

## Version #3 Description
```
APP DETAILS:
===============
Folder name: version3-vue-bolt
AI app generation platform: bolt.new (free plan), then reviewed, tested and fixed with Claude Code
Tech Stack: Vue 3 SPA (TypeScript) talking directly to Supabase (hosted Postgres + Auth). There is no server
  of our own: the database is the security boundary.
Persistence: Supabase Postgres. Tables, CHECK constraints, triggers (signup, plan limit with a row lock),
  the change_plan function and Row Level Security policies are all in
  supabase/migrations/202611020001_create_rpg_chronicles.sql.
Frameworks/Libraries Used:
  - Vue 3.4, Vue Router 4.4, Vite 5.4, TypeScript 5.5 + vue-tsc, Tailwind CSS 3.4 + custom CSS
  - @supabase/supabase-js 2.45.4
  - tests: a Node script (npm run test:api, 12 checks against the real database); Playwright for the UI click-through
(Optional but recommended) Screenshots of core flows: version3-vue-bolt/docs/screenshots/
  (plans, dashboard, profile-overview, profile-journal)

REFLECTIONS:
===============
a. Issues encountered per stack and how you resolved them:
  - Bolt's built-in Supabase connection needs the Pro plan. Fix: the prompt told Bolt to write the SQL
    migration file and read keys from .env, and I ran the SQL myself in the Supabase SQL editor.
  - The first export was a polished UI mockup: login was faked with setTimeout, and every screen used
    hardcoded sample data. Its SQL had a policy loop that would have failed partway, renamed the Free plan,
    and didn't allow negative current health.
    Fix: two follow-up prompts in the same Bolt chat (see below).
  - After the second export, three bugs remained, fixed by hand with Claude Code:
    1. Reloading while signed in sent you to the login page: two callers of loadAuth() raced. Fix: every
       caller awaits one shared promise.
    2. The page scrolled sideways on phones, and the corner ornaments were never visible: they sat outside
       their positioned frame. Fix: moved them inside it and used overflow-x: clip.
    3. Users could overwrite their own stored email. Supabase grants UPDATE on all columns by default, so
       Bolt's column grant restricted nothing. Fix: REVOKE first, then grant display_name only.
  - Wrote 12 direct API checks that act like an attacker calling Supabase without the app:
    - plan limit 403, and 24 parallel inserts give exactly 10 characters
    - RLS isolation, locked tables, CHECK constraints, cascade delete
  - Known issues left as-is, listed in the README:
    - empty stats show as 0
  - Later fixes and changes (my requests):
    - styled the attribute rows and journal links, which were unstyled because Bolt used CSS classes it never
      defined (found in the Phase 4 screenshots)
    - fixed editing an attribute also filling the "add attribute" inputs (Bolt shared one draft object between
      the two rows)
    - swapped V3's colors from V1's purple to emerald, so all three versions look different
    - attribute saves aren't atomic
    - deleting an attribute uses window.confirm

b. Prompting (e.g. what required additional guidance; what worked poorly/wel):
  - Worked well:
    - the design tokens (exact colors and fonts from our original style.css) made the look match
    - spelling out the database rules (trigger with a row lock, security-definer function, RLS on every
      table) gave a mostly correct migration on the first try
  - Worked poorly: one very large prompt on the free plan. Without a connected database, and never told
    "no fake data", Bolt filled the screens with sample data instead of wiring them up.
  - The fix was two smaller, focused follow-ups (bolt-followup-prompt.md):
    - message 1: no fake data, the three SQL fixes, real routing/pages, real auth, plans and characters
    - message 2: profile tabs, account page and cleanup
  - Lesson: say explicitly what must be real, keep each prompt small, and always test the export.
    The second export looked finished, but the browser test, the API checks and the screenshots still found
    the bugs above.

c. Approximate time-to-first-run and time-to-feature metrics (final Bolt prompt committed 2026-11-02 18:40 EST):
  - first Bolt export (mockup, runs but isn't functional): ~15 minutes (reviewed 18:55)
  - time-to-first-run against the real database (after the follow-up prompts): ~40 minutes (~19:20)
  - time-to-feature (all core features working and verified, after 3 manual fixes): ~55 minutes (~19:35)
```
