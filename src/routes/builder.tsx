import { createFileRoute } from "@tanstack/react-router";
import { V2Builder } from "@/components/flow-v2/V2Builder";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Flow Builder — SDR Totum" },
      {
        name: "description",
        content:
          "Editor de estágios (schema v2) do SDR Totum: edite estágios, interrupções e configurações globais e publique o roteiro do motor.",
      },
      { property: "og:title", content: "SDR Totum · Flow Builder (estágios v2)" },
      { property: "og:description", content: "Editor de estágios para WhatsApp." },
    ],
  }),
  component: BuilderPage,
});

function BuilderPage() {
  return <V2Builder />;
}
