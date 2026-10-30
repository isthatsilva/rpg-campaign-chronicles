import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = createApp(db, config);

app.listen(config.port, () => {
    console.log(`RPG Campaign Chronicles API listening on http://localhost:${config.port}`);
    console.log(`database: ${config.databasePath}`);
});
