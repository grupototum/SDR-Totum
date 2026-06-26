import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Workflow } from "lucide-react";
import { TotumButton } from "@/components/ui/totum-button";
import { FlowsList } from "@/components/flows/FlowsList";

export const Route = createFileRoute("/builder/")({
  head: () => ({
    meta: [{ title: "Flows — SDR Totum" }],
  }),
  component: BuilderIndexPage,
});

function BuilderIndexPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ background: "#0e0918" }}>
      <header
        className="sticky top-0 z-10 flex h-14 items-center justify-between px-6"
        style={{
          background: "rgba(27,23,40,0.85)",
          backdropFilter: "blur(24px)",
          boxShadow: "inset 0 -1px 0 0 #1f192a",
        }}
      >
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-[#e3433e]" />
          <span className="text-sm text-white">Flows</span>
        </div>
        <TotumButton
          variant="primary"
          size="sm"
          onClick={() => navigate({ to: "/builder/edit", search: { flow: undefined } })}
        >
          <Plus className="size-3.5" /> Novo flow
        </TotumButton>
      </header>
      <section className="p-6">
        <FlowsList />
      </section>
    </div>
  );
}
