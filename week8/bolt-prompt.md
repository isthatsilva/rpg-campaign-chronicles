# Bolt.new Prompt: RPG Campaign Chronicles

## App Concept
Build a system-neutral tabletop RPG (TTRPG) character manager called **"RPG Campaign Chronicles"**. The app allows users to create and manage multiple characters across different campaigns, each with a personal session journal.

## Tech Stack
- **Frontend:** Vue 3 (Vite)
- **Persistence/Auth:** Supabase (PostgreSQL + Auth)
- **Styling:** Tailwind CSS (with custom fonts and styles for a medieval aesthetic)

## Visual Identity (Crucial)
The app must have a "Magic-Medieval" aesthetic. 
- **Fonts:** Use `Cinzel` for headings, `MedievalSharp` for accents, and `Quicksand` for body text (import via Google Fonts).
- **Styling:** 
    - "Magic-Border" style: High-contrast borders with subtle glows or ornate corners.
    - Palette: Deep parchments, golds, and dark mystical colors.
    - Accents: Use decorative elements like ribbons and nature ornaments (🌿, 🔥).
    - Layout: A clean dashboard for character selection, and a detailed profile view with tabs for the character's Overview, Equipment, and Journal.

## Data Model & Entities
Implement the following schema in Supabase:

1. **profiles** (linked to auth.users)
   - `id` (UUID, PK)
   - `email` (TEXT, UNIQUE)
   - `display_name` (TEXT)
   - `plan_id` (TEXT, references plans)
   - `created_at` (TIMESTAMP)

2. **plans** (Seed this table)
   - `id` (TEXT, PK): 'free', 'adventurer', 'hero', 'legend'
   - `name` (TEXT): 'Free', 'Adventurer', 'Hero', 'Legend'
   - `character_limit` (INT): 10, 15, 25, 50
   - `price` (TEXT): '$0', '$5', '$10', '$15'

3. **characters**
   - `id` (UUID, PK)
   - `user_id` (UUID, FK to profiles, ON DELETE CASCADE)
   - `name` (TEXT, NOT NULL)
   - `species` (TEXT)
   - `role` (TEXT)
   - `level` (INT)
   - `health` (INT)
   - `max_health` (INT)
   - `experience` (INT)
   - `abilities` (TEXT)
   - `biography` (TEXT)
   - `created_at` (TIMESTAMP)

4. **character_attributes** (Custom Key-Value pairs)
   - `id` (UUID, PK)
   - `character_id` (UUID, FK to characters, ON DELETE CASCADE)
   - `name` (TEXT, NOT NULL)
   - `value` (TEXT, NOT NULL)

5. **equipment**
   - `id` (UUID, PK)
   - `character_id` (UUID, FK to characters, ON DELETE CASCADE)
   - `item_name` (TEXT, NOT NULL)
   - `item_type` (TEXT)
   - `quantity` (INT, default 1)
   - `description` (TEXT)

6. **journal_entries**
   - `id` (UUID, PK)
   - `character_id` (UUID, FK to characters, ON DELETE CASCADE)
   - `session_date` (DATE, NOT NULL)
   - `campaign_name` (TEXT)
   - `title` (TEXT, NOT NULL)
   - `attendees` (TEXT)
   - `events` (TEXT)
   - `rewards` (TEXT)
   - `notes` (TEXT)
   - `created_at` (TIMESTAMP)

## Core Features & Logic

### 1. Authentication & Onboarding
- Users register with Email and Password.
- Upon first login, users must select a Plan.
- **No real payments:** The "Checkout" is a simple confirmation dialog. Do NOT include credit card fields or Stripe/PayPal integration.

### 2. Ownership & Security (RLS)
- Use Supabase Row Level Security (RLS) to ensure users can only Read, Create, Update, or Delete data that belongs to their `user_id`.

### 3. Plan Limits (Backend Enforcement)
- When creating a new character, the system must check the user's current character count against their `plan_id` limit.
- If the limit is reached, return a 403 Forbidden error.
- This check must be atomic/consistent to prevent race conditions.

### 4. Character Management
- **System Neutral:** Do not force D&D specific attributes. Use the `character_attributes` table for any custom stats (e.g., "Sanity", "Luck").
- **Character Profile:**
    - **Overview Tab:** Core fields + an editable list of custom attributes.
    - **Equipment Tab:** CRUD for items.
    - **Journal Tab:** CRUD for session entries.
- **Deletion:** Deleting a character must cascade delete all associated attributes, equipment, and journal entries.

### 5. UI/UX Flow
- `/login` & `/register` screens.
- `/plans` screen for initial and future plan changes.
- `/dashboard`: A grid of character cards.
- `/character/:id`: The main profile with the three tabs mentioned above.
- `/account`: Show current plan and a usage meter (e.g., "3 of 10 slots used").

## Validation Requirements
- **Frontend:** Instant validation for required fields (name, email, password length).
- **Backend:** Server-side validation for all inputs to prevent malformed data.
- **Error Handling:** Show clear, user-friendly error messages for auth failures, plan limit breaches, and validation errors.
