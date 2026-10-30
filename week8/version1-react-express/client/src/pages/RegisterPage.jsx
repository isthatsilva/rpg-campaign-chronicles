import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ErrorBanner, Field } from '../components/ui.jsx';
import { checkEmail, checkPassword, checkText, collectErrors } from '../validation.js';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', displayName: '', password: '', confirm: '' });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    async function handleSubmit(e) {
        e.preventDefault();
        const found = collectErrors({
            email: checkEmail(form.email),
            displayName: checkText(form.displayName, 'Display name', { max: 50 }),
            password: checkPassword(form.password),
            confirm: form.confirm === form.password ? null : 'Passwords do not match.',
        });
        setErrors(found);
        setMessage('');
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            await register(form.email, form.password, form.displayName);
            // new accounts start on free; offer the plan picker right away
            navigate('/plans?welcome=1', { replace: true });
        } catch (err) {
            setErrors(err.fields || {});
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="view">
            <div className="container magic-border">
                <h2>Join the Order</h2>
                <ErrorBanner message={message} />
                <form onSubmit={handleSubmit} noValidate>
                    <Field label="Email" htmlFor="reg-email" error={errors.email}>
                        <input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
                    </Field>
                    <Field label="Display name (optional)" htmlFor="reg-name" error={errors.displayName}>
                        <input id="reg-name" type="text" autoComplete="nickname" maxLength={50} value={form.displayName} onChange={set('displayName')} />
                    </Field>
                    <Field label="Password" htmlFor="reg-password" error={errors.password}>
                        <input id="reg-password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
                    </Field>
                    <p className="hint">At least 8 characters, with a letter and a number.</p>
                    <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirm}>
                        <input id="reg-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
                    </Field>
                    <div className="stack">
                        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Forging…' : 'Continue to Plan'}</button>
                        <Link to="/login" className="btn-secondary btn-link">Back to Login</Link>
                    </div>
                </form>
            </div>
        </section>
    );
}
