import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// the signed-in frame: header (welcome + tier + nav + logout) around the page, social footer below
export default function AppShell({ children, wide = false }) {
    const { user, subscription, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    return (
        <div className={`container magic-border dashboard-container${wide ? ' wide' : ''}`}>
            <header>
                <div className="user-info">
                    <h2>Welcome, <span>{user.displayName || user.email}</span></h2>
                    <p id="display-tier">Tier: {subscription?.plan.name ?? '…'}</p>
                </div>
                <nav className="main-nav" aria-label="Main">
                    <NavLink to="/characters">Characters</NavLink>
                    <NavLink to="/account">Account</NavLink>
                    <NavLink to="/plans">Plans</NavLink>
                    <button type="button" className="btn-secondary" onClick={handleLogout}>Logout</button>
                </nav>
            </header>

            {children}

            <footer className="social-footer">
                <div className="social-links">
                    <a href="#">Twitter 🐦</a>
                    <a href="#">Discord 🎮</a>
                    <a href="#">Patreon 🛡️</a>
                </div>
            </footer>
        </div>
    );
}
