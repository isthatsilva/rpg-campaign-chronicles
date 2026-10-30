# RPG Campaign Chronicles

## Project Overview

**Project Name:** RPG Campaign Chronicles  
**Application Type:** System-neutral tabletop RPG character creator and personal campaign journal  
**Course Assignment:** Multi-Stack AI-Accelerated Web App Build  
**Project Status:** Concept and requirements planning

### Concept

RPG Campaign Chronicles is a web application for tabletop RPG players to create and manage individual characters and record their adventures. Each character has a separate profile containing customizable attributes, equipment, background information, and a personal campaign journal. Journal entries record when a session occurred, who attended, and significant events during the campaign.

Users can register and sign in to a private account, select a subscription tier, and manage characters within their plan’s character limit. Account, subscription, character, and journal data are persisted in a database.

The application is **system-neutral**: it is not limited to Dungeons & Dragons or any other tabletop RPG. Users can choose attributes and character details that suit their particular game.

This concept combines two initial ideas:

1. **RPG Character Creator:** Create characters, manage stats, and track equipment.
2. **Board Game Session Log:** Record game dates, attendance, and notable outcomes or events.

The combined app is a character-centered tabletop RPG tracker, **not** a playable RPG or game engine.

## Confirmed Design Decisions

- Each character has **their own individual campaign journal**.
- Journal entries are associated with a specific character, not a shared campaign-wide journal.
- Characters can participate in the same campaign while retaining separate journal entries.
- The app is **system-neutral** and allows custom attributes rather than requiring fixed D&D stats.
- The primary focus is character management, equipment, and campaign session logging.
- The same functional application will be implemented in **three distinct technology stacks**.
- Users can register, log in, and select a plan.
- The free plan allows **up to 10 characters**; the next plan allows **up to 15 characters**.
- The app will offer **3–4 subscription tiers**; the example below proposes four, with final prices and higher-tier limits to be confirmed.
- Character limits apply per user account; each character still has its own independent journal.

## Intended Users

Tabletop RPG players who want to organize their characters, track progress, manage items, and remember what happened in each gaming session, regardless of the RPG system they use.

## Core Features

### 1. Character Creation and Profiles

Users can create, view, edit, and delete characters. Suggested profile fields include:

- Character name
- Race or species (optional, depending on the game)
- Class or role (optional)
- Level (optional)
- Health and experience points (optional)
- Character background or biography
- Custom attributes and values

The application should not require game-specific concepts that do not apply to a user's chosen RPG system.

### 2. System-Neutral, Customizable Attributes

Users can add, edit, and remove attributes for each character. For example:

| Character concept | Example attributes |
| --- | --- |
| Fantasy warrior | Strength, Defense, Magic |
| Sci-fi soldier | Accuracy, Technology, Stamina |
| Horror investigator | Sanity, Perception, Knowledge |

D&D-style attributes (Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma) may be offered as examples or optional defaults, but they are **not mandatory**.

### 3. Equipment and Inventory

Each character can maintain a separate equipment list, with functionality to:

- Add equipment such as weapons, armor, tools, or other items
- View current inventory
- Edit item details or quantities
- Remove items

Suggested equipment fields: item name, item type, quantity, and optional description.

### 4. Personal Campaign Journal

Every character has a separate journal for recording their own session history. A journal entry can include:

- Session date
- Campaign name
- Session title
- Players who attended
- Important events, discoveries, and decisions
- Enemies defeated or quests completed (where relevant)
- Rewards, items, or experience earned (where relevant)
- Additional notes or next-session reminders

Users can create, view, edit, and delete entries. A journal entry recorded under one character does not automatically appear under another character, even when they attended the same campaign session.

### 5. Character Progression

Users can update their character's details over time, such as:

- Level, health, or experience, if relevant to the RPG
- Custom attributes
- Equipment and inventory
- Abilities or background information

The app records information entered by the user; a full game-rule engine or automatic combat system is not required.

## User Accounts and Subscription Plans

### Registration and Login

