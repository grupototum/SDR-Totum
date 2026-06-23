import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * /builder — layout. Contém:
 *  - /builder        → index com lista/cards dos flows
 *  - /builder/edit   → editor (Wizard|Builder do mesmo flow)
 */
export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Flow Builder — SDR Totum" },
      {
        name: "description",
        content:
          "Construa o roteiro do SDR Totum em dois modos (Wizard guiado ou Builder visual de estágios v2).",
      },
    ],
  }),
  component: () => <Outlet />,
});
