import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './components/ui.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import PlansPage from './pages/PlansPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CharacterFormPage from './pages/CharacterFormPage.jsx';
import CharacterProfilePage from './pages/CharacterProfilePage.jsx';

export default function App() {
    return (
        <Routes>
            <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/characters" element={<DashboardPage />} />
                <Route path="/characters/new" element={<CharacterFormPage />} />
                <Route path="/characters/:characterId" element={<CharacterProfilePage />} />
                <Route path="/characters/:characterId/edit" element={<CharacterFormPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/characters" replace />} />
        </Routes>
    );
}