- Users can create an account with an email address, display name (optional), and password.
- Users can securely log in and log out.
- Each account owns its own characters and related journal, equipment, and attribute records.
- Users can view their current plan, character usage, and remaining character slots.
- All account and subscription information is stored in a database.
- Passwords must be stored as **secure password hashes**, never plaintext; use secure sessions or authentication tokens and enforce authorization on every user-owned record.

### Proposed Subscription Tiers

The user specified the first two limits; the remaining limits below are **suggested placeholders**, not finalized decisions. Prices have not yet been set.

| Tier | Price | Maximum tracked characters | Status |
| --- | --- | ---: | --- |
| Free | $0 | **10** | Confirmed |
| Adventurer | To be decided | **15** | Limit confirmed; name suggested |
| Hero | To be decided | 25 | Suggested |
| Legend | To be decided | 50 | Suggested |

All plans include character profiles and their personal session journals. The tier determines how many characters a user may maintain; no per-session journal limit has been specified.

**Subscription behavior:**

- New users start on Free unless they choose another available plan.
- Before creating a character, the backend counts the account's existing characters and checks the plan limit. The limit must be enforced server-side, not just by hiding a button.
- A user at their limit may view, edit, and journal their existing characters, but cannot create another until they delete one or upgrade.
- Users can choose or change their plan, and their selected plan and subscription status persist across logins.
- On a downgrade below the current character count, keep existing data intact but block new character creation until usage is within the new limit; show a clear warning.
- For a course prototype, **simulated plan selection** is sufficient if actual paid billing is out of scope. Do not collect card details or represent a simulated plan as a completed real payment.
- If real billing is later required, integrate a hosted payment provider and use verified server-side payment events to activate paid plans; do not store raw payment-card data.

### Account and Billing Screens

- **Register / Login:** Account creation and authentication.
- **Plan Selection / Pricing:** Compare available tiers and choose one.
- **Account & Subscription:** Show current plan, character usage, and plan-change options.
- **Character Dashboard:** Display only characters owned by the signed-in user.

## Example User Flow

1. Register or log in and select a subscription plan.
2. Open the character dashboard and see current character usage (for example, 3 of 10 slots used).
3. Create a character with a name, background, and custom attributes, provided the account has an available slot.
4. Open the character profile to view stats, equipment, and journal.
5. Add or update inventory items.
6. After a tabletop session, open that character's journal and add a session entry.
7. Record the date, attendees, and important events.
8. Later, return to the profile to review the journal and update the character.
9. Edit or delete incorrect entries when needed.

## Example Character Profile

**Character:** Thorne Ashford  
**Species:** Human  
**Role:** Ranger  
**Level:** 5  
**Health:** 42/50

Example custom stats (illustrative only):

| Attribute | Value |
| --- | ---: |
| Strength | 14 |
| Dexterity | 18 |
| Constitution | 13 |
| Intelligence | 12 |
| Wisdom | 16 |
| Charisma | 10 |

**Equipment:** Longbow, Leather Armor, Healing Potions, Silver Dagger  
**Background:** A wandering ranger protecting forests around the kingdom of Eldoria.

These sample values demonstrate a possible character profile; they are not fixed requirements or required attributes.

## Example Campaign Journal Entry

| Field | Example |
| --- | --- |
| Character | Thorne Ashford |
| Session date | October 25, 2026 |
| Campaign name | The Lost Kingdom |
| Session title | The Forgotten Temple |
| Players attending | Alex, Sarah, Mike |
| Important events | Discovered an ancient temple and defeated a guardian |
| Rewards | 200 XP and an enchanted sword |
| Additional notes | Return to the temple next session |

A second character in *The Lost Kingdom* would have their **own** journal, not a shared copy of Thorne's entry.

## Suggested Application Pages

