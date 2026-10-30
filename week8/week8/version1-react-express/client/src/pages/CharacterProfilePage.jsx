import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import { ConfirmDialog, ErrorBanner, Loading } from '../components/ui.jsx';
import AttributesPanel from '../profile/AttributesPanel.jsx';
import EquipmentPanel from '../profile/EquipmentPanel.jsx';
import JournalPanel from '../profile/JournalPanel.jsx';

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'journal', label: 'Journal' },
];

export function DeleteCharacterMessage() {
    return (
        <p>
            This permanently deletes the character <strong>and all of its attributes, equipment and journal entries</strong>.
            It cannot be undone. They will be banished to the void!
        </p>
    );
}

function Stat({ label, value }) {
    if (value === null || value === undefined || value === '') return null;
    return <div className="stat-chip"><span>{label}</span><strong>{value}</strong></div>;
}

export default function CharacterProfilePage() {
    const { characterId } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
    const [character, setCharacter] = useState(null);
    const [message, setMessage] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get(`/characters/${characterId}`)
            .then((d) => setCharacter(d.character))
            .catch((err) => (err.status === 404 ? setNotFound(true) : setMessage(err.message)));
    }, [characterId]);

    async function confirmDelete() {
        setBusy(true);
        try {
            await api.del(`/characters/${characterId}`);
            navigate('/characters', { replace: true });
        } catch (err) {
            setMessage(err.message);
            setConfirming(false);
            setBusy(false);
        }
    }

    if (notFound) {
        return (
            <AppShell>
                <h2>Character not found</h2>
                <p>This character doesn't exist or isn't yours.</p>
                <Link to="/characters" className="btn-secondary btn-link">Back to your characters</Link>
            </AppShell>
        );
    }

    const c = character;
    // "42/50" when both are set, otherwise whichever part exists
    let health = null;
    if (c && (c.health !== null || c.maxHealth !== null)) {
        health = c.maxHealth === null ? c.health : `${c.health ?? '—'}/${c.maxHealth}`;
    }

    return (
        <AppShell wide>
            <ErrorBanner message={message} />
            {!c ? <Loading /> : (
                <>
                    <div className="log-header">
                        <div className="profile-title">
                            <h2 id="log-char-name">{c.name}</h2>
                            <p className="subtitle">{[c.species, c.role].filter(Boolean).join(' · ') || 'An adventurer of unknown origin'}</p>
                        </div>
                        <div className="row-actions">
                            <Link to="/characters" className="btn-secondary btn-link">Back</Link>
                            <Link to={`/characters/${c.id}/edit`} className="btn-edit btn-link">Edit</Link>
                            <button type="button" className="btn-delete" onClick={() => setConfirming(true)}>Delete</button>
                        </div>
                    </div>

                    <div className="tabs" role="tablist">
                        {TABS.map((t) => (
                            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                                className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setParams({ tab: t.id }, { replace: true })}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* panels stay mounted so their local lists survive tab switches; hidden ones just aren't shown */}
                    <div role="tabpanel" hidden={tab !== 'overview'}>
                        <div className="stat-chips">
                            <Stat label="Level" value={c.level} />
                            <Stat label="Health" value={health} />
                            <Stat label="Experience" value={c.experience} />
                        </div>
                        <AttributesPanel characterId={c.id} initialItems={c.attributes} />
                        {c.abilities && (<><h4>Powers &amp; Abilities</h4><p className="prose">{c.abilities}</p></>)}
                        <h4>Background</h4>
                        <p className="prose">{c.biography || <span className="hint">No backstory written yet.</span>}</p>
                    </div>
                    <div role="tabpanel" hidden={tab !== 'equipment'}>
                        <EquipmentPanel characterId={c.id} initialItems={c.equipment} />
                    </div>
                    <div role="tabpanel" hidden={tab !== 'journal'}>
                        <JournalPanel characterId={c.id} initialItems={c.journalEntries} />
                    </div>
                </>
            )}

            {confirming && (
                <ConfirmDialog title={`Delete ${c.name}?`} confirmLabel="Delete forever" danger busy={busy}
                    onConfirm={confirmDelete} onCancel={() => setConfirming(false)}>
                    <DeleteCharacterMessage />
                </ConfirmDialog>
            )}
        </AppShell>
    );
}
