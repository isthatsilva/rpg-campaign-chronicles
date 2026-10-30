# RPG Campaign Chronicles — Claude Code Prompt (Week 8)

## Your role

You're working in my terminal as my pair programmer on a CS146S assignment: **Week 8 – Multi-Stack AI-Accelerated Web App Build**. I'm a CS student, so explain decisions briefly, in plain language, as you go.

**Start with analysis only.** Don't create, change, or delete any files until I approve your plan (see "Phase 0" at the bottom).

---

## 1. Files to read first (in this order)

The terminal is opened in my `week8/` folder. Find these files yourself and don't assume paths beyond what's listed:

1. `assignment.md`: the official assignment and grading rubric. **This is the source of truth for what gets graded.**
2. `RPG_Campaign_Chronicles.md`: my full app requirements (features, data model, validation, pages). **This is the source of truth for what the app does.** Don't make me repeat its contents. Read it completely.
3. `writeup.md`: the writeup template I have to fill in. Its exact fields decide what you need to track while we build.
4. `rpg-character-creator/public/`: my existing vanilla HTML/CSS/JS frontend (`index.html`, `css/style.css`, `js/app.js`).

If `assignment.md` and `RPG_Campaign_Chronicles.md` disagree, the assignment wins. Tell me about the conflict.

---

## 2. Assignment constraints (from `assignment.md`)

- Three versions of the same app, each with a **distinct stack**, each in its own folder inside `week8/`.
- **At least one version must be built with bolt.new.** That's 10 rubric points. You can't run Bolt, so for that version your job is to (a) write the Bolt prompt for me, (b) review, fix, and document the code after I export it into `week8/`.
- **At least one version must use a non-JavaScript language** (Flask/Python here).
- Each version needs: source code, a `README.md` (prerequisites, install/setup, run commands, env configuration), and **notes on deviations, known issues, and manual fixes made after generation**.
- `writeup.md` needs the App Concept plus, for each version: folder name, AI app generation platform, tech stack, persistence, frameworks/libraries, and reflections (issues per stack and how they were resolved, prompting notes, approximate time-to-first-run and time-to-feature).

---

## 3. Planned versions

| # | Folder | Stack | Built with |
|---|---|---|---|
| 1 | `week8/version1-react-express/` | React (Vite) + Express + SQLite | Claude Code (you) |
| 2 | `week8/version2-react-flask/` | React (Vite) + Flask (Python) + SQLite | Claude Code (you) |
| 3 | `week8/version3-vue-bolt/` | Vue + Bolt's backend/persistence choice | **bolt.new** (I run it; you write the prompt and clean up afterward) |

Notes:
- Build Version 1 first and test it fully. Version 2 can reuse Version 1's React frontend (copied into its own folder, not shared), with a new Flask backend and its own database, exposing the **same API contract**, so the frontend should only need its API base URL changed.
- For Version 3: Bolt runs in a browser sandbox and may not support SQLite well. If it picks a different persistence layer (e.g. Supabase or browser storage), accept it and document it as a deviation. Don't fight the tool. The feature set should still match.
- Each version must be independently runnable with its own database file and config. No shared backend.
- If you think a different split is better (e.g. Bolt for Version 1), make the case during planning.

---

## 4. My existing frontend: preserve it, but it has known conflicts

**Never modify or delete `rpg-character-creator/`.** It's my backup and design reference. Copy from it; don't move it.

Keep its visual identity in Versions 1 and 2: layout, colors, fonts (Cinzel / MedievalSharp / Quicksand), the "magic-border" style, and view structure. Split it into React components instead of rewriting the look.

Things I already know conflict with my requirements. **Confirm each of these with me during planning; don't decide on your own:**

1. **App name:** the frontend says "Realm Forge"; requirements say "RPG Campaign Chronicles."
2. **Login:** frontend uses a username; requirements say email + password + optional display name.
3. **Plans:** frontend has 3 tiers (Free/10, Squire $5/15, Archmage $15/50). Requirements propose 4 (Free/10, Adventurer/15, Hero/25, Legend/50) with unset prices. Free = 10 and second tier = 15 are confirmed; the rest is my call.
4. **Checkout page:** the frontend has a "Payment Portal" that asks for card details. **This must be removed or replaced** with a simple "select plan" confirmation. Never collect, store, or simulate entry of card numbers. No Stripe/PayPal/real payments.
5. **Storage:** `app.js` uses `localStorage`. Replace it with real API calls; the backend + SQLite becomes the source of truth.
6. **Missing features:** the frontend doesn't appear to have custom attributes, equipment/inventory, or full journal CRUD. Check this against the requirements doc and list exactly what's missing.

