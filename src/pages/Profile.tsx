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
import { useTranslation } from "react-i18next";

import type { User as UserType } from "../lib/types";
import { getUserProfile, updateUserProfile, changeUserPassword, logout } from "../lib/api";

interface ProfileUser extends UserType {
  name?: string;
  createdAt?: string;
}

export default function Profile() {
  const { t, i18n } = useTranslation();
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
      const msg = axiosError.response?.data?.message || axiosError.message || t("auth.profile.errors.load");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!formData.name.trim()) {
      setError(t("auth.profile.errors.emptyName"));
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
      setError(axiosError.response?.data?.message || axiosError.message || t("auth.profile.errors.saveName"));
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!formData.email.trim()) {
      setError(t("auth.profile.errors.emptyEmail"));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t("auth.profile.errors.invalidEmail"));
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
      setError(axiosError.response?.data?.message || axiosError.message || t("auth.profile.errors.saveEmail"));
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError(t("auth.profile.errors.passwordAllRequired"));
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t("auth.profile.errors.passwordMismatch"));
      return;
    }
    if (formData.newPassword.length < 6) {
      setError(t("auth.profile.errors.passwordMin"));
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
      setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
      alert(response.data?.message || t("auth.profile.success.passwordChanged"));
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message || axiosError.message || t("auth.profile.errors.savePassword"));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      window.location.href = "/login";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t("auth.profile.fields.notProvided") as string;
    const date = new Date(dateString);
    const fmt = new Intl.DateTimeFormat(i18n.language || "en", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    return fmt.format(date);
  };

  const getLastLoginText = () => {
    const now = new Date();
    const time = now.toLocaleTimeString(i18n.language || "en", { hour: "2-digit", minute: "2-digit" });
    return t("auth.profile.todayAt", { time });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2 text-foreground">{t("auth.profile.loading")}</span>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-destructive">{t("auth.profile.loadError")}</p>
          <Button onClick={loadProfile} className="mt-4">{t("auth.profile.retry")}</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.profile.title")}</h1>
          <p className="text-muted-foreground">{t("auth.profile.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg" role="alert">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">
              {t("auth.profile.actions.close")}
            </Button>
          </div>
        )}

        <div className="grid gap-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> {t("auth.profile.sections.personal")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.profile.fields.name")}</Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t("auth.profile.fields.namePlaceholder") as string}
                    />
                    <Button onClick={handleSaveName} size="sm" disabled={savingName}>
                      {savingName && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{t("auth.profile.actions.save")}
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
                      {t("auth.profile.actions.cancel")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">{user?.name || t("auth.profile.fields.notProvided")}</span>
                    <Button
                      onClick={() => setIsEditingName(true)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      aria-label={t("auth.profile.actions.edit") as string}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.profile.fields.email")}</Label>
                {isEditingEmail ? (
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder={t("auth.profile.fields.emailPlaceholder") as string}
                    />
                    <Button onClick={handleSaveEmail} size="sm" disabled={savingEmail}>
                      {savingEmail && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{t("auth.profile.actions.save")}
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
                      {t("auth.profile.actions.cancel")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">{user?.email || t("auth.profile.fields.notProvided")}</span>
                    <Button
                      onClick={() => setIsEditingEmail(true)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      aria-label={t("auth.profile.actions.edit") as string}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" /> {t("auth.profile.sections.security")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isEditingPassword ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{t("auth.profile.fields.newPassword")}</p>
                    <p className="text-sm text-muted-foreground">{t("auth.profile.fields.passwordMasked")}</p>
                  </div>
                  <Button onClick={() => setIsEditingPassword(true)} variant="outline">
                    {t("auth.profile.actions.changePassword")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">{t("auth.profile.fields.currentPassword")}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder={t("auth.profile.fields.currentPasswordPlaceholder") as string}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t("auth.profile.fields.newPassword")}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder={t("auth.profile.fields.newPasswordPlaceholder") as string}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t("auth.profile.fields.confirmPassword")}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={t("auth.profile.fields.confirmPasswordPlaceholder") as string}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSavePassword} disabled={savingPassword}>
                      {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{t("auth.profile.actions.savePassword")}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingPassword(false);
                        setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
                        setError(null);
                      }}
                      variant="outline"
                    >
                      {t("auth.profile.actions.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" /> {t("auth.profile.sections.accountInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("auth.profile.labels.registeredAt")}</span>
                <Badge variant="secondary">{formatDate(user?.createdAt)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("auth.profile.labels.lastLogin")}</span>
                <span className="text-sm text-foreground">{getLastLoginText()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{t("auth.profile.logout.title")}</h3>
                  <p className="text-sm text-muted-foreground">{t("auth.profile.logout.subtitle")}</p>
                </div>
                <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  {t("auth.profile.logout.button")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
