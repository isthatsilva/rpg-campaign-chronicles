# Bolt.new follow-up prompts: RPG Campaign Chronicles (Version 3)

> **For us, not for Bolt.** The first prompt (`bolt-prompt.md`) produced a good design and a mostly correct SQL migration,
> but the app was a mockup: login was faked with a timer, all data was hardcoded sample data, and nothing was saved to Supabase.
> These two follow-ups go into the **same Bolt chat**, one at a time. Paste message 1, wait until Bolt finishes and the preview
> builds, then paste message 2. Copy only the text inside each box. If Bolt stops partway, reply "continue", and save what you sent.

---

## Message 1: real auth, real data, split into pages

```
The design is great. Keep the look exactly as it is (style.css, layout, colors, ribbon, corners). But the app is currently a mockup: login is faked with setTimeout and every character, plan, equipment item and journal entry is hardcoded sample data. Make it a real app backed by Supabase. Do it in this order:

1. NO FAKE DATA. Remove every hardcoded sample (characters, equipment, journal, attributes, the default user "Mira Stone", plan list). All data must come from Supabase through src/lib/supabase.ts. If VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing, show a clear "Supabase is not configured: copy .env.example to .env" screen instead of falling back to demo values. Do not use Bolt's Supabase integration; I run the SQL myself.

2. Fix the SQL migration in supabase/migrations/:
   - The first DO $$ loop creates "<table>_read" policies for ARRAY['characters','character_attributes','equipment','journal_entries'] using character_id. The characters table has no character_id column, so this fails. Remove 'characters' from that array (characters_read is created separately below it).
   - Rename the free plan back to 'Free' (not 'Wanderer') everywhere, including the trigger's coalesce fallback.
   - Allow negative health (remove the health >= 0 check); max_health stays >= 0.

3. Split App.vue into a real Vue Router setup: src/router.ts with routes /login, /register, /plans, /characters, /characters/new, /characters/:id (tab in ?tab=overview|equipment|journal), /characters/:id/edit, /account, and / redirecting to /characters. One component per page in src/pages/. App.vue keeps only the frame, header, footer and <router-view>. Add a route guard: signed-out users go to /login; signed-in users visiting /login or /register go to /characters. Use a small auth store (src/stores/auth.ts with reactive state, no Pinia needed) that loads the session with supabase.auth.getSession() on startup and listens to onAuthStateChange.

4. Auth:
   - Register: supabase.auth.signUp({ email, password, options: { data: { display_name } } }). Validate on the client first: valid email, password 8+ chars with at least one letter and one number, confirm password matches, display name <= 50. On success go to /plans?welcome=1.
   - Login: supabase.auth.signInWithPassword. On any failure show "Email or password is incorrect."
   - Logout: supabase.auth.signOut(), then /login.
   - Header shows the profile's display_name (or email) and the active plan name from the database.

5. Plans and subscription:
   - /plans reads plans from the plans table (order by sort_order) and the user's active subscription: supabase.from('subscriptions').select('plan_id, plans(*)').eq('status', 'active').single().
   - Confirm dialog calls supabase.rpc('change_plan', { new_plan_id }). Show the server's error message if it fails. When downgrading below the current character count, the dialog warns: "You have N characters, which is over this plan's limit of L. You'll keep them all, but you can't create new ones until you're under the limit."
   - After ?welcome=1 and a successful choice, go to /characters.

6. Characters:
   - Dashboard lists the user's characters from the characters table (order by name), shows "count / limit", disables Create at the limit with an explanation, and shows a warning banner when over the limit.
   - Create: insert into characters (user_id defaults to auth.uid()), then insert the custom attributes rows (character_id, name, value, position). Empty optional fields are saved as null, not 0 or "". New characters start with NO attributes; "Use D&D defaults" adds the six with value 10.
   - If the insert fails with code 42501 / a message starting with PLAN_LIMIT_REACHED, show the message after the colon.
   - Edit page loads the character and updates it. Delete asks for confirmation, then deletes the row (the database cascades to attributes, equipment and journal).
   - Client-side validation mirrors the database: name required (<= 100), species/role <= 100, level 0-10000, max health >= 0, experience >= 0, whole numbers only, abilities/biography <= 5000. Show per-field messages and disable Save while saving.

Map Supabase errors to friendly messages; never show raw SQL errors. Don't change anything about the equipment, journal and account screens yet except removing their fake data; I'll ask for those next.
```

---

## Message 2: profile tabs and account page

```
Thanks. Now wire up the rest, keeping the same design:

1. Character profile (/characters/:id) loads the character plus its character_attributes (order by position), equipment (order by item_name) and journal_entries (order by session_date desc). If the character isn't found (or belongs to someone else, which RLS hides), show "Character not found" with a link back. Tab counts come from the real data.

2. Overview tab: show core stats (level, health/max health, experience), Powers & Abilities and backstory, and the custom attributes with inline add, edit and remove (name <= 50, value <= 100, both required; max 50 per character; show the database error if the limit is hit). Remove the fake "Next level / 62%" XP bar.

3. Equipment tab: add, edit and remove items (item name required <= 100, type <= 50, quantity whole number >= 0 defaulting to 1, description <= 1000). Remove asks for confirmation.

4. Journal tab: add, edit and delete entries with session date (required, real calendar date), title (required <= 150), campaign name, players present, important events, rewards, notes. Newest first. Delete asks for confirmation. Each character has its own journal.

5. Account page: email, display name (editable, <= 50, saved with supabase.from('profiles').update({ display_name })), current plan with price, and a usage meter "X of L slots used · R remaining" from the real character count. Remove the placeholder "Edit profile" button if it does nothing.

6. Small fixes: set the page <title> to "RPG Campaign Chronicles"; replace the Vite favicon with an inline ⚔️ emoji SVG favicon; remove src/components/HelloWorld.vue and src/assets/vue.svg; replace the template README with a README that explains setup (npm install, .env from .env.example, run the SQL migration in the Supabase SQL editor, turn off email confirmation, npm run dev).

Every button must do something real or be removed. No sample data anywhere.
```
