import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Workflow, MessagesSquare, BarChart3, FlaskConical } from "lucide-react";
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
      <div className="glass iris-ring m-2 flex flex-1 flex-col rounded-3xl overflow-hidden">
        <SidebarHeader className="h-14 flex-row items-center gap-2 px-3 bg-transparent">
          <img src={logo} alt="SDR Totum" className="size-8 shrink-0 object-contain" />
          {!collapsed && (
            <span className="text-sm tracking-tight text-[color:var(--lg-fg)]">SDR Totum</span>
          )}
        </SidebarHeader>

        <SidebarContent className="bg-transparent">
          <SidebarGroup>
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
                        <Link to={item.url}>
                          <item.icon className="size-4" />
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

        <SidebarFooter className="px-3 py-2 bg-transparent">
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
