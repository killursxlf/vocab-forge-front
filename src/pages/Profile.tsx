import { useState, useEffect } from "react";
import { User, Mail, Lock, Calendar, LogOut, Edit3, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/app/AppLayout";

import type { User as UserType } from "../lib/types";
import { getUserProfile, updateUserProfile, changeUserPassword, logout } from "../lib/api";

interface UpdateUserDto {
  name?: string;
  email?: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface ProfileUser extends UserType {
  name?: string;
  createdAt?: string;
}

export default function Profile() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUserProfile();
      const userData = response.data as ProfileUser;
      setUser(userData);
      setFormData(prev => ({
        ...prev,
        name: userData.name || "",
        email: userData.email || ""
      }));
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Ошибка загрузки профиля';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!formData.name.trim()) {
      setError('Имя не может быть пустым');
      return;
    }
    try {
      setSavingName(true);
      setError(null);
      const response = await updateUserProfile({ name: formData.name });
      setUser(response.data as ProfileUser);
      setIsEditingName(false);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message || axiosError.message || 'Ошибка при сохранении имени');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!formData.email.trim()) {
      setError('Email не может быть пустым');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Введите корректный email адрес');
      return;
    }
    try {
      setSavingEmail(true);
      setError(null);
      const response = await updateUserProfile({ email: formData.email });
      setUser(response.data as ProfileUser);
      setIsEditingEmail(false);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message || axiosError.message || 'Ошибка при сохранении email');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('Заполните все поля для смены пароля');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }
    if (formData.newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      return;
    }
    try {
      setSavingPassword(true);
      setError(null);
      const response = await changeUserPassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });
      setIsEditingPassword(false);
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
      alert(response.data.message || 'Пароль успешно изменен');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message || axiosError.message || 'Ошибка при изменении пароля');
    } finally {
      setSavingPassword(false);
    }
  };

    const handleLogout = async () => {
    try {
        await logout(); 
    } catch (err) {
        console.error("Ошибка при выходе", err);
    } finally {
        window.location.href = '/login';
    }
    };


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLastLoginText = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `Сегодня в ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2 text-foreground">Загрузка профиля...</span>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Ошибка загрузки данных профиля</p>
          <Button onClick={loadProfile} className="mt-4">Попробовать снова</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Профиль</h1>
          <p className="text-muted-foreground">Управляйте своими личными данными и настройками аккаунта</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">Закрыть</Button>
          </div>
        )}

        <div className="grid gap-6">
          {/* Личная информация */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Личная информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Имя */}
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Введите ваше имя"
                    />
                    <Button onClick={handleSaveName} size="sm" disabled={savingName}>
                      {savingName && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Сохранить
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, name: user?.name || "" }));
                        setIsEditingName(false);
                        setError(null);
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">{user?.name || "Не указано"}</span>
                    <Button 
                      onClick={() => setIsEditingName(true)}
                      variant="ghost" 
                      size="sm"
                      className="h-8 px-2"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {isEditingEmail ? (
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Введите ваш email"
                    />
                    <Button onClick={handleSaveEmail} size="sm" disabled={savingEmail}>
                      {savingEmail && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Сохранить
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, email: user?.email || "" }));
                        setIsEditingEmail(false);
                        setError(null);
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">{user?.email || "Не указано"}</span>
                    <Button 
                      onClick={() => setIsEditingEmail(true)}
                      variant="ghost" 
                      size="sm"
                      className="h-8 px-2"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Безопасность */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" /> Безопасность
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isEditingPassword ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Пароль</p>
                    <p className="text-sm text-muted-foreground">••••••••</p>
                  </div>
                  <Button onClick={() => setIsEditingPassword(true)} variant="outline">Изменить пароль</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Текущий пароль</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Введите текущий пароль"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Новый пароль</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Введите новый пароль"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Повторите новый пароль"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSavePassword} disabled={savingPassword}>
                      {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Сохранить пароль
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsEditingPassword(false);
                        setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
                        setError(null);
                      }}
                      variant="outline"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Информация об аккаунте */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Информация об аккаунте
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Дата регистрации</span>
                <Badge variant="secondary">{formatDate(user?.createdAt)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Последний вход</span>
                <span className="text-sm text-foreground">{getLastLoginText()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Выход из аккаунта */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">Выйти из аккаунта</h3>
                  <p className="text-sm text-muted-foreground">Завершить текущий сеанс</p>
                </div>
                <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Выйти
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
