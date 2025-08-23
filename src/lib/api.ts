/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { User } from './types';
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
import { WordSetPage } from './types';

const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
});

interface LoginData {
  email: string;
  password: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface CountWordsFilters {
  frontKey: string;
  backKey: string;
  hintKey: string | null;
  selectedStatuses: string[];
  selectedTables?: (string | "all")[];
}

interface RegisterData extends LoginData {
  name: string;
}

export const login = (data: LoginData) => {
  return api.post<User>('/auth/login', data);
};

export const logout = () => api.post('/auth/logout');

export const getProfile = () => api.get<User>('/auth/profile');

export const register = (data: RegisterData) => api.post('/users/register', data);

export const getWordSets = async () => {
  const { data } = await api.get('/word-sets');
  return data;
};

export const createWordSet = async (newSetData: any) => {
  const { data } = await api.post('/word-sets', newSetData);
  return data;
};

export const deleteWordSet = async (setId: number) => {
  const { data } = await api.delete(`/word-sets/${setId}`);
  return data;
};

export const updateWordSet = async ({ setId, updatedData }: { setId: number, updatedData: any }) => {
  const { data } = await api.patch(`/word-sets/${setId}`, updatedData);
  return data;
};

export const addWordToSet = async ({ setId, newWordData }: { setId: number, newWordData: any }) => {
  const { data } = await api.post(`/word-sets/${setId}/words`, newWordData);
  return data;
};

export const updateWord = async ({ wordId, updatedData }: { wordId: number, updatedData: any }) => {
  const { data } = await api.patch(`/words/${wordId}`, updatedData);
  return data;
};

export const deleteWord = async (wordId: number) => {
  const { data } = await api.delete(`/words/${wordId}`);
  return data;
};


export const getWordSetById = async (id: number, queryString: string): Promise<WordSetPage> => {
  try {
    const url = `/word-sets/${id}?${queryString}`;
    console.log('🌐 API Request:', url);

    const response = await api.get(url);
    
    console.log('📦 Response data:', response.data);
    const data = response.data;
    
    const result: WordSetPage = {
      id: data.id,
      title: data.title,
      customColumns: data.customColumns || [],
      words: data.words || [],
      hasMore: data.hasMore || false,
      total: data.total || 0,
    };
    
    console.log('✅ Processed result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ API Error:', error);
    throw error;
  }
};

export const countWords = (filters: CountWordsFilters) => {
  return api.post<{ data: { count: number } }>('/card-settings/count', filters);
};

export const getTrainingCards = async () => {
  const { data } = await api.get('/card-settings/cards');
  return data;
};

export const getCardSettings = () => api.get('/card-settings');

export const updateCardSettings = (settingsData: any) => api.put('/card-settings', settingsData);

export const getUserProfile = () => {
  return api.get<User>('/users/me');
};

export const updateUserProfile = (data: UpdateUserDto) => {
  return api.patch<User>('/users/me', data);
};

export const changeUserPassword = (data: ChangePasswordDto) => {
  return api.post<{ message: string }>('/users/change-password', data);
};

export default api;
