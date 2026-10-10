import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, sessionError, refreshSession } = useAuth();
  const { t } = useTranslation();
  if (isLoading) return <div role="status" className="p-8">{t('auth.session.loading')}</div>;
  if (sessionError) return <div className="p-8" role="alert"><p>{t('auth.session.error')}</p><Button onClick={refreshSession}>{t('auth.profile.retry')}</Button></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
