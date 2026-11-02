# RPG Campaign Chronicles

CS146S Week 8: the same system-neutral tabletop RPG character manager, built three times on different stacks.

| Folder | Stack |
|---|---|
| `week8/version1-react-express/` | React + Express + SQLite |
| `week8/version2-react-flask/` | React + Flask + SQLite |
| `week8/version3-vue-bolt/` | Vue + Supabase, generated with bolt.new (in progress) |

Each version has its own README with setup, run and test instructions. `week8/dev-log.md` is the build log, and `week8/writeup.md` is the assignment write-up.
`week8/rpg-character-creator/` is the original frontend design and is kept unchanged as a reference.

Never commit `.env` files, databases, `node_modules/` or `venv/` (see `.gitignore`).
