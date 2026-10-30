import { useState } from 'react';
import { ConfirmDialog, ErrorBanner, Field } from '../components/ui.jsx';
import { validateJournal } from '../validation.js';
import { useChildResource } from './useChildResource.js';

const EMPTY = { sessionDate: '', campaignName: '', title: '', attendees: '', events: '', rewards: '', notes: '' };
// newest session first, same as the server
const byDateDesc = (a, b) => b.sessionDate.localeCompare(a.sessionDate) || b.id - a.id;

function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function JournalForm({ initial = EMPTY, submitLabel, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    async function handleSubmit(e) {
        e.preventDefault();
        const found = validateJournal(form);
        setErrors(found);
        setMessage('');
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            await onSubmit(form);
            if (!onCancel) setForm(EMPTY);
        } catch (err) {
            setErrors(err.fields || {});
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="add-log-form" onSubmit={handleSubmit} noValidate>
            <ErrorBanner message={message} />
            <div className="form-row">
                <Field label="Session date" error={errors.sessionDate}>
                    <input type="date" value={form.sessionDate} onChange={set('sessionDate')} />
                </Field>
                <Field label="Campaign name" error={errors.campaignName}>
                    <input maxLength={100} placeholder="The Lost Kingdom" value={form.campaignName} onChange={set('campaignName')} />
                </Field>
            </div>
            <div className="form-row">
                <Field label="Session title" error={errors.title}>
                    <input maxLength={150} placeholder="The Forgotten Temple" value={form.title} onChange={set('title')} />
                </Field>
                <Field label="Players present" error={errors.attendees}>
                    <input maxLength={500} placeholder="Alice, Bob, Charlie" value={form.attendees} onChange={set('attendees')} />
                </Field>
            </div>
            <Field label="Important events, discoveries & decisions" error={errors.events}>
                <textarea rows={3} maxLength={5000} placeholder="What happened in this adventure?" value={form.events} onChange={set('events')} />
            </Field>
            <Field label="Rewards, items or experience earned" error={errors.rewards}>
                <textarea rows={2} maxLength={2000} placeholder="Enemies defeated, quests completed, loot…" value={form.rewards} onChange={set('rewards')} />
            </Field>
            <Field label="Notes & next-session reminders" error={errors.notes}>
                <textarea rows={2} maxLength={5000} value={form.notes} onChange={set('notes')} />
            </Field>
            <div className="button-row">
                <button type="submit" className="btn-primary" disabled={busy}>{submitLabel}</button>
                {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
            </div>
        </form>
    );
}

export default function JournalPanel({ characterId, initialItems }) {
    const { items, create, update, remove } = useChildResource(characterId, 'journal', initialItems, byDateDesc);
    const [editingId, setEditingId] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const [message, setMessage] = useState('');

    async function confirmDelete() {
        try {
            await remove(toDelete.id);
        } catch (err) {
            setMessage(err.message);
        }
        setToDelete(null);
    }

    const toForm = (entry) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, entry[k] ?? '']));

    return (
        <div>
            <h4>Record New Session</h4>
            <JournalForm submitLabel="Log Session" onSubmit={create} />

            <div className="logs-list">
                <h4>Past Adventures ({items.length})</h4>
                <ErrorBanner message={message} />
                {items.length === 0 && <p className="hint">No sessions logged for this character yet.</p>}
                {items.map((entry) => (editingId === entry.id ? (
                    <JournalForm key={entry.id} initial={toForm(entry)} submitLabel="Save Entry"
                        onSubmit={async (body) => { await update(entry.id, body); setEditingId(null); }}
                        onCancel={() => setEditingId(null)} />
                ) : (
                    <article key={entry.id} className="log-entry">
                        <h5><span>{entry.title}</span><span>{formatDate(entry.sessionDate)}</span></h5>
                        <div className="log-details">
                            {entry.campaignName && <div><strong>Campaign:</strong> {entry.campaignName}</div>}
                            {entry.attendees && <div><strong>Players:</strong> {entry.attendees}</div>}
                        </div>
                        {entry.events && <p className="log-notes">{entry.events}</p>}
                        {entry.rewards && <p className="log-details"><strong>Rewards:</strong> {entry.rewards}</p>}
                        {entry.notes && <p className="log-details"><strong>Notes:</strong> {entry.notes}</p>}
                        <div className="char-actions">
                            <button type="button" className="btn-edit" onClick={() => setEditingId(entry.id)}>Edit</button>
                            <button type="button" className="btn-delete" onClick={() => setToDelete(entry)}>Delete</button>
                        </div>
                    </article>
                )))}
            </div>

            {toDelete && (
                <ConfirmDialog title={`Delete "${toDelete.title}"?`} confirmLabel="Delete entry" danger
                    onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
                    <p>This journal entry will be permanently deleted.</p>
                </ConfirmDialog>
            )}
        </div>
    );
}
