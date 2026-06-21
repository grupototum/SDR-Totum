import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Workflow, MessagesSquare, BarChart3 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const items: Array<{
  title: string;
  url: string;
  icon: typeof Home;
  exact?: boolean;
}> = [
  { title: "Início", url: "/", icon: Home, exact: true },
  { title: "Pesquisa", url: "/pesquisa", icon: Search },
  { title: "Builder", url: "/builder", icon: Workflow },
  { title: "Conversas", url: "/conversations", icon: MessagesSquare },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader
        className="h-14 flex-row items-center gap-2 px-3"
        style={{ boxShadow: "inset 0 -1px 0 0 rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: "linear-gradient(135deg,#e3433e,#da2128)" }}
        >
          <span className="text-white text-sm leading-none">T</span>
        </div>
        {!collapsed && (
          <span className="text-white text-sm tracking-[-0.02em]">SDR Totum</span>
        )}
      </SidebarHeader>

      <SidebarContent style={{ background: "var(--color-card-totum)" }}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url, item.exact);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="data-[active=true]:text-white"
                      style={
                        active
                          ? {
                              background:
                                "linear-gradient(135deg, rgba(227,67,62,0.18), rgba(218,33,40,0.18))",
                              boxShadow: "inset 0 0 0 1px rgba(218,33,40,0.45)",
                            }
                          : undefined
                      }
                    >
                      <Link to={item.url}>
                        <item.icon
                          className="size-4"
                          style={active ? { color: "#e3433e" } : undefined}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
