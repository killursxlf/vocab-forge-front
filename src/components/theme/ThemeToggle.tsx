import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('navigation.theme.toggle')}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={t(isDark ? 'navigation.theme.light' : 'navigation.theme.dark')}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
