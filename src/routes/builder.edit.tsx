/**
 * builder.edit.tsx — editor de flow com 2 modos: Wizard | Canvas.
 *
 * URL: /builder/edit?flow=<id>
 *   - Com ?flow=<id>: carrega o flow da API e abre no modo selecionado.
 *   - Sem parâmetro (ou id inválido / payload não-v2): usa o rascunho do
 *     store, ou o default como rascunho inicial.
 *
 * Esta rota é a ÚNICA dona do modo de autoria (chave totum:authoring-mode,
 * fallback "canvas") e do carregamento remoto do flow. A V2Toolbar (nome,
 * Salvar, Publicar, Importar, Exportar, Simular e o toggle Wizard|Canvas)
 * fica acima dos dois modos — persistir pela toolbar salva exatamente o
 * estado atual do flow-v2-store, em qualquer modo.
 *
 * Automações/n8n saíram da navegação do editor — o painel foi preservado em
 * src/components/flows/AutomacoesPanel.tsx (destino definido na Entrega 2).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { isFlowV2, type V1LegacySummary } from "@/lib/flow-v2";
import {
  V2Builder,
  V2Toolbar,
  SimulationOverlay,
  LegacyOverlay,
  type AuthoringMode,
} from "@/components/flow-v2/V2Builder";
import { WizardMode } from "@/components/flow-v2/WizardMode";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import flowV2Default from "../../docs/flow_odonto_stages_v2.json";
import type { FlowV2 } from "@/lib/flow-v2";

const AUTHORING_MODE_KEY = "totum:authoring-mode";

export const Route = createFileRoute("/builder/edit")({
  head: () => ({
    meta: [{ title: "Editar Flow — SDR Totum" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === "string" ? s.flow : undefined,
  }),
  component: BuilderEditPage,
});

function BuilderEditPage() {
  const { flow: flowId } = Route.useSearch();
  const [mode, setModeState] = useState<AuthoringMode>(() => {
    if (typeof window === "undefined") return "canvas";
    const saved = window.localStorage.getItem(AUTHORING_MODE_KEY);
    // Valores antigos ("builder", "automacoes") caem no default.
    return saved === "wizard" || saved === "canvas" ? saved : "canvas";
  });
  const setMode = (m: AuthoringMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(AUTHORING_MODE_KEY, m);
  };

  const [legacy, setLegacy] = useState<V1LegacySummary | null>(null);
  const [simOpen, setSimOpen] = useState(false);

  const setFlow = useFlowV2Store((s) => s.setFlow);
  const setCurrentFlow = useFlowV2Store((s) => s.setCurrentFlow);
  const storeFlow = useFlowV2Store((s) => s.flow);

  // Carrega o flow da API pelo ?flow=<id> — única fonte de carregamento remoto.
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

  // Store vazio → rascunho default imediato (mesmo comportamento do V2Builder
  // antigo). Se houver ?flow=, o resultado remoto sobrescreve quando chegar;
  // erro/payload não-v2 mantém o rascunho e mostra o aviso.
  useEffect(() => {
    if (!storeFlow) {
      setFlow(flowV2Default as unknown as FlowV2);
    }
  }, [storeFlow, setFlow]);

  const loading = flowId && flowQuery.isLoading;

  if (!storeFlow || loading) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-[color:var(--color-text-muted)]"
        style={{ background: "#0e0918" }}
      >
        Carregando flow…
        <Link to="/builder" className="flex items-center gap-1 hover:text-white">
          <ArrowLeft className="size-3.5" /> Voltar aos fluxos
        </Link>
      </div>
    );
  }

  // Aviso persistente: erro HTTP ou payload que não é flow v2 (stages).
  const loadFailed =
    !!flowId && (flowQuery.isError || (flowQuery.data ? !isFlowV2(flowQuery.data) : false));

  return (
    <div
      className="flex w-full flex-col overflow-hidden"
      style={{ background: "#0e0918", height: "100vh" }}
    >
      <V2Toolbar
        mode={mode}
        setMode={setMode}
        onLegacy={setLegacy}
        onSimulate={() => setSimOpen(true)}
      />

      {loadFailed && (
        <div
          className="flex shrink-0 items-center gap-1.5 px-5 py-1.5 text-[11px]"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
        >
          <AlertTriangle className="size-3" />
          Erro ao carregar flow — usando rascunho local
        </div>
      )}

      {mode === "wizard" && <WizardMode />}
      {mode === "canvas" && <V2Builder />}

      {legacy && <LegacyOverlay summary={legacy} onClose={() => setLegacy(null)} />}
      {simOpen && <SimulationOverlay onClose={() => setSimOpen(false)} />}
    </div>
  );
}
