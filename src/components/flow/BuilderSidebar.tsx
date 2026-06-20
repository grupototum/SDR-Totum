import { useFlowStore } from "@/stores/flow-store";
import { TotumButton } from "@/components/ui/totum-button";
import { Search, Workflow, Plus } from "lucide-react";
import { toast } from "sonner";

const pesquisas = [
  { id: "p1", name: "SaaS B2B Brasil" },
  { id: "p2", name: "Agências de marketing" },
];
const flows = [
  { id: "f1", name: "Outbound frio · v1", active: true },
  { id: "f2", name: "Reativação 90d" },
];

export function BuilderSidebar() {
  return (
    <aside
      className="flex h-full w-[280px] shrink-0 flex-col gap-6 p-5"
      style={{
        background: "#1b1728",
        boxShadow: "inset -1px 0 0 0 hsla(0,0%,100%,0.06)",
      }}
    >
      <div>
        <h1 className="text-2xl" style={{ fontWeight: 300, letterSpacing: "-0.02em" }}>
          SDR <strong>TOTUM</strong>
        </h1>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Flow Builder
        </p>
      </div>

      <Section title="Pesquisas" icon={Search}>
        {pesquisas.map((p) => (
          <ListItem key={p.id}>{p.name}</ListItem>
        ))}
      </Section>

      <Section title="Flows" icon={Workflow}>
        {flows.map((f) => (
          <ListItem key={f.id} active={f.active}>
            {f.name}
          </ListItem>
        ))}
      </Section>

      <div className="mt-auto flex flex-col gap-2">
        <TotumButton
          variant="primary"
          size="sm"
          onClick={() => toast.info("Nova pesquisa em breve")}
        >
          <Plus className="size-3.5" /> Nova Pesquisa
        </TotumButton>
        <TotumButton
          variant="secondary"
          size="sm"
          onClick={() => toast.info("Novo flow em branco")}
        >
          <Plus className="size-3.5" /> Novo Flow
        </TotumButton>
      </div>
    </aside>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1 text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        <Icon className="size-3" />
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ListItem({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className="rounded-lg px-3 py-2 text-left text-sm transition-colors"
      style={{
        background: active ? "#272333" : "transparent",
        color: active ? "#fff" : "#d1cece",
      }}
    >
      {children}
    </button>
  );
}
