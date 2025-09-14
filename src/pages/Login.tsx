import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<number | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/app");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          t("auth.login.errors.invalidCreds")
      );
    }
  };

  const cleanupGoogleLogin = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    popupRef.current = null;
  };

  const handleGoogleLogin = () => {
    const API_URL = import.meta.env.VITE_API_BASE_URL;
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    cleanupGoogleLogin();
    setError("");

    popupRef.current = window.open(
      `${API_URL}/auth/google?t=${Date.now()}`,
      "GoogleLogin",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    // Safety timeout in case the popup never responds
    timerRef.current = window.setTimeout(() => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      cleanupGoogleLogin();
      setError(t("auth.login.errors.googleTimeout"));
    }, 30000);
  };

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    const listener = (event: MessageEvent) => {
      try {
        const apiUrl = new URL(API_URL);
        if (event.origin !== apiUrl.origin) return;

        if (event.data === "google-auth-success") {
          cleanupGoogleLogin();
          window.location.href = "/app";
        } else if (event.data === "google-auth-error") {
          cleanupGoogleLogin();
          setError(t("auth.login.errors.googleError"));
        }
      } catch {
        // ignore malformed events
      }
    };

    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
      cleanupGoogleLogin();
    };
  }, [t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6" aria-live="polite">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {t("auth.common.appName")}
          </h1>
          <p className="text-muted-foreground">{t("auth.login.pageTitle")}</p>
        </div>

        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {t("auth.login.heading")}
            </CardTitle>
            <CardDescription className="text-center">
              {t("auth.login.subheading")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-11 bg-white dark:bg-white text-black hover:bg-gray-50 dark:hover:bg-gray-100 border-gray-300"
              onClick={handleGoogleLogin}
              aria-label={t("auth.login.google")}
            >
              {/* Google logo */}
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("auth.login.google")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t("auth.login.orContinue")}
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.login.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("auth.login.placeholders.email") as string}
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.login.password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.login.placeholders.password") as string}
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      id="remember"
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="remember" className="text-sm font-normal">
                      {t("auth.login.rememberMe")}
                    </Label>
                  </div>
                  <Link to="#" className="text-sm text-primary hover:underline">
                    {t("auth.login.forgot")}
                  </Link>
                </div>

                {error && (
                  <p className="text-sm text-center text-red-500" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full">
                  {t("auth.login.submit")}
                </Button>
              </div>
            </form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("auth.login.noAccount")}{" "}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  {t("auth.login.register")}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
