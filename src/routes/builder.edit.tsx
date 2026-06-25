/**
 * builder.edit.tsx — editor de flow com 3 modos: Wizard | Builder | Automações.
 *
 * URL: /builder/edit?flow=<id>
 *   - Com ?flow=<id>: carrega o flow da API e abre no modo selecionado.
 *   - Sem parâmetro: usa o rascunho do store (ou o default).
 *
 * FRONTEIRA OBRIGATÓRIA — modo Automações é NAVEGAÇÃO unificada, não funcional:
 *   - Motor (flow stages) e n8n (workflows) têm storage e endpoints SEPARADOS.
 *   - Publicar o flow NÃO publica workflows n8n.
 *   - Badge fixo na aba: "n8n é independente".
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { N8nWorkflow } from "@/api";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { isFlowV2 } from "@/lib/flow-v2";
import { V2Builder } from "@/components/flow-v2/V2Builder";
import { WizardMode } from "@/components/flow-v2/WizardMode";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ChevronLeft,
  Wand2,
  Layers,
  Webhook,
  Power,
  PowerOff,
  Save,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import flowV2Default from "../../docs/flow_odonto_stages_v2.json";

type BuilderMode = "wizard" | "builder" | "automacoes";

const MODE_TABS: { id: BuilderMode; label: string; icon: React.ReactNode }[] = [
  { id: "wizard", label: "Wizard", icon: <Wand2 className="size-3.5" /> },
  { id: "builder", label: "Builder", icon: <Layers className="size-3.5" /> },
  { id: "automacoes", label: "Automações", icon: <Webhook className="size-3.5" /> },
];

export const Route = createFileRoute("/builder/edit")({
  head: () => ({
    meta: [{ title: "Editar Flow — SDR Totum" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === "string" ? s.flow : undefined,
  }),
  component: BuilderEditPage,
});

// ── Painel Automações (n8n) ─────────────────────────────────────────────────

const PUT_KEYS = ["name", "nodes", "connections", "settings", "staticData"] as const;

function toPutPayload(wf: N8nWorkflow, name: string): N8nWorkflow {
  const out: N8nWorkflow = {};
  for (const k of PUT_KEYS) if (k in wf) out[k] = wf[k];
  out.name = name;
  return out;
}

function N8nDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: wf, isLoading } = useQuery({
    queryKey: ["n8n-workflow", id],
    queryFn: () => api.getN8nWorkflow(id),
  });
  const [name, setName] = useState<string | null>(null);
  const effectiveName = name ?? (wf ? String(wf.name ?? "") : "");
  const active = Boolean(wf?.active);

  const saveName = useMutation({
    mutationFn: () => api.updateN8nWorkflow(id, toPutPayload(wf as N8nWorkflow, effectiveName)),
    onSuccess: () => {
      toast.success("Workflow salvo");
      setName(null);
      qc.invalidateQueries({ queryKey: ["n8n-workflow", id] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleActive = useMutation({
    mutationFn: (next: boolean) => api.setN8nWorkflowActive(id, next),
    onSuccess: (_d, next) => {
      toast.success(next ? "Ativado" : "Desativado");
      qc.invalidateQueries({ queryKey: ["n8n-workflow", id] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !wf)
    return <div className="p-6 text-sm text-[color:var(--color-text-muted)]">Carregando…</div>;

  const dirty = name !== null && name !== String(wf.name ?? "");
  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-[color:var(--color-text-muted)]">Nome</label>
        <div className="flex gap-2">
          <Input value={effectiveName} onChange={(e) => setName(e.target.value)} />
          <TotumButton
            variant="primary"
            size="sm"
            onClick={() => saveName.mutate()}
            disabled={!dirty || saveName.isPending}
          >
            <Save className="size-3.5" /> Salvar
          </TotumButton>
        </div>
      </div>
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: "#1f192a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          {active ? (
            <Power className="size-4 text-[#35a670]" />
          ) : (
            <PowerOff className="size-4 text-[color:var(--color-text-muted)]" />
          )}
          <span className="text-sm text-white">{active ? "Ativo" : "Inativo"}</span>
        </div>
        <Switch
          checked={active}
          disabled={toggleActive.isPending}
          onCheckedChange={(v) => toggleActive.mutate(v)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-[color:var(--color-text-muted)]">JSON (read-only)</label>
          <span className="text-[10px] text-[color:var(--color-text-muted)]">id: {id}</span>
        </div>
        <pre
          className="max-h-[50vh] overflow-auto rounded-xl p-4 text-xs leading-relaxed text-[#d1cece]"
          style={{
            background: "#0e0918",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            fontFamily: "ui-monospace, Menlo, monospace",
          }}
        >
          {JSON.stringify(wf, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function AutomacoesPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    data: list = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["n8n-workflows"],
    queryFn: () => api.listN8nWorkflows(),
  });

  return (
    <div className="flex" style={{ height: "calc(100vh - 96px)" }}>
      {/* Lista */}
      <div
        className="w-72 shrink-0 flex flex-col overflow-hidden"
        style={{ boxShadow: "inset -1px 0 0 0 #1f192a" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          <span className="text-sm text-white">Workflows</span>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["n8n-workflows"] })}
            className="text-[color:var(--color-text-muted)] hover:text-white"
            title="Recarregar"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="px-4 py-4 text-sm text-[color:var(--color-text-muted)]">Carregando…</p>
          )}
          {isError && (
            <p className="px-4 py-4 text-sm text-[#d91616]">
              {(error as Error)?.message ?? "Falha ao listar"}
            </p>
          )}
          {!isLoading && !isError && list.length === 0 && (
            <p className="px-4 py-4 text-sm text-[color:var(--color-text-muted)]">
              Nenhum workflow.
            </p>
          )}
          {list.map((w) => {
            const selected = w.id === selectedId;
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors"
                style={{
                  background: selected ? "#1f192a" : "transparent",
                  boxShadow: "inset 0 -1px 0 0 rgba(255,255,255,0.04)",
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{w.name}</p>
                  <p className="truncate text-[10px] text-[color:var(--color-text-muted)]">
                    {w.id}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: w.active ? "rgba(53,166,112,0.15)" : "#272333",
                    color: w.active ? "#35a670" : "#9ca3af",
                  }}
                >
                  {w.active ? "ativo" : "inativo"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe */}
      <div className="flex-1 overflow-y-auto">
        {selectedId ? (
          <N8nDetail id={selectedId} key={selectedId} />
        ) : (
          <div className="flex h-full items-center justify-center text-center px-6">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Selecione um workflow para ver o JSON e editar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

function BuilderEditPage() {
  const navigate = useNavigate();
  const { flow: flowId } = Route.useSearch();
  const [mode, setMode] = useState<BuilderMode>("builder");

  const setFlow = useFlowV2Store((s) => s.setFlow);
  const setCurrentFlow = useFlowV2Store((s) => s.setCurrentFlow);
  const storeFlow = useFlowV2Store((s) => s.flow);

  // Carrega o flow da API pelo ?flow=<id>
  const flowQuery = useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => api.getFlow(flowId!),
    enabled: !!flowId,
  });

  useEffect(() => {
    if (flowId && flowQuery.data) {
      const data = flowQuery.data;
      if (isFlowV2(data)) {
        setFlow(data);
        setCurrentFlow(flowId);
      } else {
        toast.error("Flow carregado não é v2 (stages).");
      }
    }
  }, [flowId, flowQuery.data, setFlow, setCurrentFlow]);

  // Sem flow no store e sem ?flow=, carrega o default
  useEffect(() => {
    if (!flowId && !storeFlow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFlow(flowV2Default as any);
    }
  }, [flowId, storeFlow, setFlow]);

  const loading = flowId && flowQuery.isLoading;

  return (
    <div className="flex flex-col" style={{ background: "#0e0918", height: "100vh" }}>
      {/* ── Toolbar de modo ── */}
      <div
        className="flex h-10 shrink-0 items-center justify-between px-4"
        style={{ boxShadow: "inset 0 -1px 0 0 #1f192a", background: "rgba(27,23,40,0.9)" }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate({ to: "/builder" })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[color:var(--color-text-muted)] hover:text-white transition-colors"
            title="Voltar aos flows"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <div className="flex gap-0.5 rounded-full p-0.5" style={{ background: "#1f192a" }}>
            {MODE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  mode === tab.id
                    ? "text-white"
                    : "text-[color:var(--color-text-muted)] hover:text-white",
                )}
                style={
                  mode === tab.id
                    ? { background: tab.id === "automacoes" ? "#2a1f3d" : "#da2128" }
                    : undefined
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Badge independência n8n — visível só na aba Automações */}
        {mode === "automacoes" && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px]"
            style={{ background: "rgba(160,111,246,0.12)", color: "#a06ff6" }}
          >
            <Info className="size-3" />
            n8n é independente — publicar o flow não publica os workflows
          </div>
        )}

        {/* Aviso MOCK quando modo wizard ou builder */}
        {mode !== "automacoes" && flowId && flowQuery.isError && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px]"
            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
          >
            <AlertTriangle className="size-3" />
            Erro ao carregar flow — usando rascunho local
          </div>
        )}
      </div>

      {/* ── Conteúdo do modo ── */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[color:var(--color-text-muted)]">
          Carregando flow…
        </div>
      ) : (
        <>
          {mode === "wizard" && <WizardMode />}
          {mode === "builder" && <V2Builder />}
          {mode === "automacoes" && <AutomacoesPanel />}
        </>
      )}
    </div>
  );
}
