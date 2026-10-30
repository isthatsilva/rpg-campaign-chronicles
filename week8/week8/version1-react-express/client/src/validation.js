// client-side checks that mirror the server rules, so most mistakes are caught before a request.
// the server re-checks everything; these are only for faster feedback.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(email) {
    if (!email.trim()) return 'Email is required.';
    if (!EMAIL_RE.test(email.trim())) return 'Email must be a valid email address.';
    return null;
}

export function checkPassword(password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (new TextEncoder().encode(password).length > 72) return 'Password must be at most 72 bytes long.';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number.';
    return null;
}

export function checkText(value, label, { required = false, max } = {}) {
    const v = (value ?? '').trim();
    if (required && !v) return `${label} is required.`;
    if (max && v.length > max) return `${label} must be at most ${max} characters.`;
    return null;
}

export function checkInt(value, label, { min, max } = {}) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isInteger(n)) return `${label} must be a whole number.`;
    if (min !== undefined && n < min) return `${label} must be at least ${min}.`;
    if (max !== undefined && n > max) return `${label} must be at most ${max}.`;
    return null;
}

// '' -> null, '5' -> 5 (anything else is left for the server to reject)
export function toIntOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
}

// returns only the entries that have an error
export function collectErrors(checks) {
    return Object.fromEntries(Object.entries(checks).filter(([, msg]) => msg));
}

export function validateCharacter(form) {
    return collectErrors({
        name: checkText(form.name, 'Name', { required: true, max: 100 }),
        species: checkText(form.species, 'Species', { max: 100 }),
        role: checkText(form.role, 'Role', { max: 100 }),
        level: checkInt(form.level, 'Level', { min: 0, max: 10000 }),
        health: checkInt(form.health, 'Health', { min: -1000000, max: 1000000 }),
        maxHealth: checkInt(form.maxHealth, 'Max health', { min: 0, max: 1000000 }),
        experience: checkInt(form.experience, 'Experience', { min: 0, max: 1000000000 }),
        abilities: checkText(form.abilities, 'Powers & abilities', { max: 5000 }),
        biography: checkText(form.biography, 'Biography', { max: 5000 }),
    });
}

export function validateAttribute(attr) {
    return collectErrors({
        name: checkText(attr.name, 'Attribute name', { required: true, max: 50 }),
        value: checkText(attr.value, 'Attribute value', { required: true, max: 100 }),
    });
}

export function validateEquipment(form) {
    return collectErrors({
        itemName: checkText(form.itemName, 'Item name', { required: true, max: 100 }),
        itemType: checkText(form.itemType, 'Item type', { max: 50 }),
        quantity: checkInt(form.quantity, 'Quantity', { min: 0, max: 1000000 }),
        description: checkText(form.description, 'Description', { max: 1000 }),
    });
}

export function validateJournal(form) {
    return collectErrors({
        sessionDate: form.sessionDate ? null : 'Session date is required.',
        title: checkText(form.title, 'Session title', { required: true, max: 150 }),
        campaignName: checkText(form.campaignName, 'Campaign name', { max: 100 }),
        attendees: checkText(form.attendees, 'Players attending', { max: 500 }),
        events: checkText(form.events, 'Important events', { max: 5000 }),
        rewards: checkText(form.rewards, 'Rewards', { max: 2000 }),
        notes: checkText(form.notes, 'Notes', { max: 5000 }),
    });
}
