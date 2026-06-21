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
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
  console.error(error);
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
      { title: "SDR Totum — Flow Builder" },
      {
        name: "description",
        content:
          "SDR Totum: construa fluxos visuais de automação de conversas no WhatsApp que parecem humanas.",
      },
      { property: "og:title", content: "SDR Totum — Flow Builder" },
      {
        property: "og:description",
        content: "Automação de conversas que parecem humanas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SDR Totum — Flow Builder" },
      { name: "description", content: "Build visual flows for WhatsApp conversation automation." },
      {
        property: "og:description",
        content: "Build visual flows for WhatsApp conversation automation.",
      },
      {
        name: "twitter:description",
        content: "Build visual flows for WhatsApp conversation automation.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f300d38b-0102-4421-ae66-2c5680b4f417/id-preview-2f7935b2--d1addaef-0e7f-4422-896f-8758325064f6.lovable.app-1781987730109.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f300d38b-0102-4421-ae66-2c5680b4f417/id-preview-2f7935b2--d1addaef-0e7f-4422-896f-8758325064f6.lovable.app-1781987730109.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://api.fontshare.com" },
      { rel: "preconnect", href: "https://cdn.fontshare.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://api.fontshare.com/v2/css?f[]=geomanist@300,400,500&display=swap",
      },
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
      <Outlet />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1b1728",
            color: "#fff",
            borderRadius: "16px",
            padding: "16px 24px",
            boxShadow: "inset 0 0 0 1px hsla(0,0%,100%,0.1)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
