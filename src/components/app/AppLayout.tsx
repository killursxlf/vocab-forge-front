import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppSidebar } from "./AppSidebar";
import { AnswerSyncStatus } from '@/contexts/AnswerSyncContext';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 min-w-0 flex flex-col w-full">
          <header className="h-14 flex items-center border-b bg-background/80 backdrop-blur sticky top-0 z-20 px-4">
            <SidebarTrigger />
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          
          <AnswerSyncStatus />
          <main className="flex-1 w-full min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
