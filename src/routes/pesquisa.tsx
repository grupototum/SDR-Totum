import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * /pesquisa — layout. Contém:
 *  - /pesquisa            → index com lista/cards de ordens
 *  - /pesquisa/nova       → wizard de 6 passos para criar ordem
 *  - /pesquisa/historico  → alias da landing (compat)
 */
export const Route = createFileRoute("/pesquisa")({
  head: () => ({
    meta: [{ title: "Pesquisa — SDR Totum" }],
  }),
  component: () => <Outlet />,
});
