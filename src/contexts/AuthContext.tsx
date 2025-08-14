import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { User } from '../lib/types';
// --- 1. ИМПОРТИРУЕМ НУЖНЫЕ ФУНКЦИИ ИЗ API.TS ---
// Я переименовал их при импорте, чтобы избежать конфликта имен
import { login as apiLogin, logout as apiLogout, getProfile } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); 

  useEffect(() => {
    const checkUserSession = async () => {

      try {
        // Используем getProfile, так как токен уже должен быть подставлен перехватчиком
        const response = await getProfile();
        setUser(response.data);
      } catch (error) {
        console.log('Сессия недействительна или истекла');
        setUser(null);
        localStorage.removeItem('token'); // Чистим невалидный токен
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();
  }, []);

  // --- 2. ИСПРАВЛЕНА ФУНКЦИЯ LOGIN ---
  const login = async (email: string, password: string) => {
    // Вызываем нашу функцию-обертку из api.ts
    const response = await apiLogin({ email, password });
    // Теперь api.ts сам сохранит токен.
    // А мы установим данные пользователя в состояние.
    // В `response.data` теперь есть и юзер, и токен, но нам нужен только юзер.
    const { access_token, ...userData } = response.data as (User & { access_token: string });
    setUser(userData);
  };

  // --- 3. ИСПРАВЛЕНА ФУНКЦИЯ LOGOUT ---
  const logout = async () => {
    try {
        await apiLogout(); // Вызываем logout с сервера (если он что-то делает, например, чистит сессию)
    } catch (error) {
        console.error("Ошибка при выходе с сервера:", error);
    } finally {
        // Гарантированно чистим данные на клиенте
        setUser(null);
        localStorage.removeItem('token');
    }
  };

  const value = { 
    isAuthenticated: !!user, 
    user, 
    isLoading,
    login, 
    logout 
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};