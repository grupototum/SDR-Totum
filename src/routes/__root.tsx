import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl">404</h1>
        <h2 className="mt-4 text-xl">Página não encontrada</h2>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-totum-red)] px-6 py-3 text-sm text-white transition-all hover:shadow-[var(--shadow-halo-red)]"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (!import.meta.env.PROD) console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          Algo deu errado. Tente recarregar ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-totum-red)] px-6 py-3 text-sm text-white"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm text-white card-shadow"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SDR Totum | Flow Builder" },
      {
        name: "description",
        content:
          "SDR Totum: construa fluxos visuais de automação de conversas no WhatsApp que parecem humanas.",
      },
      { property: "og:title", content: "SDR Totum | Flow Builder" },
      {
        property: "og:description",
        content: "Automação de conversas que parecem humanas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SDR Totum | Flow Builder" },
      {
        name: "twitter:description",
        content: "Build visual flows for WhatsApp conversation automation.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a311eccd-9967-4bf6-af4c-11cc2075cb56/id-preview-90d38be8--d1addaef-0e7f-4422-896f-8758325064f6.lovable.app-1782047010958.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a311eccd-9967-4bf6-af4c-11cc2075cb56/id-preview-90d38be8--d1addaef-0e7f-4422-896f-8758325064f6.lovable.app-1782047010958.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/@xyflow/react@12/dist/style.css",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="lg-aurora" aria-hidden />
      <SidebarProvider defaultOpen={false}>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="relative flex-1 flex flex-col min-w-0">
            <main className="flex-1 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster
        theme="system"
        position="bottom-right"
        toastOptions={{
          className: "glass iris-ring",
          style: {
            color: "var(--lg-fg)",
            borderRadius: "16px",
            padding: "14px 20px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
