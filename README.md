# RPG Campaign Chronicles

CS146S Week 8: the same system-neutral tabletop RPG character manager, built three times on different stacks.

| Folder | Stack |
|---|---|
| `week8/version1-react-express/` | React + Express + SQLite |
| `week8/version2-react-flask/` | React + Flask + SQLite |
| `week8/version3-vue-bolt/` | Vue + Supabase, generated with bolt.new, then reviewed and fixed |

Each version has its own README with setup, run and test instructions. `week8/dev-log.md` is the build log, and `week8/writeup.md` is the assignment write-up.

Never commit `.env` files, databases, `node_modules/` or `venv/` (see `.gitignore`).

## How to run everything

Each block below has a **macOS** version (Terminal, zsh/bash) and a **Windows** version (PowerShell).
Every command starts from the repo's root folder (the one containing this README). Run `git pull` first.

- Servers keep running until you press **Ctrl+C**, so each one needs its own terminal window or tab.
- V1, V2 and V3 all serve the app on port **5173**, so run one version at a time.
- Each version keeps its own accounts and data: V1 and V2 each use a local SQLite file, and V3 uses Supabase.

### 1. First-time setup (once per computer)

Install **Node.js 22.13+** (nodejs.org) and **Python 3.11+** (python.org; on Windows tick "Add python.exe to PATH").
Then create the dependencies and `.env` files. These are not in git, so each person makes their own.

**macOS:**
```bash
# V1
cd week8/version1-react-express/server
npm install
cp .env.example .env
cd ../client
npm install
cd ../../..

# V2
cd week8/version2-react-flask/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
deactivate
cd ../client
npm install
cd ../../..

# V3
cd week8/version3-vue-bolt
npm install
cp .env.example .env
cd ../..
```

**Windows (PowerShell):**
```powershell
# V1
cd week8\version1-react-express\server
npm install
copy .env.example .env
cd ..\client
npm install
cd ..\..\..

# V2
cd week8\version2-react-flask\server
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
deactivate
cd ..\client
npm install
cd ..\..\..

# V3
cd week8\version3-vue-bolt
npm install
copy .env.example .env
cd ..\..
```

If PowerShell says running scripts is disabled when activating the venv, run this once and try again:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**Then fill in the `.env` files** in any text editor:
- `week8/version1-react-express/server/.env` and `week8/version2-react-flask/server/.env`: set `SESSION_SECRET` to a long random string. This command prints one on both macOS and Windows:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `week8/version3-vue-bolt/.env`: the Supabase **Project URL** and **publishable** (or legacy anon) key, from Project Settings → API Keys. Never use the secret / service_role key. The SQL migration only needs to be run once per Supabase project (see the V3 README).

### 2. Run

**V1: React + Express** (two terminals), then open http://localhost:5173

| | macOS | Windows (PowerShell) |
|---|---|---|
| Terminal 1 (API, port 4000) | `cd week8/version1-react-express/server`<br>`npm run dev` | `cd week8\version1-react-express\server`<br>`npm run dev` |
| Terminal 2 (app) | `cd week8/version1-react-express/client`<br>`npm run dev` | `cd week8\version1-react-express\client`<br>`npm run dev` |

**V2: React + Flask** (two terminals), then open http://localhost:5173

| | macOS | Windows (PowerShell) |
|---|---|---|
| Terminal 1 (API, port 5001) | `cd week8/version2-react-flask/server`<br>`source venv/bin/activate`<br>`python run.py` | `cd week8\version2-react-flask\server`<br>`.\venv\Scripts\Activate.ps1`<br>`python run.py` |
| Terminal 2 (app) | `cd week8/version2-react-flask/client`<br>`npm run dev` | `cd week8\version2-react-flask\client`<br>`npm run dev` |

V2 uses port 5001 because macOS's AirPlay Receiver occupies 5000. Windows uses 5001 too, so the setup is the same everywhere.

**V3: Vue + Supabase** (one terminal; there's no server of our own), then open http://localhost:5173

| macOS | Windows (PowerShell) |
|---|---|
| `cd week8/version3-vue-bolt`<br>`npm run dev` | `cd week8\version3-vue-bolt`<br>`npm run dev` |

### 3. Tests

| Version | macOS | Windows (PowerShell) | What it runs |
|---|---|---|---|
| V1 | `cd week8/version1-react-express/server`<br>`npm test` | `cd week8\version1-react-express\server`<br>`npm test` | 20 API tests (node:test + supertest) |
| V2 | `cd week8/version2-react-flask/server`<br>`source venv/bin/activate`<br>`pytest` | `cd week8\version2-react-flask\server`<br>`.\venv\Scripts\Activate.ps1`<br>`pytest` | 20 API tests (pytest) |
| V3 | `cd week8/version3-vue-bolt`<br>`npm run test:api` | `cd week8\version3-vue-bolt`<br>`npm run test:api` | 12 checks against the real Supabase project (creates 3 throwaway accounts per run) |

Everything was developed and tested on macOS. The Windows commands are the standard equivalents but haven't been run on Windows yet.
