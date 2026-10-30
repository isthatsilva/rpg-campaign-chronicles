import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// label + input + per-field error message. if the input has no id, one is generated
// so the label is always linked to it (screen readers and click-to-focus rely on that).
export function Field({ label, error, htmlFor, children }) {
    const generatedId = useId();
    const errorId = `${generatedId}-error`;
    let id = htmlFor;
    let control = children;
    if (isValidElement(children)) {
        id = children.props.id || htmlFor || generatedId;
        control = cloneElement(children, {
            id,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? errorId : undefined,
        });
    }
    return (
        <div className="form-group">
            {label && <label htmlFor={id}>{label}</label>}
            {control}
            {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
        </div>
    );
}

export function ErrorBanner({ message }) {
    if (!message) return null;
    return <div className="banner banner-error" role="alert">{message}</div>;
}

export function WarningBanner({ children }) {
    return <div className="banner banner-warning" role="status">{children}</div>;
}

// modal confirmation used for every destructive action and for plan changes
export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
    const cancelRef = useRef(null);
    useEffect(() => {
        cancelRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);

    return (
        <div className="modal-overlay" onClick={() => !busy && onCancel()}>
            <div className="modal magic-border" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
                <h3 id="modal-title">{title}</h3>
                <div className="modal-body">{children}</div>
                <div className="button-group">
                    <button type="button" ref={cancelRef} className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
                    <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function Loading({ text = 'Consulting the archives…' }) {
    return <p className="loading">{text}</p>;
}

// redirects to /login when not signed in, remembering where the user was headed
export function ProtectedRoute() {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <div className="container magic-border"><Loading /></div>;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return <Outlet />;
}

// login/register pages bounce signed-in users to the dashboard
export function GuestRoute() {
    const { user, loading } = useAuth();
    if (loading) return <div className="container magic-border"><Loading /></div>;
    if (user) return <Navigate to="/characters" replace />;
    return <Outlet />;
}

export function formatPrice(plan) {
    if (plan.priceCents === 0) return '$0';
    return `$${(plan.priceCents / 100).toFixed(plan.priceCents % 100 ? 2 : 0)}`;
}
