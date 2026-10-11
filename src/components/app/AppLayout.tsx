import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppSidebar } from "./AppSidebar";
import { AnswerSyncStatus } from '@/contexts/AnswerSyncContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <SidebarProvider>
        <AppSidebar />
        
        <div className="flex-1 min-w-0 flex flex-col w-full">
          <header className="h-14 shrink-0 flex items-center gap-3 border-b bg-background/80 backdrop-blur sticky top-0 z-20 px-4">
            <SidebarTrigger aria-label={t('navigation.toggle')} />
            <Link to="/app" className="font-semibold">LexiTable</Link>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          
          <AnswerSyncStatus />
          <main className="flex-1 w-full min-w-0">{children}</main>
        </div>
    </SidebarProvider>
  );
}
