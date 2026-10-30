import { useState } from 'react';
import { ConfirmDialog, ErrorBanner, Field } from '../components/ui.jsx';
import { toIntOrNull, validateEquipment } from '../validation.js';
import { useChildResource } from './useChildResource.js';

const EMPTY = { itemName: '', itemType: '', quantity: '1', description: '' };
const byName = (a, b) => a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' }) || a.id - b.id;

function EquipmentForm({ initial = EMPTY, submitLabel, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    async function handleSubmit(e) {
        e.preventDefault();
        const found = validateEquipment(form);
        setErrors(found);
        setMessage('');
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            await onSubmit({ ...form, quantity: toIntOrNull(form.quantity) ?? 1 });
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
            <div className="form-row three">
                <Field label="Item name" error={errors.itemName}>
                    <input maxLength={100} placeholder="e.g. Longbow" value={form.itemName} onChange={set('itemName')} />
                </Field>
                <Field label="Type (optional)" error={errors.itemType}>
                    <input maxLength={50} placeholder="Weapon, Armor, Tool…" value={form.itemType} onChange={set('itemType')} />
                </Field>
                <Field label="Quantity" error={errors.quantity}>
                    <input type="number" min={0} step={1} value={form.quantity} onChange={set('quantity')} />
                </Field>
            </div>
            <Field label="Description (optional)" error={errors.description}>
                <textarea rows={2} maxLength={1000} value={form.description} onChange={set('description')} />
            </Field>
            <div className="button-row">
                <button type="submit" className="btn-primary" disabled={busy}>{submitLabel}</button>
                {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
            </div>
        </form>
    );
}

export default function EquipmentPanel({ characterId, initialItems }) {
    const { items, create, update, remove } = useChildResource(characterId, 'equipment', initialItems, byName);
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
        <div>
            <h4>Add Equipment</h4>
            <EquipmentForm submitLabel="Add Item" onSubmit={create} />

            <div className="logs-list">
                <h4>Inventory ({items.length})</h4>
                <ErrorBanner message={message} />
                {items.length === 0 && <p className="hint">No items yet.</p>}
                {items.map((item) => (editingId === item.id ? (
                    <EquipmentForm key={item.id} submitLabel="Save Item"
                        initial={{ itemName: item.itemName, itemType: item.itemType ?? '', quantity: String(item.quantity), description: item.description ?? '' }}
                        onSubmit={async (body) => { await update(item.id, body); setEditingId(null); }}
                        onCancel={() => setEditingId(null)} />
                ) : (
                    <div key={item.id} className="log-entry">
                        <h5>
                            <span>{item.itemName} <span className="qty">×{item.quantity}</span></span>
                            {item.itemType && <span className="tag">{item.itemType}</span>}
                        </h5>
                        {item.description && <p className="log-notes">{item.description}</p>}
                        <div className="char-actions">
                            <button type="button" className="btn-edit" onClick={() => setEditingId(item.id)}>Edit</button>
                            <button type="button" className="btn-delete" onClick={() => setToDelete(item)}>Remove</button>
                        </div>
                    </div>
                )))}
            </div>

            {toDelete && (
                <ConfirmDialog title={`Remove ${toDelete.itemName}?`} confirmLabel="Remove" danger
                    onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
                    <p>This item will be removed from the inventory.</p>
                </ConfirmDialog>
            )}
        </div>
    );
}
