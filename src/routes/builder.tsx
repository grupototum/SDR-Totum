import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Flow Builder — SDR Totum" },
      {
        name: "description",
        content: "Editor de estágios (schema v2) do SDR Totum.",
      },
    ],
  }),
  component: () => <Outlet />,
});
