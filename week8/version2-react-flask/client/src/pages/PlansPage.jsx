import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import { ConfirmDialog, ErrorBanner, Loading, WarningBanner, formatPrice } from '../components/ui.jsx';

export default function PlansPage() {
    const { subscription, refreshSubscription } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const welcome = params.get('welcome') === '1';
    const [plans, setPlans] = useState(null);
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        api.get('/plans').then((d) => setPlans(d.plans)).catch((err) => setMessage(err.message));
    }, []);

    async function confirmChange() {
        setBusy(true);
        setMessage('');
        try {
            await api.put('/subscription', { planId: pending.id });
            await refreshSubscription();
            setSuccess(`You're now on the ${pending.name} plan.`);
            setPending(null);
            if (welcome) navigate('/characters');
        } catch (err) {
            setMessage(err.message);
            setPending(null);
        } finally {
            setBusy(false);
        }
    }

    const currentId = subscription?.plan.id;
    const count = subscription?.characterCount ?? 0;

    return (
        <AppShell wide>
            <h2>Choose Your Path</h2>
            <p>Select a tier to determine your character capacity.</p>
            <p className="hint">Plan changes are simulated for this prototype: no payment is taken and no card details are ever asked for.</p>
            <ErrorBanner message={message} />
            {success && <div className="banner banner-success" role="status">{success}</div>}

            {!plans ? <Loading /> : (
                <div className="pricing-grid">
                    {plans.map((plan) => {
                        const isCurrent = plan.id === currentId;
                        return (
                            <div key={plan.id} className={`price-card${isCurrent ? ' active' : ''}`}>
                                {plan.id === 'adventurer' && <div className="ribbon">Popular</div>}
                                <h3>{plan.name}</h3>
                                <div className="price">{formatPrice(plan)}<span className="per">/mo</span></div>
                                <p>Up to {plan.characterLimit} Characters</p>
                                {isCurrent ? (
                                    <span className="current-tag">Current plan</span>
                                ) : (
                                    <button type="button" className="btn-plan btn-primary" onClick={() => { setSuccess(''); setPending(plan); }}>
                                        Choose {plan.name}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {welcome
                ? <Link to="/characters" className="btn-secondary btn-link">Continue with {subscription?.plan.name ?? 'Free'}</Link>
                : <Link to="/account" className="btn-secondary btn-link">Back to Account</Link>}

            {pending && (
                <ConfirmDialog
                    title={`Switch to ${pending.name}?`}
                    confirmLabel={`Switch to ${pending.name}`}
                    busy={busy}
                    onConfirm={confirmChange}
                    onCancel={() => setPending(null)}
                >
                    <p>{pending.name} allows up to <strong>{pending.characterLimit}</strong> characters ({formatPrice(pending)}/mo, simulated).</p>
                    <p className="hint">This is a simulated plan change. No payment is taken.</p>
                    {count > pending.characterLimit && (
                        <WarningBanner>
                            You have {count} characters, which is over this plan's limit of {pending.characterLimit}.
                            You'll keep all of them, but you can't create new characters until you're back under the limit.
                        </WarningBanner>
                    )}
                </ConfirmDialog>
            )}
        </AppShell>
    );
}
