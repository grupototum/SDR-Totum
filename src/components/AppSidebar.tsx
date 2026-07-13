import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Workflow, MessagesSquare, BarChart3, FlaskConical, Bot } from "lucide-react";
import logo from "@/assets/sdr-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Início", url: "/", icon: Home },
  { title: "Agentes", url: "/agentes", icon: Bot },
  { title: "Pesquisa", url: "/pesquisa", icon: Search },
  { title: "Builder", url: "/builder", icon: Workflow },
  { title: "Simulador", url: "/simulator", icon: FlaskConical },
  { title: "Conversas", url: "/conversations", icon: MessagesSquare },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-transparent">
      <div
        className={`glass iris-ring flex flex-1 flex-col overflow-hidden rounded-3xl ${
          collapsed ? "m-1.5" : "my-3 ml-3 mr-1"
        }`}
      >
        <SidebarHeader
          className={`h-16 flex-row items-center gap-3 bg-transparent ${
            collapsed ? "justify-center px-0" : "px-4"
          }`}
        >
          <img src={logo} alt="SDR Totum" className="size-8 shrink-0 object-contain" />
          {!collapsed && (
            <span className="truncate text-base tracking-tight text-[color:var(--lg-fg)]">
              SDR Totum
            </span>
          )}
        </SidebarHeader>

        <SidebarContent className="bg-transparent">
          <SidebarGroup className={collapsed ? "px-1" : undefined}>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="rounded-full data-[active=true]:text-[color:var(--lg-fg)] hover:bg-white/10"
                        style={
                          active
                            ? {
                                backgroundImage: "var(--gradient-iris)",
                                color: "#fff",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                              }
                            : undefined
                        }
                      >
                        <Link to={item.url} className="min-w-0">
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter
          className={`bg-transparent ${collapsed ? "items-center px-0 py-2" : "px-3 py-2"}`}
        >
          <SidebarTrigger
            className="size-8 rounded-full text-[color:var(--lg-fg)] hover:bg-white/15"
            style={{ boxShadow: "inset 0 0 0 1px var(--lg-border)" }}
          />
        </SidebarFooter>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}
