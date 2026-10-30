import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import { Loading, WarningBanner, formatPrice } from '../components/ui.jsx';

export function UsageMeter({ subscription }) {
    const { characterCount, characterLimit } = subscription;
    const pct = Math.min(100, Math.round((characterCount / characterLimit) * 100));
    return (
        <div className="usage">
            <div className="usage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={characterLimit} aria-valuenow={characterCount}>
                <div className={`usage-fill${characterCount >= characterLimit ? ' full' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="usage-text">{characterCount} of {characterLimit} slots used · {subscription.remaining} remaining</p>
        </div>
    );
}

export default function AccountPage() {
    const { user, subscription, refreshSubscription } = useAuth();

    useEffect(() => {
        refreshSubscription().catch(() => {});
    }, [refreshSubscription]);

    return (
        <AppShell>
            <h3>Account &amp; Subscription</h3>
            <dl className="details">
                <dt>Email</dt><dd>{user.email}</dd>
                <dt>Display name</dt><dd>{user.displayName || '—'}</dd>
                <dt>Member since</dt><dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
            </dl>

            {!subscription ? <Loading /> : (
                <>
                    <dl className="details">
                        <dt>Current plan</dt>
                        <dd>{subscription.plan.name} ({formatPrice(subscription.plan)}/mo, simulated)</dd>
                        <dt>Status</dt><dd className="capitalize">{subscription.status}</dd>
                        <dt>Since</dt><dd>{new Date(subscription.startedAt).toLocaleDateString()}</dd>
                    </dl>
                    <UsageMeter subscription={subscription} />
                    {subscription.overLimit && (
                        <WarningBanner>
                            You have {subscription.characterCount} characters but your {subscription.plan.name} plan allows {subscription.characterLimit}.
                            Your existing characters are safe, but you can't create new ones until you delete
                            {' '}{subscription.characterCount - subscription.characterLimit + 1} or upgrade.
                        </WarningBanner>
                    )}
                    <div className="dashboard-footer">
                        <Link to="/plans" className="btn-primary btn-link">Change Plan</Link>
                    </div>
                </>
            )}
        </AppShell>
    );
}
