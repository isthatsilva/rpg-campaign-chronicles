# RPG Campaign Chronicles

A system-neutral tabletop RPG character manager built with Vue, Vite, Tailwind CSS, and Supabase.

## Setup

1. Install Node.js.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env` and add your Supabase URL and anon key.
4. Open the Supabase SQL editor and run the migration at `supabase/migrations/202611020001_create_rpg_chronicles.sql`.
5. In Supabase Authentication settings, turn off email confirmation so registration can sign users in immediately.
6. Start the app:

   ```sh
   npm run dev
   ```

The app uses Supabase Auth and Row Level Security. The browser only uses the public anon key; the service-role key is not needed.
