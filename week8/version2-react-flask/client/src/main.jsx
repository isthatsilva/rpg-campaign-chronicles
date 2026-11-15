import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import App from './App.jsx';
// original realm forge stylesheet (copied unchanged), then additions for the new screens
import './styles/style.css';
import './styles/app.css';
// version 2 only: crimson color theme on top, so it doesn't look identical to version 1
import './styles/theme-v2.css';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
);
