// thin fetch wrapper: json in/out, session cookie sent automatically, errors turned into ApiError
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export class ApiError extends Error {
    constructor(status, code, message, fields = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
    onUnauthorized = fn;
}

async function request(method, path, body) {
    const options = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, options);
    } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the backend running?');
    }
    if (res.status === 204) return null;
    let data = null;
    try {
        data = await res.json();
    } catch {
        // non-json body (e.g. proxy error page)
    }
    if (!res.ok) {
        const err = data?.error;
        const apiError = new ApiError(res.status, err?.code || 'HTTP_ERROR', err?.message || `Request failed (${res.status}).`, err?.fields || {});
        // an expired session anywhere except the login/register forms sends the user back to login
        if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
        throw apiError;
    }
    return data;
}

export const api = {
    get: (path) => request('GET', path),
    post: (path, body = {}) => request('POST', path, body),
    put: (path, body = {}) => request('PUT', path, body),
    del: (path) => request('DELETE', path),
};
