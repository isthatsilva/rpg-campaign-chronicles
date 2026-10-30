import { badRequest } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBlank(value) {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function checkString(value, rule) {
    if (typeof value !== 'string') return { error: `${rule.label} must be text.` };
    const trimmed = value.trim();
    if (rule.max && trimmed.length > rule.max) return { error: `${rule.label} must be at most ${rule.max} characters.` };
    return { value: trimmed };
}

function checkInt(value, rule) {
    let n = value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) n = Number(value.trim());
    if (typeof n !== 'number' || !Number.isInteger(n)) return { error: `${rule.label} must be a whole number.` };
    if (rule.min !== undefined && n < rule.min) return { error: `${rule.label} must be at least ${rule.min}.` };
    if (rule.max !== undefined && n > rule.max) return { error: `${rule.label} must be at most ${rule.max}.` };
    return { value: n };
}

function checkDate(value, rule) {
    if (typeof value !== 'string' || !DATE_RE.test(value.trim())) {
        return { error: `${rule.label} must be a date in YYYY-MM-DD format.` };
    }
    const trimmed = value.trim();
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    // rejects things like 2026-02-30, which Date would otherwise roll over to march
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
        return { error: `${rule.label} is not a real calendar date.` };
    }
    return { value: trimmed };
}

function checkEmail(value, rule) {
    const result = checkString(value, rule);
    if (result.error) return result;
    const email = result.value.toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: `${rule.label} must be a valid email address.` };
    return { value: email };
}

const checkers = { string: checkString, int: checkInt, date: checkDate, email: checkEmail };

// validates body against a spec like { name: { type: 'string', required: true, max: 100, label: 'Name' } }.
// returns a clean object (missing optional fields become null) or throws a 400 with per-field messages.
export function validate(body, spec) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw badRequest('Request body must be a JSON object.');
    }
    const clean = {};
    const fields = {};
    for (const [key, rule] of Object.entries(spec)) {
        const raw = body[key];
        if (isBlank(raw)) {
            if (rule.required) fields[key] = `${rule.label} is required.`;
            else clean[key] = rule.default ?? null;
            continue;
        }
        const result = checkers[rule.type](raw, rule);
        if (result.error) fields[key] = result.error;
        else clean[key] = result.value;
    }
    if (Object.keys(fields).length > 0) {
        throw badRequest('Please fix the highlighted fields.', fields);
    }
    return clean;
}

// password rules: 8+ characters, at least one letter and one number, and at most
// 72 bytes because bcrypt silently ignores anything past that
export function checkPassword(password) {
    if (typeof password !== 'string' || password.length === 0) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 bytes long.';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number.';
    return null;
}

export function parseId(raw) {
    return /^\d+$/.test(raw) && Number(raw) <= Number.MAX_SAFE_INTEGER ? Number(raw) : null;
}

// field specs shared by the routes (and mirrored by the frontend forms)
export const characterSpec = {
    name: { type: 'string', required: true, max: 100, label: 'Name' },
    species: { type: 'string', max: 100, label: 'Species' },
    role: { type: 'string', max: 100, label: 'Role' },
    level: { type: 'int', min: 0, max: 10000, label: 'Level' },
    health: { type: 'int', min: -1000000, max: 1000000, label: 'Health' },
    maxHealth: { type: 'int', min: 0, max: 1000000, label: 'Max health' },
    experience: { type: 'int', min: 0, max: 1000000000, label: 'Experience' },
    abilities: { type: 'string', max: 5000, label: 'Powers & abilities' },
    biography: { type: 'string', max: 5000, label: 'Biography' },
};

export const attributeSpec = {
    name: { type: 'string', required: true, max: 50, label: 'Attribute name' },
    value: { type: 'string', required: true, max: 100, label: 'Attribute value' },
};

export const equipmentSpec = {
    itemName: { type: 'string', required: true, max: 100, label: 'Item name' },
    itemType: { type: 'string', max: 50, label: 'Item type' },
    quantity: { type: 'int', min: 0, max: 1000000, label: 'Quantity', default: 1 },
    description: { type: 'string', max: 1000, label: 'Description' },
};

export const journalSpec = {
    sessionDate: { type: 'date', required: true, label: 'Session date' },
    title: { type: 'string', required: true, max: 150, label: 'Session title' },
    campaignName: { type: 'string', max: 100, label: 'Campaign name' },
    attendees: { type: 'string', max: 500, label: 'Players attending' },
    events: { type: 'string', max: 5000, label: 'Important events' },
    rewards: { type: 'string', max: 2000, label: 'Rewards' },
    notes: { type: 'string', max: 5000, label: 'Notes' },
};

export const registerSpec = {
    email: { type: 'email', required: true, max: 254, label: 'Email' },
    displayName: { type: 'string', max: 50, label: 'Display name' },
};

export const MAX_ATTRIBUTES_PER_CHARACTER = 50;
