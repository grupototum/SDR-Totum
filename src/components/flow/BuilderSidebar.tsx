import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useFlowStore } from "@/stores/flow-store";
import { api, type FlowSummary } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import { Search, Workflow, Plus, Copy, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";

type BuilderSidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};


export function BuilderSidebar() {
  const navigate = useNavigate();
  const loadFlow = useFlowStore((s) => s.loadFlow);
  const resetFlow = useFlowStore((s) => s.resetFlow);
  const currentFlowId = useFlowStore((s) => s.currentFlowId);
  const qc = useQueryClient();

  const {
    data: flows = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      const src = await api.getFlow(id);
      const copy = { ...src, name: `${String(src.name ?? id)} (cópia)`, active: false };
      const { id: newId } = await api.createFlow(copy);
      return newId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Flow duplicado");
    },
    onError: (e) => toast.error(`Erro ao duplicar: ${(e as Error).message}`),
  });

  // Erro = toast, nunca tela branca (a aside renderiza estado vazio).
  useEffect(() => {
    if (isError) toast.error(`Erro ao listar flows: ${(error as Error).message}`);
  }, [isError, error]);

  async function openFlow(f: FlowSummary) {
    try {
      const env = await api.getFlow(f.id);
      loadFlow(JSON.stringify(env), { id: f.id, active: f.active });
      toast.success(`Flow "${f.name}" carregado`);
    } catch (e) {
      toast.error(`Erro ao carregar flow: ${(e as Error).message}`);
    }
  }

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
        <Link
          to="/pesquisa"
          className="rounded-lg px-3 py-2 text-left text-sm text-[color:var(--color-text-body)] transition-colors hover:bg-[#272333]"
        >
          Ver histórico de pesquisas
        </Link>
      </Section>

      <Section title="Flows" icon={Workflow}>
        {isLoading && (
          <span className="px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
            Carregando…
          </span>
        )}
        {!isLoading && flows.length === 0 && (
          <span className="px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
            {isError ? "Indisponível — tente novamente" : "Nenhum flow ainda"}
          </span>
        )}
        {flows.map((f) => (
          <div
            key={f.id}
            className="group flex items-center gap-1 rounded-lg pr-1 transition-colors"
            style={{ background: currentFlowId === f.id ? "#272333" : "transparent" }}
          >
            <button
              onClick={() => openFlow(f)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
              style={{ color: currentFlowId === f.id ? "#fff" : "#d1cece" }}
              title={f.active ? "Publicado (roteiro do motor)" : "Rascunho"}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: f.active ? "#35a670" : "#3a3447" }}
              />
              <span className="truncate">{f.name}</span>
            </button>
            <button
              onClick={() => duplicateMut.mutate(f.id)}
              disabled={duplicateMut.isPending}
              className="shrink-0 rounded-md p-1.5 text-[color:var(--color-text-muted)] opacity-0 transition-opacity hover:bg-[#1f192a] hover:text-white group-hover:opacity-100 disabled:opacity-50"
              title="Duplicar flow"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        ))}
      </Section>

      <div className="mt-auto flex flex-col gap-2">
        <TotumButton variant="primary" size="sm" onClick={() => navigate({ to: "/pesquisa" })}>
          <Plus className="size-3.5" /> Nova Pesquisa
        </TotumButton>
        <TotumButton
          variant="secondary"
          size="sm"
          onClick={() => {
            resetFlow();
            toast.success("Novo flow em branco");
          }}
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
