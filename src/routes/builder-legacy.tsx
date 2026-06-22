import { createFileRoute } from "@tanstack/react-router";
import { BuilderSidebar } from "@/components/flow/BuilderSidebar";
import { BuilderToolbar } from "@/components/flow/BuilderToolbar";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { PropertiesPanel } from "@/components/flow/PropertiesPanel";

/**
 * Builder legado v1 (grafo de 181 nós). Mantido para importar/visualizar o
 * formato antigo. O formato de trabalho primário é o v2 (estágios) em /builder.
 */
export const Route = createFileRoute("/builder-legacy")({
  head: () => ({
    meta: [
      { title: "Flow Builder (legado v1) — SDR Totum" },
      {
        name: "description",
        content: "Visualização do flow legado v1 (grafo de nós) do SDR Totum.",
      },
    ],
  }),
  component: BuilderLegacyPage,
});

function BuilderLegacyPage() {
  return (
    <div
      className="grid h-screen w-full overflow-hidden"
      style={{ gridTemplateColumns: "280px 1fr 320px" }}
    >
      <BuilderSidebar />
      <div className="flex h-full flex-col overflow-hidden">
        <BuilderToolbar />
        <div className="flex-1">
          <FlowCanvas />
        </div>
      </div>
      <PropertiesPanel />
    </div>
  );
}
