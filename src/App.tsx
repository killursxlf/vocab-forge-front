import { lazy, Suspense } from 'react';
import ThemeProvider from '@/components/theme/ThemeProvider';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { AnswerSyncProvider } from './contexts/AnswerSyncContext';
import Index from './pages/Index';

const AppPage = lazy(() => import('./pages/AppPage'));
const CardsPage = lazy(() => import('./pages/CardsPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const TrainPage = lazy(() => import('./pages/TrainPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const queryClient = new QueryClient({ defaultOptions: { queries: {
  retry: (attempt, error: Error) => (error as Error & { response?: { status?: number } }).response?.status !== 401 && attempt < 2,
} } });
function RouteLoading() {
  const { t } = useTranslation();
  return <div className="p-8" role="status">{t('auth.session.loading')}</div>;
}
export default function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider><Toaster /><Sonner />
      <BrowserRouter><AuthProvider><AnswerSyncProvider><ThemeProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AppPage />} />
              <Route path="/cards" element={<CardsPage />} />
              <Route path="/train" element={<TrainPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ThemeProvider></AnswerSyncProvider></AuthProvider></BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>;
}
