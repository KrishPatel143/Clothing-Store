import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const d = await api('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      auth: false,
    });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const saveMeasurements = useCallback(async (measurements) => {
    const d = await api('/users/measurements', { method: 'PUT', body: measurements });
    setUser((u) => (u ? { ...u, savedMeasurements: d.savedMeasurements } : u));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, saveMeasurements }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
