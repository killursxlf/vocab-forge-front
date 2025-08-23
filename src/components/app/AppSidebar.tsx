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

const profileItems = [
  { title: "Профиль", url: "/profile", icon: User },
];

const mainItems = [
  { title: "Редактор", url: "/app", icon: Table },
  { title: "Настройка карточек", url: "/cards", icon: Sliders },
  { title: "Тренировка", url: "/train", icon: Play },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar collapsible="icon" className="border-r">
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
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" />
                        <span className="ml-3">{item.title}</span>
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
            LexiTable
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
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" />
                        <span className="ml-3">{item.title}</span>
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