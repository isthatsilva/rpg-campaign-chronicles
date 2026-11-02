import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);

    const refreshSubscription = useCallback(async () => {
        const data = await api.get('/subscription');
        setSubscription(data.subscription);
        return data.subscription;
    }, []);

    const clear = useCallback(() => {
        setUser(null);
        setSubscription(null);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(clear);
        api.get('/auth/me')
            .then((data) => {
                setUser(data.user);
                return refreshSubscription();
            })
            .catch(clear)
            .finally(() => setLoading(false));
    }, [clear, refreshSubscription]);

    const value = useMemo(() => ({
        user,
        subscription,
        loading,
        refreshSubscription,
        async login(email, password) {
            const data = await api.post('/auth/login', { email, password });
            setUser(data.user);
            await refreshSubscription();
        },
        async register(email, password, displayName) {
            const data = await api.post('/auth/register', { email, password, displayName });
            setUser(data.user);
            await refreshSubscription();
        },
        async logout() {
            try {
                await api.post('/auth/logout');
            } finally {
                clear();
            }
        },
    }), [user, subscription, loading, refreshSubscription, clear]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
