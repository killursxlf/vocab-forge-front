import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function SiteHeader() {
  return (
    <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
      <nav className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="font-semibold text-lg">LexiTable</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="soft" asChild>
            <Link to="/app">Открыть редактор</Link>
          </Button>
          <Button variant="hero">
            <Link to="/register">Зарегистрироваться</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