1. **Register/Login and Plan Selection:** Create an account, authenticate, and select a tier.
2. **Account & Subscription:** View current plan and character slot usage; change plans.
3. **Character Dashboard:** List characters; create, select, edit, or delete a character.
4. **Create/Edit Character:** Enter character identity, background, and customizable attributes.
5. **Character Profile:** Show the selected character's details and progression.
6. **Equipment/Inventory:** Manage items belonging to the selected character.
7. **Personal Campaign Journal:** List that character's session entries and add, view, edit, or delete them.

These may be separate pages or tabs within the profile, depending on the UI implementation.

## Suggested Database Design

The initial three-table concept covered Characters, Equipment, and Campaign Sessions. Because the app is system-neutral, a **fourth table for custom attributes** is recommended rather than hardcoding fixed stat columns.

### Users

| Field | Purpose |
| --- | --- |
| user_id (PK) | Unique account identifier |
| email (unique) | Login identifier |
| password_hash | Securely hashed password |
| display_name | Optional display name |
| created_at | Registration timestamp |

### Plans

| Field | Purpose |
| --- | --- |
| plan_id (PK) | Unique tier identifier |
| name | Free, Adventurer, Hero, Legend |
| character_limit | Maximum characters permitted |
| price | Proposed price, if any; currency specified separately |
| is_active | Whether plan is offered |

### Subscriptions

| Field | Purpose |
| --- | --- |
| subscription_id (PK) | Unique subscription record |
| user_id (FK) | Account that owns the subscription |
| plan_id (FK) | Selected plan |
| status | e.g., active, canceled, past_due (if billing enabled) |
| started_at | Plan start timestamp |
| ends_at | Optional end timestamp |
| provider_subscription_id | Optional external billing reference; no card details |

### Characters

| Field | Purpose |
| --- | --- |
| character_id (PK) | Unique character identifier |
| user_id (FK) | Account that owns the character |
| name | Character name |
| species | Optional race/species |
| role | Optional class/role |
| level | Optional level |
| health | Optional health value |
| experience | Optional experience points |
| biography | Character background |

### Character Attributes (recommended addition)

| Field | Purpose |
| --- | --- |
| attribute_id (PK) | Unique attribute identifier |
| character_id (FK) | Character owning this attribute |
| attribute_name | User-defined name, e.g., Sanity |
| attribute_value | User-defined value |

### Equipment

| Field | Purpose |
| --- | --- |
| equipment_id (PK) | Unique equipment identifier |
| character_id (FK) | Character owning the item |
| item_name | Item name |
| item_type | Optional item category |
| quantity | Item quantity |
| description | Optional details |

### Campaign Sessions

| Field | Purpose |
| --- | --- |
| session_id (PK) | Unique journal entry identifier |
| character_id (FK) | Character owning the journal entry |
| session_date | Date of play |
| campaign_name | Name of campaign |
| title | Session title |
| attendees | Players who attended |
| events | Important events |
| rewards | Optional rewards |
| notes | Additional notes |

**Relationships:** One user has many characters and subscription records; each subscription refers to a plan. One character has many attributes, equipment items, and campaign session entries. Each record belongs to one character. A possible implementation is to delete associated records when their character is deleted, after showing a confirmation prompt.

For a simple first version, attendees can be stored as text; a separate players/attendance table is optional for future expansion.

## CRUD Requirements

| Operation | Character profiles | Equipment | Journal entries | Custom attributes |
| --- | --- | --- | --- | --- |
| Create | Add character | Add item | Log session | Add stat |
| Read | View profile | View inventory | View history | View stats |
| Update | Edit character | Edit item | Edit session | Edit stat |
| Delete | Remove character | Remove item | Remove entry | Remove stat |

## Validation and Error Handling

Account and subscription validation:

- Require a valid, unique email and enforce password security rules.
- Protect authenticated routes and prevent users from accessing or editing other users' records.
- Check the account's current plan and enforce its character limit on the backend, including concurrent create requests.
- Validate plan identifiers and allowed subscription transitions.
- Never store plaintext passwords or payment-card numbers.

Suggested validation:

- Require a character name.
- Require a session date and title when logging a session.
- Validate numeric fields such as quantities, levels, and health when those fields are used.
- Reject invalid or missing required input with understandable messages.
- Confirm destructive actions such as deleting a character.
- Handle missing characters, missing sessions, and database errors gracefully.

