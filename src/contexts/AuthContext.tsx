import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { User } from '@/lib/types';
import { login as apiLogin, logout as apiLogout, getProfile } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  sessionError: boolean;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const refreshSession = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setSessionError(false);
    try {
      const response = await getProfile(controller.signal);
      if (!controller.signal.aborted) setUser(response.data);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setUser(null);
        queryClient.clear();
      } else setSessionError(true);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [queryClient]);
  useEffect(() => {
    void refreshSession();
    const expire = () => {
      request.current?.abort();
      setUser(null);
      setIsLoading(false);
      setSessionError(false);
      queryClient.clear();
    };
    window.addEventListener('auth-expired', expire);
    return () => { request.current?.abort(); window.removeEventListener('auth-expired', expire); };
  }, [refreshSession, queryClient]);
  const login = async (email: string, password: string) => {
    request.current?.abort();
    await apiLogin({ email: email.trim(), password });
    const response = await getProfile();
    queryClient.clear();
    setUser(response.data);
    setIsLoading(false);
    setSessionError(false);
  };
  const logout = async () => {
    try { await apiLogout(); }
    catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
    }
    request.current?.abort();
    queryClient.clear();
    setUser(null);
    setIsLoading(false);
    setSessionError(false);
  };
  return <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, sessionError, refreshSession, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing');
  return context;
}
