# Bolt.new Prompt: RPG Campaign Chronicles (Version 3)

> **For us, not for Bolt.** Paste everything below the line into bolt.new. Before testing the result:
> 1. In Supabase, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**, then set the minimum password length to **8**.
> 2. Run the SQL migration Bolt writes (`supabase/migrations/*.sql`) in the Supabase SQL editor (we are not using Bolt's Supabase integration, which needs Bolt Pro).
> 3. Put the project URL and **anon** key in `.env` (never the service-role key).
> 4. Export the project to `week8/version3-vue-bolt/`.
>
> Versions 1 and 2 implement the same behavior, so use them as the reference when reviewing Bolt's output.

---

## App concept
Build **"RPG Campaign Chronicles"**, a system-neutral tabletop RPG character manager. A user signs up, picks a (simulated) subscription plan that sets how many characters they can have, and manages characters. Each character has custom attributes, equipment, and its **own** session journal. Two characters in the same campaign keep separate journals.

## Tech stack
- **Frontend:** Vue 3 (Composition API, `<script setup>`), Vue Router 4, Vite.
- **Backend / database / auth:** Supabase (Postgres, Supabase Auth, Row Level Security, SQL functions and triggers).
- **Styling:** Tailwind CSS, configured with the exact design tokens below.
- Pin **exact** dependency versions in `package.json` (no `^` or `~`).
- Supabase URL and anon key come from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env`. Commit a `.env.example` and a `.gitignore` (node_modules, dist, .env).
- Put **all** database setup (tables, constraints, RLS policies, functions, triggers, seed data) in one SQL migration file under `supabase/migrations/`.
- **Do not use Bolt's Supabase integration** and don't wait for a Supabase connection. Write the migration SQL file and read the keys from `.env`. I will run the SQL myself in the Supabase SQL editor.

## Visual identity (match the existing design)
A dark "arcane" theme: deep indigo night background, glowing violet borders, gold headings.
- **Fonts (Google Fonts):** `Cinzel` (700) for headings, nav links and buttons (uppercase); `MedievalSharp` for small accent labels (tier name, stat labels); `Quicksand` (400/500) for body text.
- **Colors:**
  - primary `#8b5cf6` (hover `#7c3aed`)
  - page background `#020617` with a faint diagonal-line pattern and a purple radial glow in the center
  - card background `#1e1b4b` with a gradient to `#0f172a`
  - text `#f8fafc`, muted text `#94a3b8`
  - gold accent `#fbbf24` (all headings, active nav/tab)
  - danger `#ef4444`
  - border `#4338ca`
  - glow `rgba(139, 92, 246, 0.4)`
- **Main frame ("magic border"):** the whole app sits in one centered card (max width about 960px) with a 4px border whose color runs gold → violet → gold top to bottom, plus an outer and inner violet glow (`box-shadow: 0 0 20px` glow, `inset 0 0 20px` glow). A 🌿 emoji sits just outside the top-left corner and a 🔥 just outside the bottom-right, both at 60% opacity.
- **Header (signed in):** "Welcome, {display name or email}" with the tier name ("Tier: Adventurer") beneath; nav links Characters / Account / Plans and a Logout button on the right; a violet divider line below.
- **Footer:** small decorative links "Twitter 🐦 · Discord 🎮 · Patreon 🛡️" (`href="#"`).
- **Plan cards:** four cards side by side, each showing its name, price per month and character limit. The **Adventurer** card has a gold diagonal "Popular" ribbon in its corner.
- **Character cards:** a grid of cards with name, "Species · Role", level and health ("42/50"), and View / Edit / Delete buttons.
- Must work at phone width (single column, no horizontal scroll).

## Data model (Supabase / Postgres)
Use `uuid` primary keys with `gen_random_uuid()` and `timestamptz` timestamps (`created_at`, `updated_at` default `now()`).

1. **plans** (seeded, read-only to users)
   - `id` text PK: `'free'`, `'adventurer'`, `'hero'`, `'legend'`
   - `name` text
   - `character_limit` int > 0: 10 / 15 / 25 / 50
   - `price_cents` int ≥ 0: 0 / 500 / 1000 / 1500
   - `sort_order` int
2. **profiles**: one row per auth user, created automatically by a trigger on `auth.users` insert.
   - `id` uuid PK references `auth.users(id)` on delete cascade
   - `email` text
   - `display_name` text (≤ 50 chars)
   - `created_at`
3. **subscriptions**: plan history. Every new user gets an active `'free'` row from the same signup trigger.
   - `id`
   - `user_id` → profiles, on delete cascade
   - `plan_id` → plans
   - `status` `'active'` | `'canceled'`
   - `started_at`, `ends_at`
   - A partial unique index ensures **at most one active subscription per user**.
4. **characters**
   - `id`, `user_id` → profiles (on delete cascade)
   - `name` text not null (1–100 chars)
   - `species`, `role` text (≤ 100, free text)
   - `level` int 0–10000
   - `health` int
   - `max_health` int ≥ 0
   - `experience` int ≥ 0
   - `abilities` text ("Powers & Abilities", ≤ 5000)
   - `biography` text (≤ 5000)
   - `created_at`, `updated_at`
   - Every field except `name` is optional.
5. **character_attributes**: custom name/value pairs.
   - `id`, `character_id` → characters (on delete cascade)
   - `name` text not null (1–50)
   - `value` text not null (1–100). Text, so "14", "d8" and "Shaken" all work.
   - `position` int
   - At most **50 per character**, enforced by a trigger.
6. **equipment**
   - `id`, `character_id` → characters (on delete cascade)
   - `item_name` text not null (1–100)
   - `item_type` text (≤ 50)
   - `quantity` int not null default 1, ≥ 0
   - `description` text (≤ 1000)
7. **journal_entries**
   - `id`, `character_id` → characters (on delete cascade)
   - `session_date` date not null
   - `title` text not null (1–150)
   - `campaign_name` (≤ 100), `attendees` (≤ 500), `events` (≤ 5000), `rewards` (≤ 2000), `notes` (≤ 5000)
   - `created_at`, `updated_at`

Enforce every length and range above with **CHECK constraints**, so the database rejects bad data even if the frontend is bypassed.

## Security: Row Level Security on every table
- Enable RLS on **all** tables.
- `plans`: anyone can select. No one can write.
- `profiles`: users can select their own row and update only their own `display_name`.
- `subscriptions`: users can select their own rows. No direct insert/update/delete; changes go only through the `change_plan` function below.
- `characters`: select/insert/update/delete only where `user_id = auth.uid()`. On insert, `user_id` must equal `auth.uid()`.
- `character_attributes`, `equipment`, `journal_entries`: allowed only when the parent character belongs to `auth.uid()` (an `exists (select 1 from characters c where c.id = character_id and c.user_id = auth.uid())` check in both `using` and `with check`).
- The frontend must never use the service-role key.

## Plan limits: enforced in the database, race-safe
- Add a **BEFORE INSERT trigger on `characters`** that does the following, in order:
  1. Locks the user's profile row (`select ... from profiles where id = new.user_id for update`). Parallel inserts by the same user then run one at a time.
  2. Reads the limit from the user's active subscription and counts the user's characters.
  3. If `count >= limit`, raises `PLAN_LIMIT_REACHED: Your {Plan} plan allows {limit} characters and you have {count}. Delete a character or upgrade your plan to create another.` with `ERRCODE = '42501'`. PostgREST returns this as **HTTP 403**.
- The frontend recognizes that error and shows its message.
- **`change_plan(new_plan_id text)`:** a `security definer` SQL function (with `set search_path = public`) that:
  - rejects unknown plan ids
  - rejects choosing the current plan (`ALREADY_ON_PLAN`)
  - marks the active subscription `canceled` with `ends_at = now()`
  - inserts a new active row
  - runs as one transaction, and acts only on `auth.uid()`
- **Downgrades** below the current character count are allowed. All characters are kept and stay editable, but creating new ones is blocked until the user deletes enough or upgrades.
- **No real payments:** choosing a plan opens a confirmation dialog ("Switch to Hero? $10/month · 25 characters. This is a simulated plan change; no payment is collected."). **No card fields, no Stripe/PayPal, no checkout page.**

## Pages and flows
- **`/register`:**
  - fields: email, password, confirm password, optional display name
  - password rule: 8+ characters with at least one letter and one number
  - on success, go to `/plans?welcome=1`
- **`/login`:** email and password. Show "Email or password is incorrect." for any failure.
- **`/plans`:** the four plan cards with a "Current plan" tag on the active one, a "Choose {Plan}" button on the others, and the confirmation dialog. When downgrading below the current count, the dialog warns: "You have 12 characters, which is over this plan's limit of 10. You'll keep them all, but you can't create new ones until you're under the limit."
- **`/characters`** (dashboard):
  - the card grid
  - a "{count}/{limit} Characters" counter
  - a "Create New Character" button, disabled at the limit, with an explanation and a link to upgrade
  - a warning banner when over the limit
- **`/characters/new`** and **`/characters/:id/edit`:**
  - only Name is required. Species, role, level, health / max health, experience, Powers & Abilities and backstory are optional.
  - on create, a custom attribute editor: add/remove name/value rows, plus a **"Use D&D defaults"** button that adds Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma with value 10
- **`/characters/:id`** (profile), with tabs kept in the URL (`?tab=`):
  - **Overview:** core stats and backstory, plus inline add/edit/remove of custom attributes
  - **Equipment:** add/edit/remove items
  - **Journal:** add/edit/delete session entries, newest first. Each entry shows date, campaign, title, players present, important events, rewards and notes.
- **`/account`:** email, display name, current plan and a usage meter ("3 of 10 slots used · 7 remaining").
- Every delete (character, item, entry, attribute) asks for confirmation first. Deleting a character warns that its attributes, equipment and journal will be deleted too (via `ON DELETE CASCADE`).
- Unauthenticated users are redirected to `/login`. Logged-in users visiting `/login` or `/register` go to `/characters`. Sessions survive a page reload.

## Validation and errors
- **Frontend:** instant per-field messages that mirror the database rules: required fields, lengths, whole numbers ≥ 0 where applicable, and a real calendar date. Disable submit buttons while saving.
- **Backend:** the CHECK constraints, triggers and RLS above are the source of truth. Map Supabase errors to friendly messages: plan limit (403), duplicate email, invalid login, constraint violations, network failure. Never show raw SQL or stack traces.
- Show loading states and empty states ("No characters yet. Create your first hero!").

## Out of scope (do not add)
Real payments or card fields, social login, password reset, file/image uploads, admin pages, sharing between users.
