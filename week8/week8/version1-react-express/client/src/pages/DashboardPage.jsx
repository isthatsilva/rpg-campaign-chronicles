import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import { ConfirmDialog, ErrorBanner, Loading, WarningBanner } from '../components/ui.jsx';
import { DeleteCharacterMessage } from './CharacterProfilePage.jsx';

export default function DashboardPage() {
    const { subscription, refreshSubscription } = useAuth();
    const navigate = useNavigate();
    const [characters, setCharacters] = useState(null);
    const [message, setMessage] = useState('');
    const [toDelete, setToDelete] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [data] = await Promise.all([api.get('/characters'), refreshSubscription()]);
            setCharacters(data.characters);
        } catch (err) {
            setMessage(err.message);
        }
    }, [refreshSubscription]);

    useEffect(() => { load(); }, [load]);

    async function confirmDelete() {
        setBusy(true);
        try {
            await api.del(`/characters/${toDelete.id}`);
            setToDelete(null);
            await load();
        } catch (err) {
            setMessage(err.message);
            setToDelete(null);
        } finally {
            setBusy(false);
        }
    }

    const canCreate = subscription?.canCreate ?? false;

    return (
        <AppShell wide>
            <div id="character-list-container">
                <div className="list-header">
                    <h3>Your Legends</h3>
                    {subscription && <span id="char-count">{subscription.characterCount}/{subscription.characterLimit} Characters</span>}
                </div>
                <ErrorBanner message={message} />
                {subscription?.overLimit && (
                    <WarningBanner>
                        You're over your {subscription.plan.name} plan's limit of {subscription.characterLimit}. Your characters are safe,
                        but you can't create new ones until you delete some or <Link to="/plans">upgrade</Link>.
                    </WarningBanner>
                )}

                {!characters ? <Loading /> : characters.length === 0 ? (
                    <div id="empty-state"><p>Your chronicles are empty. Forge your first hero!</p></div>
                ) : (
                    <div id="character-list" className="character-grid">
                        {characters.map((c) => (
                            <div key={c.id} className="char-card">
                                <h4><Link to={`/characters/${c.id}`}>{c.name}</Link></h4>
                                {c.species && <p><strong>Species:</strong> {c.species}</p>}
                                {c.role && <p><strong>Role:</strong> {c.role}</p>}
                                {c.level !== null && <p><strong>Level:</strong> {c.level}</p>}
                                <div className="char-actions">
                                    <button type="button" className="btn-log" onClick={() => navigate(`/characters/${c.id}`)}>View</button>
                                    <button type="button" className="btn-edit" onClick={() => navigate(`/characters/${c.id}/edit`)}>Edit</button>
                                    <button type="button" className="btn-delete" onClick={() => setToDelete(c)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="dashboard-footer">
                <button type="button" id="create-char-btn" className="btn-primary" disabled={!canCreate} onClick={() => navigate('/characters/new')}>
                    Create New Character
                </button>
                {subscription && !canCreate && (
                    <p className="hint">
                        You've used all {subscription.characterLimit} slots on the {subscription.plan.name} plan.
                        Delete a character or <Link to="/plans">upgrade your plan</Link> to create another.
                    </p>
                )}
            </div>

            {toDelete && (
                <ConfirmDialog title={`Delete ${toDelete.name}?`} confirmLabel="Delete forever" danger busy={busy}
                    onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
                    <DeleteCharacterMessage />
                </ConfirmDialog>
            )}
        </AppShell>
    );
}
