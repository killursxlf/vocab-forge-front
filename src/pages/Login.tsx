import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>(''); 
  
  const navigate = useNavigate(); 
  const { login } = useAuth(); 

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/app'); 
    } catch (err: any) {
      setError(err.response?.data?.message || 'Неверные учетные данные');
    }
  };

  const handleGoogleLogin = () => {
    const API_URL = import.meta.env.VITE_API_BASE_URL;
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      `${API_URL}/auth/google`,
      'GoogleLogin',
      `width=${width},height=${height},top=${top},left=${left}`
    );

    const listener = (event: MessageEvent) => {
      if (event.data === 'google-auth-success') {
        navigate('/app');
        window.removeEventListener('message', listener);
      }
    };


    window.addEventListener('message', listener);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            LexiTable
          </h1>
          <p className="text-muted-foreground">
            Войдите в свой аккаунт
          </p>
        </div>

        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Вход</CardTitle>
            <CardDescription className="text-center">
              Введите email и пароль для входа
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full h-11 bg-white dark:bg-white text-black hover:bg-gray-50 dark:hover:bg-gray-100 border-gray-300"
              onClick={handleGoogleLogin} // <--- Привязываем обработчик
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Войти через Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Или продолжите с
                </span>
              </div>
            </div>

            {/* <--- 6. Оборачиваем поля в <form> --- */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@example.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
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
                      Запомнить меня
                    </Label>
                  </div>
                  <Link
                    to="#"
                    className="text-sm text-primary hover:underline"
                  >
                    Забыли пароль?
                  </Link>
                </div>
                
                {error && <p className="text-sm text-center text-red-500">{error}</p>}

                <Button type="submit" className="w-full">
                  Войти
                </Button>
              </div>
            </form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Нет аккаунта?{" "}
                <Link
                  to="/register"
                  className="text-primary hover:underline font-medium"
                >
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}