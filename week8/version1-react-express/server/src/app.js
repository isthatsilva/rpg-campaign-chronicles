import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { loadSession } from './auth.js';
import { HttpError, errorHandler, notFoundHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { plansRouter } from './routes/plans.js';
import { charactersRouter } from './routes/characters.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createApp(db, config) {
    const app = express();
    app.disable('x-powered-by');

    const api = express.Router();
    api.use(express.json({ limit: '100kb' }));
    // a cross-site html form can't send application/json, so requiring it on writes
    // (together with the SameSite=Lax cookie) blocks csrf-style requests
    api.use((req, res, next) => {
        const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && hasBody && !req.is('application/json')) {
            return next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Requests must be sent as JSON.'));
        }
        next();
    });
    api.use(loadSession(db, config));
    api.use('/auth', authRouter(db, config));
    api.use('/', plansRouter(db));
    api.use('/characters', charactersRouter(db));
    api.use(notFoundHandler);
    api.use(errorHandler);
    app.use('/api', api);

    // optional: serve the built react app from the same port (npm run build in client/ first)
    if (fs.existsSync(path.join(clientDist, 'index.html'))) {
        app.use(express.static(clientDist));
        app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
    }

    return app;
}
