export class HttpError extends Error {
    constructor(status, code, message, fields) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}

export const badRequest = (message, fields) => new HttpError(400, 'VALIDATION_ERROR', message, fields);
export const unauthorized = (message = 'Please log in to continue.') => new HttpError(401, 'UNAUTHORIZED', message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'NOT_FOUND', message);

export function notFoundHandler(req, res, next) {
    next(notFound(`No API route for ${req.method} ${req.path}.`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) {
        const body = { code: err.code, message: err.message };
        if (err.fields) body.fields = err.fields;
        return res.status(err.status).json({ error: body });
    }
    // errors thrown by express.json()
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    }
    // anything else is a bug or a database failure: log it, but never send the stack trace
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } });
}
