import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '../services/auth';

const AuthContext = createContext(null);

const PERMISSIONS = {
  designer: { read: ['admin'], write: ['admin'] },
  groups: { read: ['admin', 'editor', 'viewer'], write: ['admin', 'editor'] },
  locations: { read: ['admin', 'editor', 'viewer'], write: ['admin', 'editor'] },
  statistics: { read: ['admin', 'editor', 'viewer'], write: [] },
  users: { read: ['admin'], write: ['admin'] },
  settings: { read: ['admin'], write: ['admin'] }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const data = await fetchCurrentUser();
      setUser(data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    setUser(null);
  }, []);

  const role = user?.role || null;

  const canAccess = useCallback((feature, action = 'read') => {
    if (!role) return false;
    if (role === 'admin') return true;
    const config = PERMISSIONS[feature];
    if (!config) return false;
    const allowList = action === 'write' ? config.write : config.read;
    return Array.isArray(allowList) && allowList.includes(role);
  }, [role]);

  const value = useMemo(() => ({
    user,
    role,
    loading,
    login,
    logout,
    canAccess
  }), [user, role, loading, login, logout, canAccess]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
