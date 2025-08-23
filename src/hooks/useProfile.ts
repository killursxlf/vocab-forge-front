/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile, changeUserPassword } from '../lib/api'; 
import type { User } from '../lib/types'; 

interface UpdateUserDto {
  name?: string;
  email?: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface UseProfileReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: UpdateUserDto) => Promise<void>;
  changePassword: (data: ChangePasswordDto) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

export const useProfile = (): UseProfileReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUserProfile();
      setUser(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка загрузки профиля';
      setError(errorMessage);
      console.error('Ошибка загрузки профиля:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: UpdateUserDto) => {
    try {
      setError(null);
      const response = await updateUserProfile(data);
      setUser(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка обновления профиля';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const changePassword = async (data: ChangePasswordDto) => {
    try {
      setError(null);
      await changeUserPassword(data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка изменения пароля';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  useEffect(() => {
    loadProfile();
  }, []);

  return {
    user,
    loading,
    error,
    updateProfile,
    changePassword,
    refreshProfile,
    clearError,
  };
};