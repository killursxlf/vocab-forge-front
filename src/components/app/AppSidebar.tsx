import { NavLink, useLocation } from "react-router-dom";
import { Table, Sliders, Play, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const currentPath = location.pathname;

  const profileItems = [
    { i18nKey: "navigation.items.profile", url: "/profile", icon: User },
  ] as const;

  const mainItems = [
    { i18nKey: "navigation.items.editor", url: "/app", icon: Table },
    { i18nKey: "navigation.items.cardSettings", url: "/cards", icon: Sliders },
    { i18nKey: "navigation.items.training", url: "/train", icon: Play },
  ] as const;

  return (
    <Sidebar collapsible="icon" className="border-r" aria-label="App sidebar">
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {profileItems.map((item) => {
                const active = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="w-full justify-start px-3 py-2"
                      aria-current={active ? "page" : undefined}
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span className="ml-3">{t(item.i18nKey)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-4" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-2 text-sm font-medium text-muted-foreground">
            {t("navigation.groups.app")}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu className="space-y-1">
              {mainItems.map((item) => {
                const active = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="w-full justify-start px-3 py-2"
                      aria-current={active ? "page" : undefined}
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span className="ml-3">{t(item.i18nKey)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
