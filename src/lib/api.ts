import axios from 'axios';
import { User } from './types';
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
});


interface LoginData {
  email: string;
  password: string;
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

// --- Функции API ---

export const login = (data: LoginData) => {
  return api.post<User>('/auth/login', data);
};

/**
 * Отправляет запрос на выход. Сервер удалит cookie.
 */
export const logout = () => api.post('/auth/logout');

/**
 * Получает профиль текущего пользователя.
 * Браузер автоматически прикрепит cookie к этому запросу.
 */
export const getProfile = () => api.get<User>('/auth/profile');


// --- Остальные функции вашего API (без изменений) ---

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

export const getWordSetById = async (setId: number) => {
  if (!setId) return null; 
  const { data } = await api.get(`/word-sets/${setId}`);
  return data;
};

export const countWords = (filters: CountWordsFilters) => {
  return api.post<{ data: { count: number } }>('/card-settings/count', filters);
};

// ПРАВИЛЬНО (новая версия)
export const getTrainingCards = async () => {
  const { data } = await api.get('/card-settings/cards');
  return data;
};

export const getCardSettings = () => api.get('/card-settings');

export const updateCardSettings = (settingsData: any) => api.put('/card-settings', settingsData);

export default api;
