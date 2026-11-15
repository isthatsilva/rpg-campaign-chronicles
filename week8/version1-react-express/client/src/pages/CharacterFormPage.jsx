import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import { ErrorBanner, Field, Loading } from '../components/ui.jsx';
import { toIntOrNull, validateAttribute, validateCharacter } from '../validation.js';

const EMPTY = { name: '', species: '', role: '', level: '', health: '', maxHealth: '', experience: '', abilities: '', biography: '' };
const DND_DEFAULTS = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

// form values are strings; the api wants numbers or null for the numeric fields
export function toCharacterPayload(form) {
    return {
        ...form,
        level: toIntOrNull(form.level),
        health: toIntOrNull(form.health),
        maxHealth: toIntOrNull(form.maxHealth),
        experience: toIntOrNull(form.experience),
    };
}

function fromCharacter(c) {
    const out = {};
    for (const key of Object.keys(EMPTY)) out[key] = c[key] === null || c[key] === undefined ? '' : String(c[key]);
    return out;
}

// used when creating: attributes are sent together with the character in one request
function AttributeEditor({ attributes, onChange, error }) {
    const update = (i, key, value) => onChange(attributes.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
    const remove = (i) => onChange(attributes.filter((_, idx) => idx !== i));
    const addDefaults = () => {
        const existing = new Set(attributes.map((a) => a.name.trim().toLowerCase()));
        const extra = DND_DEFAULTS.filter((n) => !existing.has(n.toLowerCase())).map((name) => ({ name, value: '10' }));
        onChange([...attributes, ...extra]);
    };

    return (
        <div className="stats-section">
            <h4>Custom Attributes</h4>
            <p className="hint">Any stats your game uses, e.g. Sanity, Technology, Strength. All optional.</p>
            {attributes.map((attr, i) => (
                <div key={i} className="attr-row">
                    <input aria-label={`Attribute ${i + 1} name`} placeholder="Name (e.g. Sanity)" maxLength={50}
                        value={attr.name} onChange={(e) => update(i, 'name', e.target.value)} />
                    <input aria-label={`Attribute ${i + 1} value`} placeholder="Value" maxLength={100}
                        value={attr.value} onChange={(e) => update(i, 'value', e.target.value)} />
                    <button type="button" className="btn-delete btn-small" onClick={() => remove(i)} aria-label={`Remove attribute ${i + 1}`}>✕</button>
                </div>
            ))}
            {error && <p className="field-error" role="alert">{error}</p>}
            <div className="button-row">
                <button type="button" className="btn-secondary btn-small" onClick={() => onChange([...attributes, { name: '', value: '' }])}>+ Add attribute</button>
                <button type="button" className="btn-secondary btn-small" onClick={addDefaults}>Use D&amp;D defaults</button>
            </div>
        </div>
    );
}

export function CharacterFields({ form, setForm, errors }) {
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
    return (
        <>
            <div className="form-row">
                <Field label="Character Name" htmlFor="char-name" error={errors.name}>
                    <input id="char-name" maxLength={100} value={form.name} onChange={set('name')} required />
                </Field>
                <Field label="Level (optional)" htmlFor="char-level" error={errors.level}>
                    <input id="char-level" type="number" min={0} step={1} value={form.level} onChange={set('level')} />
                </Field>
            </div>
            <div className="form-row">
                <Field label="Species / Race (optional)" htmlFor="char-species" error={errors.species}>
                    <input id="char-species" maxLength={100} placeholder="e.g. Human, Android" value={form.species} onChange={set('species')} />
                </Field>
                <Field label="Class / Role (optional)" htmlFor="char-role" error={errors.role}>
                    <input id="char-role" maxLength={100} placeholder="e.g. Ranger, Investigator" value={form.role} onChange={set('role')} />
                </Field>
            </div>
            <div className="form-row three">
                <Field label="Health" htmlFor="char-health" error={errors.health}>
                    <input id="char-health" type="number" step={1} value={form.health} onChange={set('health')} />
                </Field>
                <Field label="Max health" htmlFor="char-maxhealth" error={errors.maxHealth}>
                    <input id="char-maxhealth" type="number" min={0} step={1} value={form.maxHealth} onChange={set('maxHealth')} />
                </Field>
                <Field label="Experience" htmlFor="char-xp" error={errors.experience}>
                    <input id="char-xp" type="number" min={0} step={1} value={form.experience} onChange={set('experience')} />
                </Field>
            </div>
            <Field label="Powers & Abilities" htmlFor="char-powers" error={errors.abilities}>
                <textarea id="char-powers" rows={3} maxLength={5000} value={form.abilities} onChange={set('abilities')} />
            </Field>
            <Field label="Backstory" htmlFor="char-bio" error={errors.biography}>
                <textarea id="char-bio" rows={3} maxLength={5000} value={form.biography} onChange={set('biography')} />
            </Field>
        </>
    );
}

export default function CharacterFormPage() {
    const { characterId } = useParams();
    const isEdit = Boolean(characterId);
    const navigate = useNavigate();
    const [form, setForm] = useState(EMPTY);
    // new characters start with the d&d defaults; the user can change, remove or add before saving
    const [attributes, setAttributes] = useState(() => (isEdit ? [] : DND_DEFAULTS.map((name) => ({ name, value: '10' }))));
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(isEdit);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isEdit) return;
        api.get(`/characters/${characterId}`)
            .then((d) => setForm(fromCharacter(d.character)))
            .catch((err) => setMessage(err.status === 404 ? 'Character not found.' : err.message))
            .finally(() => setLoading(false));
    }, [characterId, isEdit]);

    async function handleSubmit(e) {
        e.preventDefault();
        const found = validateCharacter(form);
        const filledAttrs = attributes.filter((a) => a.name.trim() || a.value.trim());
        const badAttr = filledAttrs.map(validateAttribute).findIndex((errs) => Object.keys(errs).length);
        if (badAttr !== -1) found.attributes = `Attribute #${badAttr + 1}: ${Object.values(validateAttribute(filledAttrs[badAttr]))[0]}`;
        setErrors(found);
        setMessage('');
        if (Object.keys(found).length) return;

        setBusy(true);
        try {
            if (isEdit) {
                await api.put(`/characters/${characterId}`, toCharacterPayload(form));
                navigate(`/characters/${characterId}`);
            } else {
                const { character } = await api.post('/characters', { ...toCharacterPayload(form), attributes: filledAttrs });
                navigate(`/characters/${character.id}`);
            }
        } catch (err) {
            setErrors(err.fields || {});
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppShell>
            <h2 id="form-title">{isEdit ? 'Edit Character' : 'Forge Character'}</h2>
            <ErrorBanner message={message} />
            {loading ? <Loading /> : (
                <form id="char-form" onSubmit={handleSubmit} noValidate>
                    <CharacterFields form={form} setForm={setForm} errors={errors} />
                    {isEdit
                        ? <p className="hint">Attributes, equipment and journal entries are edited on the character's profile.</p>
                        : <AttributeEditor attributes={attributes} onChange={setAttributes} error={errors.attributes} />}
                    <div className="button-group">
                        <Link to={isEdit ? `/characters/${characterId}` : '/characters'} className="btn-secondary btn-link">Cancel</Link>
                        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Character'}</button>
                    </div>
                </form>
            )}
        </AppShell>
    );
}
