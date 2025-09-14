import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function SiteHeader() {
  const { t } = useTranslation();

  return (
    <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
      <nav className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="font-semibold text-lg">
          {t("navigation.header.brand")}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="soft" asChild>
            <Link to="/app">{t("navigation.header.openEditor")}</Link>
          </Button>
          <Button variant="hero" asChild>
            <Link to="/register">{t("navigation.header.signUp")}</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