## Technology Stacks

The assignment requires **three separate, functional implementations of the same application**, using three distinct technology stacks. At least one implementation must use a non-JavaScript language in the frontend or backend.

Suggested stacks discussed:

| Version | Stack | Database | Main distinction |
| --- | --- | --- | --- |
| 1 | React + Express (Node.js) | SQLite | JavaScript frontend/backend |
| 2 | React + Flask (Python) | SQLite | Python backend satisfies non-JS requirement |
| 3 | Vue + Express (Node.js) | SQLite | Different frontend framework |

These are **recommended**, not yet finalized. Each version should be independently runnable, with its own project files and persistence. Keep the same feature set and comparable data models across versions.

## Assignment Requirements

From the provided **Multi-Stack AI-Accelerated Web App Build** assignment:

- Build the same functional web app in **three distinct technology stacks**.
- At least one version must use a **non-JavaScript language** for the frontend or backend.
- Include an end-to-end functional frontend and backend, with persistent storage where applicable.
- Support create, read, update, and delete operations for a primary resource.
- Include basic validation and error handling.
- Provide a simple functional UI for main workflows.
- Include clear local run instructions.
- A group can consist of one or two students.

### Deliverables

Organize the three versions under `week8/`:

```text
week8/
├── version1-react-express/
│   ├── [source code]
│   └── README.md
├── version2-react-flask/
│   ├── [source code]
│   └── README.md
├── version3-vue-express/
│   ├── [source code]
│   └── README.md
└── writeup.md
```

Each project folder must contain source code, a README with prerequisites, installation/setup, run instructions and environment configuration, plus notes on deviations, known issues, and manual fixes after generation.

The completed `writeup.md` must contain:

- App Concept
- Three App Descriptions (one for each version)

### Grading Rubric (100 points)

| Category | Points |
| --- | ---: |
| App concept meets minimum functional scope | 15 |
| Three distinct technology stacks | 15 |
| Non-JavaScript language in at least one version | 10 |
| Version 1 deliverables/functionality/writeup | 20 |
| Version 2 deliverables/functionality/writeup | 20 |
| Version 3 deliverables/functionality/writeup | 20 |
| **Total** | **100** |

For each version's 20 points: source folder (5), README (5), app functionality (5), and complete version description in `writeup.md` (5).

## Recommended Development Scope

### Minimum viable application

1. Character dashboard with full CRUD.
2. Create/edit character with user-defined attributes.
3. Individual character profile.
4. Equipment list with CRUD.
5. Character-specific session journal with CRUD, date, attendance, and important events.
6. Registration, login/logout, plan selection, and database-backed subscriptions.
7. Enforce plan-specific character caps (Free 10; next tier 15).
8. Persistent storage and basic validation.
9. Clear instructions to run each of the three implementations.

### Optional future enhancements (not required)

- Character portrait uploads
- Character templates or optional preset stats
- Search and filter journal entries
- Session timeline view
- Export or print character journals
- More structured attendance tracking
- Additional visual progression indicators

## Open Implementation Decisions

These were not finalized in our discussion:

- Exact visual theme and branding
- Whether character portraits are included in the first release
- Final prices and names for subscription tiers
- Exact character limits for tiers 3 and 4
- Whether real payment processing is required or simulated plan selection is sufficient for the assignment
- Exact representation and validation of free-form attribute values
- Whether character level, health, and experience should be entirely optional or configurable fields
- Final choice of technology stacks

## Project Summary

**RPG Campaign Chronicles** combines a customizable RPG character creator with a personal tabletop campaign journal. Its defining features are **system-neutral character customization** and **independent journals for each character**. Registered users can select a subscription tier, manage characters within their account’s character limit, and log the date, attendance, and major events from each play session. User accounts, plans, subscriptions, characters, and journals are stored persistently. The application will be implemented as three separate functional web apps to meet the course's multi-stack assignment requirements.
