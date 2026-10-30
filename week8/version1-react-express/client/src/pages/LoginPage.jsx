import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ErrorBanner, Field } from '../components/ui.jsx';
import { checkEmail, collectErrors } from '../validation.js';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [form, setForm] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    async function handleSubmit(e) {
        e.preventDefault();
        const found = collectErrors({ email: checkEmail(form.email), password: form.password ? null : 'Password is required.' });
        setErrors(found);
        setMessage('');
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
            await login(form.email, form.password);
            navigate(location.state?.from || '/characters', { replace: true });
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
                <h1>⚔️ RPG Campaign Chronicles ⚔️</h1>
                <p className="subtitle">Enter the Eternal Archives</p>
                <ErrorBanner message={message} />
                <form onSubmit={handleSubmit} noValidate>
                    <Field error={errors.email}>
                        <input type="email" placeholder="Email..." aria-label="Email" autoComplete="email"
                            value={form.email} onChange={set('email')} />
                    </Field>
                    <Field error={errors.password}>
                        <input type="password" placeholder="Password..." aria-label="Password" autoComplete="current-password"
                            value={form.password} onChange={set('password')} />
                    </Field>
                    <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Opening…' : 'Unlock Gate'}</button>
                </form>
                <p className="footer-text">New to the realm? <Link to="/register">Create an Account</Link></p>
            </div>
        </section>
    );
}