---

## 5. Non-negotiables (details are in `RPG_Campaign_Chronicles.md`)

- **Auth:** hashed passwords (bcrypt or argon2; never plaintext), unique validated email, secure sessions or tokens, secrets in `.env` (with a committed `.env.example`), protected routes.
- **Ownership:** every query on characters, attributes, equipment, and journal entries is scoped to the logged-in user **on the backend**. Users can never read or change another user's data, even by guessing IDs.
- **Plan limits:** enforced on the backend, inside a transaction (count + insert together) so parallel requests can't go over the limit. Downgrading keeps existing characters but blocks new ones while over the limit. New users start on Free.
- **System-neutral:** no required D&D fields. Attributes are user-defined name/value pairs.
- **Journals are per-character.** Two characters in the same campaign have separate entries. No syncing.
- **Deleting a character** asks for confirmation and cascades to its attributes, equipment, and journal entries (`ON DELETE CASCADE`, with SQLite foreign keys turned on).
- **Validation on both frontend and backend**, with clear error messages and correct HTTP status codes (400/401/403/404/409, etc.), and no leaked stack traces.
- **No extra features** (portraits, exports, search, templates) unless I approve them.

---

## 6. How to work

- **One phase at a time.** At the end of each phase, give me a short report: what you built, files created/changed, how to run and test it, what's left. Then **stop and wait for my approval**.
- Inspect files before editing them. Don't touch unrelated files. Ask before anything destructive (deleting folders, resetting git, overwriting files).
- Keep dependencies minimal and stable. Pin versions in `package.json` / `requirements.txt`.
- When something breaks, find the root cause; don't stack random fixes. Run the code; don't just write it.
- **Never claim something works unless you actually ran or tested it.** If you couldn't test something, say so and give me manual steps.
- If a requirement is unclear, check `RPG_Campaign_Chronicles.md` first, then ask me.
- Code comments: lowercase, except where proper names need capitals (class names, `TODO`, etc.). When editing existing code, leave existing comments as they are unless the code they describe changes.
- Add a `.gitignore` to each version (`node_modules/`, `venv/`, `.env`, `*.db`).

### Keep a dev log (needed for the writeup)

Create `week8/dev-log.md` and append a short entry at each milestone: date/time, version, what was done, problems hit and how they were fixed, and notable prompting notes (what needed extra guidance from me). Record when each version **first ran** and when each **core feature first worked**. `writeup.md` asks for time-to-first-run and time-to-feature. Use real timestamps (`date`) and don't make up history.

---

## 7. Phases

**Phase 0 — Analysis and plan (no file changes).** Read all files in Section 1. Then give me:
1. A summary of the existing frontend: views, what works, what's missing vs. the requirements.
2. Your answers/recommendations for the 6 conflicts in Section 4, as questions for me to confirm.
3. The proposed folder structure, database schema (tables, keys, cascades), and a REST endpoint list with request/response shapes. These are shared across versions.
4. How you'll turn the vanilla JS views into React components and routes.
5. A rubric checklist mapping each `assignment.md` grading item to where it'll be satisfied.
6. Any other questions. Keep them short and only ask what you actually need.

**→ Stop and wait for approval.**

**Phase 1 — Version 1 (React + Express + SQLite).** Backend first (schema, auth, plans, characters, attributes, equipment, journal), then the React frontend migrated from my design, then integration. Write automated API tests for the critical paths: auth, ownership isolation, plan limit (including a concurrent-create test), cascade delete, and validation. Write the README. **→ Stop for approval.**

**Phase 2 — Version 2 (React + Flask + SQLite).** Copy the V1 frontend, build a Flask backend with the same API contract and its own DB, then run equivalent tests (pytest). Write the README. **→ Stop for approval.**

**Phase 3 — Version 3 (bolt.new).** Write a self-contained Bolt prompt for me (app concept, entities and relationships, pages/flows, plan limits, the no-payment rule, visual style based on my existing design), saved as `week8/bolt-prompt.md`. Bolt can't read my files, so include everything it needs. I'll run it and export the code into `week8/version3-vue-bolt/`. Then review it against the requirements, fix what's broken, log each manual fix in its README, and run what tests you can. **→ Stop for approval.**

**Phase 4 — Final check and writeup.** Re-run all three versions from a clean install using only their READMEs. Fill in `writeup.md` using its exact template fields, based on `dev-log.md` and what actually happened. Leave **Name / SUNet ID / hours** as TODO for me. Go through the rubric checklist item by item and flag any gaps. **→ Stop for final review.**

---

**Begin with Phase 0 now. Do not write code yet.**
