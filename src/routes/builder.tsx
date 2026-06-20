import { createFileRoute } from "@tanstack/react-router";
import { BuilderSidebar } from "@/components/flow/BuilderSidebar";
import { BuilderToolbar } from "@/components/flow/BuilderToolbar";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { PropertiesPanel } from "@/components/flow/PropertiesPanel";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Flow Builder — SDR Totum" },
      {
        name: "description",
        content:
          "Editor visual de flows do SDR Totum: arraste nodes, conecte conversas e publique automações humanizadas no WhatsApp.",
      },
      { property: "og:title", content: "SDR Totum · Flow Builder" },
      { property: "og:description", content: "Editor visual de flows para WhatsApp." },
    ],
  }),
  component: BuilderPage,
});

function BuilderPage() {
  return (
    <div className="grid h-screen w-screen overflow-hidden" style={{ gridTemplateColumns: "280px 1fr 320px" }}>
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
