import { useState } from 'react';
import { ConfirmDialog, ErrorBanner } from '../components/ui.jsx';
import { validateAttribute } from '../validation.js';
import { useChildResource } from './useChildResource.js';

function AttributeForm({ initial = { name: '', value: '' }, submitLabel, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        const found = validateAttribute(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            await onSubmit(form);
            if (!onCancel) setForm({ name: '', value: '' });
        } catch (err) {
            setErrors({ ...err.fields, form: err.fields && Object.keys(err.fields).length ? '' : err.message });
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="attr-row" onSubmit={handleSubmit} noValidate>
            <div>
                <input aria-label="Attribute name" placeholder="Name (e.g. Sanity)" maxLength={50}
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div>
                <input aria-label="Attribute value" placeholder="Value" maxLength={100}
                    value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                {errors.value && <p className="field-error">{errors.value}</p>}
            </div>
            <div className="row-actions">
                <button type="submit" className="btn-edit btn-small" disabled={busy}>{submitLabel}</button>
                {onCancel && <button type="button" className="btn-secondary btn-small" onClick={onCancel}>Cancel</button>}
            </div>
            {errors.form && <p className="field-error full-row">{errors.form}</p>}
        </form>
    );
}

export default function AttributesPanel({ characterId, initialItems }) {
    const { items, create, update, remove } = useChildResource(characterId, 'attributes', initialItems);
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

    return (
        <div className="stats-section">
            <h4>Attributes</h4>
            <ErrorBanner message={message} />
            {items.length === 0 && <p className="hint">No attributes yet. Add whatever stats your game uses.</p>}
            <div className="attr-list">
                {items.map((attr) => (editingId === attr.id ? (
                    <AttributeForm key={attr.id} initial={{ name: attr.name, value: attr.value }} submitLabel="Save"
                        onSubmit={async (body) => { await update(attr.id, body); setEditingId(null); }}
                        onCancel={() => setEditingId(null)} />
                ) : (
                    <div key={attr.id} className="attr-display">
                        <span className="attr-name">{attr.name}</span>
                        <span className="attr-value">{attr.value}</span>
                        <div className="row-actions">
                            <button type="button" className="btn-edit btn-small" onClick={() => setEditingId(attr.id)}>Edit</button>
                            <button type="button" className="btn-delete btn-small" onClick={() => setToDelete(attr)}>Remove</button>
                        </div>
                    </div>
                )))}
            </div>
            <h5 className="sub-heading">Add attribute</h5>
            <AttributeForm submitLabel="Add" onSubmit={create} />

            {toDelete && (
                <ConfirmDialog title={`Remove ${toDelete.name}?`} confirmLabel="Remove" danger
                    onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
                    <p>This attribute will be removed from the character.</p>
                </ConfirmDialog>
            )}
        </div>
    );
}
