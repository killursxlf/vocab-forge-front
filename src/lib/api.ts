import axios from 'axios';
import type { User, Word, WordSet, WordSetPage } from './types';
import { resolveApiUrl } from './apiUrl';
import { getAllPages } from './pagination';
import { parseReviewSummary } from './reviewSummary';
export const API_BASE_URL = resolveApiUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.response.use(response => response, error => {
  if (axios.isAxiosError(error) && error.response?.status === 401 &&
      !['/auth/login', '/auth/profile', '/users/register'].includes(error.config?.url ?? '')) {
    window.dispatchEvent(new Event('auth-expired'));
  }
  return Promise.reject(error);
});

export function errorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const message: unknown = error.response?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every(item => typeof item === 'string')) return message.join(', ');
  return fallback;
}

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

export const getProfile = async (signal?: AbortSignal) => {
  const response = await api.get<{ id?: number; userId?: number; email: string }>('/auth/profile', { signal });
  const id = response.data.id ?? response.data.userId;
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid user profile');
  return { ...response, data: { id, email: response.data.email } as User };
};

export const register = (data: RegisterData) => api.post('/users/register', data);

export const getWordSets = ({ signal }: { signal?: AbortSignal } = {}) => getAllPages(async (offset, limit) => {
  const { data } = await api.get<WordSet[]>('/word-sets', { params: { offset, limit }, signal });
  return data;
});

export const createWordSet = async (newSetData: Pick<WordSet, 'title' | 'customColumns'>) => {
  const { data } = await api.post<WordSet>('/word-sets', newSetData);
  return data;
};

export const deleteWordSet = async (setId: number) => {
  const { data } = await api.delete(`/word-sets/${setId}`);
  return data;
};

export const updateWordSet = async ({ setId, updatedData }: { setId: number, updatedData: Partial<Pick<WordSet, 'title' | 'customColumns'>> }) => {
  const { data } = await api.patch(`/word-sets/${setId}`, updatedData);
  return data;
};

export const addWordToSet = async ({ setId, newWordData }: { setId: number, newWordData: Omit<Word, 'id' | 'createdAt'> }) => {
  const { data } = await api.post<Word>(`/word-sets/${setId}/words`, newWordData);
  return data;
};

export const updateWord = async ({ wordId, updatedData }: { wordId: number, updatedData: Partial<Omit<Word, 'id' | 'createdAt'>> }) => {
  const { data } = await api.patch<Word>(`/words/${wordId}`, updatedData);
  return data;
};

export const submitAnswer = async (wordId: number, knows: boolean, answerId: string, signal?: AbortSignal) => {
  const { data } = await api.post(`/words/${wordId}/answer`, { knows, answerId }, { signal });
  return data;
};

export const deleteWord = async (wordId: number) => {
  const { data } = await api.delete(`/words/${wordId}`);
  return data;
};


export const getWordSetById = async (id: number, queryString: string): Promise<WordSetPage> => {
  const { data } = await api.get<WordSetPage>('/word-sets/' + id + '?' + queryString);
  return {
    id: data.id, title: data.title, customColumns: data.customColumns ?? [],
    words: data.words ?? [], hasMore: data.hasMore ?? false, total: data.total ?? 0,
  };
};

export const countWords = async (filters: CountWordsFilters, signal?: AbortSignal) => {
  const response = await api.post('/card-settings/count', filters, { signal });
  return { ...response, data: { data: parseReviewSummary(response.data.data) } };
};

export const getTrainingCards = (signal?: AbortSignal) => getAllPages(async (offset, limit) => {
  const { data } = await api.get<Word[]>('/card-settings/cards', { params: { offset, limit }, signal });
  return data;
});

export const getCardSettings = (signal?: AbortSignal) => api.get('/card-settings', { signal });

export const updateCardSettings = (settingsData: CountWordsFilters) => api.put('/card-settings', settingsData);

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
