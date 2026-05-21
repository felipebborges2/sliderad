import { createContext, useContext, useState, useCallback } from 'react';
import api from '../lib/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  });

  const login = useCallback(async (email, senha) => {
    const { data } = await api.post('/api/auth/login', { email, senha });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const register = useCallback(async (nome, email, senha) => {
    const { data } = await api.post('/api/auth/register', { nome, email, senha });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }, []);

  return <AuthCtx.Provider value={{ usuario, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
