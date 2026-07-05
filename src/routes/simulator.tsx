import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/api";
import type { SimMessage, SimTurnResponse } from "@/api";
import { httpApi } from "@/api/http";
import { mockSimTurn } from "@/lib/sim-turn";
import { type BatterySummary } from "@/lib/sim-harness";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FlaskConical,
  RotateCcw,
  Send,
  BotMessageSquare,
  User,
  Activity,
  AlertTriangle,
  RefreshCw,
  HeartPulse,
  Rocket,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

const ANALYSIS_KEY = "totum:simulator-analysis-collapsed";

async function simTurnWithFallback(payload: Parameters<typeof httpApi.simTurn>[0]) {
  try {
    return await httpApi.simTurn(payload);
  } catch {
    return mockSimTurn(payload);
  }
}

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Simulador — SDR Totum" },
      {
        name: "description",
        content: "Teste um flow do SDR Totum sem WhatsApp, conversando como lead.",
      },
    ],
  }),
  component: SimulatorPage,
});

const DRAFT = "__draft__";

type Turn = { lead: string; mock: boolean } & SimTurnResponse;

function tempColor(t: string) {
  if (t === "quente") return "#da2128";
  if (t === "morno") return "#f59e0b";
  if (t === "frio") return "#077ac7";
  return "#9ca3af";
}

function SimulatorPage() {
  const draftFlow = useFlowV2Store((s) => s.flow);
  const [source, setSource] = useState<string>(DRAFT);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionState, setSessionState] = useState<Record<string, unknown>>({});
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [battery, setBattery] = useState<BatterySummary | null>(null);
  const [batteryRunning, setBatteryRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [analysisCollapsed, setAnalysisCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ANALYSIS_KEY) === "1";
  });
  const toggleAnalysis = () => {
    setAnalysisCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined")
        window.localStorage.setItem(ANALYSIS_KEY, next ? "1" : "0");
      return next;
    });
  };

  const { data: flowList = [] } = useQuery({ queryKey: ["flows"], queryFn: () => api.listFlows() });

  const serverFlowQuery = useQuery({
    queryKey: ["flow", source],
    queryFn: () => api.getFlow(source),
    enabled: source !== DRAFT,
    staleTime: Infinity,
  });

  // Report de saúde do motor (GET /api/engine/api/sim/report) — proxy same-origin, fonte de GO.
  const reportQuery = useQuery({ queryKey: ["sim-report"], queryFn: () => httpApi.getSimReport() });
  const report = reportQuery.data;

  const activeFlow: Record<string, unknown> | null =
    source === DRAFT
      ? (draftFlow as unknown as Record<string, unknown> | null)
      : (serverFlowQuery.data ?? null);

  const requiredVars = useMemo(
    () =>
      Array.isArray(activeFlow?.required_variables)
        ? (activeFlow!.required_variables as string[])
        : [],
    [activeFlow],
  );
  const entryStage = String(activeFlow?.entry_stage ?? "");
  const currentStage = turns.length ? turns[turns.length - 1].stage_to : entryStage;

  // Garante uma chave por variável requerida (sem apagar valores já digitados).
  useEffect(() => {
    setVariables((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const v of requiredVars)
        if (!(v in next)) {
          next[v] = "";
          changed = true;
        }
      return changed ? next : prev;
    });
  }, [requiredVars]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pending]);

  async function send() {
    const text = input.trim();
    if (!text || !activeFlow || pending) return;
    setInput("");
    setPending(true);
    const history: SimMessage[] = turns.flatMap((t) => [
      { role: "lead" as const, text: t.lead },
      { role: "sdr" as const, text: t.reply },
    ]);
    history.push({ role: "lead", text });
    const payload = { flow: activeFlow, variables, history, currentStage, sessionState };
    try {
      const res: SimTurnResponse = await simTurnWithFallback(payload);
      const mock = res.raw.mock === true;
      setTurns((t) => [...t, { lead: text, mock, ...res }]);
      setSessionState(res.sessionState); // encadeia o estado pro próximo turno
      if (mock) toast.info("Turno via MOCK — não validado pelo motor real");
    } catch (e) {
      toast.error(`Erro no turno: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setTurns([]);
    setSessionState({});
    setInput("");
  }

  async function publicarFlow() {
    if (!activeFlow || publishing) return;
    setPublishing(true);
    try {
      let id = source === DRAFT ? null : source;
      if (!id) {
        const created = await api.createFlow(activeFlow);
        id = created.id;
      }
      await api.publishFlow(id);
      setPublishedId(id);
      toast.success(`Flow publicado e ativo: ${id}`);
    } catch (e) {
      toast.error(`Erro ao publicar: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function rodarBateria() {
    if (!activeFlow || batteryRunning) return;
    setBatteryRunning(true);
    try {
      // Bateria roda no MOTOR V3 (/api/sim/run): personas reais do motor, sem
      // harness local. Erro = toast — nada de cair no mock em silêncio.
      const [status, res] = await Promise.all([
        api.getSimV3Status().catch(() => null),
        api.runSimulationV3({ flow: activeFlow }),
      ]);
      const mock = !(status?.realLlmConfigured ?? false);
      const results = res.results.map((r) => ({
        persona: r.label,
        booked: r.status === "ganho",
        guardrail_violation: !r.passed,
        turns: r.trocas,
        finalStage: r.stage,
        // passed = expectativas da persona cumpridas sem violação (a secretária
        // "passa" pelo bloco áudio, não por booking).
        healthy: r.passed,
        mock,
      }));
      const healthy = results.filter((r) => r.healthy).length;
      const summary: BatterySummary = {
        results,
        total: results.length,
        healthy,
        healthRate: results.length ? healthy / results.length : 0,
        mock,
      };
      setBattery(summary);
      toast.success(`Bateria: ${Math.round(summary.healthRate * 100)}% saudável`);
    } catch (e) {
      toast.error(`Erro na bateria: ${(e as Error).message}`);
    } finally {
      setBatteryRunning(false);
    }
  }

  return (
    <div
      className="grid h-screen w-full overflow-hidden"
      style={{
        gridTemplateColumns: [
          leftOpen ? "340px" : "0px",
          "1fr",
          rightOpen ? (analysisCollapsed ? "44px" : "360px") : "0px",
        ].join(" "),
        transition: "grid-template-columns 200ms ease",
      }}
    >
      {/* ── Esquerda: flow + persona ── */}
      <aside
        className="flex flex-col overflow-y-auto"
        style={{
          background: "var(--color-card-totum)",
          boxShadow: "inset -1px 0 0 0 #1f192a",
          display: leftOpen ? undefined : "none",
        }}
      >
        <div
          className="flex flex-col gap-0.5 px-5 py-4"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-[#e3433e]" />
            <h1 className="text-sm text-white">Simulador — laboratório (sem WhatsApp)</h1>
          </div>
          <p className="text-[10px] text-[color:var(--color-text-muted)]">
            Bateria de personas + scorecard de saúde (fonte de GO). Para testar 1 conversa do flow
            aberto, use "Testar Flow" no builder.
          </p>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[color:var(--color-text-muted)]">Flow</Label>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                reset();
              }}
              className="h-9 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#1f192a] px-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
            >
              <option value={DRAFT}>Flow do builder (rascunho){draftFlow ? "" : " — vazio"}</option>
              {flowList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.id})
                </option>
              ))}
            </select>
            {!activeFlow && (
              <p className="text-[11px] text-[#f59e0b]">
                {source === DRAFT
                  ? "Abra um flow no /builder primeiro, ou escolha um flow salvo."
                  : "Carregando flow…"}
              </p>
            )}
            {activeFlow && (
              <p className="text-[11px] text-[color:var(--color-text-muted)]">
                {String(activeFlow.name ?? activeFlow.flow_id ?? "flow")} · entry:{" "}
                {entryStage || "—"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-[color:var(--color-text-muted)]">
              Variáveis da persona ({requiredVars.length})
            </Label>
            {requiredVars.length === 0 && (
              <p className="text-[11px] text-[color:var(--color-text-muted)]">
                Este flow não declara required_variables.
              </p>
            )}
            {requiredVars.map((v) => (
              <div key={v} className="flex flex-col gap-1">
                <span className="text-[10px] text-[color:var(--color-text-muted)]">{v}</span>
                <Input
                  value={variables[v] ?? ""}
                  onChange={(e) => setVariables((p) => ({ ...p, [v]: e.target.value }))}
                  placeholder={v}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <TotumButton variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" /> Reset
            </TotumButton>
            <TotumButton
              variant="primary"
              size="sm"
              onClick={rodarBateria}
              disabled={!activeFlow || batteryRunning}
            >
              <Activity className="size-3.5" />
              {batteryRunning ? "Rodando…" : "Rodar bateria"}
            </TotumButton>
          </div>

          {/* ── Publicar / Ativar flow ── */}
          <div
            className="flex flex-col gap-2 rounded-xl p-3"
            style={{ background: "rgba(218,33,40,0.08)", border: "1px solid rgba(218,33,40,0.25)" }}
          >
            <p className="text-[11px] font-medium text-[#e3433e]">Ativar em produção</p>

            {!confirmingPublish ? (
              <>
                <p className="text-[10px] text-[color:var(--color-text-muted)]">
                  Publica o flow como roteiro ativo do motor (autosend ligado).
                </p>
                {publishedId && (
                  <p className="text-[10px] text-[#35a670]">✓ Publicado: {publishedId}</p>
                )}
                <TotumButton
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingPublish(true)}
                  disabled={!activeFlow}
                  style={{ borderColor: "#da2128", color: "#e3433e" }}
                >
                  <Rocket className="size-3.5" />
                  Publicar / Ativar este flow…
                </TotumButton>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#e3433e]">
                  ⚠️ Ativar em PRODUÇÃO com autosend
                </p>
                <p className="text-[10px] text-[color:var(--color-text-muted)]">
                  O motor começa a usar este flow imediatamente em conversas reais.
                </p>
                {/* Saúde do flow antes de confirmar */}
                {(battery || report) && (
                  <div
                    className="rounded-lg px-2 py-1.5 text-[10px]"
                    style={{ background: "#0e0918" }}
                  >
                    {battery && (
                      <span
                        style={{
                          color:
                            battery.healthRate >= 0.75
                              ? "#35a670"
                              : battery.healthRate >= 0.5
                                ? "#f59e0b"
                                : "#da2128",
                        }}
                      >
                        Bateria (motor V3): {Math.round(battery.healthRate * 100)}% (
                        {battery.healthy}/{battery.total}){battery.mock && " · mock"}
                      </span>
                    )}
                    {report && (
                      <span
                        className={battery ? " · " : ""}
                        style={{
                          color:
                            report.healthRate >= 0.75
                              ? "#35a670"
                              : report.healthRate >= 0.5
                                ? "#f59e0b"
                                : "#da2128",
                        }}
                      >
                        Motor: {Math.round(report.healthRate * 100)}%{report.mock && " · mock"}
                      </span>
                    )}
                  </div>
                )}
                {!battery && !report && (
                  <p className="text-[10px] text-[#f59e0b]">
                    Rode a bateria acima para ver a saúde antes de confirmar.
                  </p>
                )}
                <div className="flex gap-2">
                  <TotumButton
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingPublish(false)}
                    disabled={publishing}
                  >
                    Cancelar
                  </TotumButton>
                  <TotumButton
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      setConfirmingPublish(false);
                      await publicarFlow();
                    }}
                    disabled={publishing}
                    style={{ background: "#da2128", borderColor: "#da2128" }}
                  >
                    <Rocket className="size-3.5" />
                    {publishing ? "Publicando…" : "Confirmar — ativar"}
                  </TotumButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Centro: chat ── */}
      <main className="flex flex-col overflow-hidden" style={{ background: "#0e0918" }}>
        {/* Barra superior com botões retrair */}
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          <button
            onClick={() => setLeftOpen((v) => !v)}
            className="text-[color:var(--color-text-muted)] hover:text-white"
            title={leftOpen ? "Retrair painel esquerdo" : "Expandir painel esquerdo"}
          >
            {leftOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="text-[color:var(--color-text-muted)] hover:text-white"
            title={rightOpen ? "Retrair painel direito" : "Expandir painel direito"}
          >
            {rightOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </button>
        </div>
        {/* Report do motor (GET /api/engine/api/sim/report) — saúde da bateria / fonte de GO */}
        {report && (
          <div
            className="flex items-center justify-between gap-4 px-5 py-3"
            style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
          >
            <div className="flex items-center gap-3">
              <HeartPulse className="size-4 text-[#e3433e]" />
              <span className="text-xs text-[color:var(--color-text-muted)]">
                Report do motor (GO)
              </span>
              <span
                className="text-2xl"
                style={{
                  color:
                    report.healthRate >= 0.75
                      ? "#35a670"
                      : report.healthRate >= 0.5
                        ? "#f59e0b"
                        : "#da2128",
                }}
              >
                {Math.round(report.healthRate * 100)}%
              </span>
              <span className="text-xs text-[color:var(--color-text-muted)]">
                {report.healthy}/{report.total} booked sem violar guard-rail
              </span>
              {report.mock && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                  title="Report veio do mock — não vale como baseline de GO"
                >
                  <AlertTriangle className="size-3" /> mock · não vale p/ GO
                </span>
              )}
            </div>
            <button
              onClick={() => reportQuery.refetch()}
              disabled={reportQuery.isFetching}
              className="text-[color:var(--color-text-muted)] hover:text-white disabled:opacity-50"
              title="Recarregar report"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        )}
        {turns.some((t) => t.mock) && (
          <div
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium"
            style={{
              background: "rgba(245,158,11,0.15)",
              color: "#f59e0b",
              boxShadow: "inset 0 -1px 0 0 rgba(245,158,11,0.3)",
            }}
          >
            <AlertTriangle className="size-3.5" />
            MODO MOCK — não validado pelo motor real
          </div>
        )}
        {battery && (
          <div
            className="flex items-center justify-between gap-4 px-5 py-3"
            style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-[color:var(--color-text-muted)]">Saúde do flow</span>
              <span
                className="text-2xl"
                style={{
                  color:
                    battery.healthRate >= 0.75
                      ? "#35a670"
                      : battery.healthRate >= 0.5
                        ? "#f59e0b"
                        : "#da2128",
                }}
              >
                {Math.round(battery.healthRate * 100)}%
              </span>
              <span className="text-xs text-[color:var(--color-text-muted)]">
                {battery.healthy}/{battery.total} personas OK sem violar guard-rail
              </span>
              {battery.mock && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                  title="Bateria rodou no mock — não vale como baseline de GO"
                >
                  <AlertTriangle className="size-3" /> mock · não vale p/ GO
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {battery.results.map((r) => (
                <span
                  key={r.persona}
                  title={`${r.persona}: ${r.turns} turnos → ${r.finalStage}${r.booked ? " · booked" : ""}${r.guardrail_violation ? " · guard-rail!" : ""}`}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: r.healthy ? "rgba(53,166,112,0.18)" : "rgba(218,33,40,0.15)",
                    color: r.healthy ? "#35a670" : "#ef9a9a",
                  }}
                >
                  {r.persona}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {turns.length === 0 && (
            <p className="mt-10 text-center text-sm text-[color:var(--color-text-muted)]">
              Digite como o lead para iniciar a conversa.
            </p>
          )}
          {turns.map((t, i) => (
            <div key={i} className="space-y-3">
              {/* lead (direita) */}
              <div className="flex flex-row-reverse gap-2">
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "#432d33", color: "#ef9a9a" }}
                >
                  <User className="size-3.5" />
                </div>
                <div
                  className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                  style={{ background: "#1f192a", color: "#d1cece" }}
                >
                  {t.lead}
                </div>
              </div>
              {/* sdr (esquerda) */}
              <div className="flex gap-2">
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "#272333", color: "#9ca3af" }}
                >
                  <BotMessageSquare className="size-3.5" />
                </div>
                <div
                  className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                  style={{ background: "#1b1728", color: "#fff", boxShadow: "var(--shadow-card)" }}
                >
                  {t.reply}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[color:var(--color-text-muted)]">
                    <span>
                      {t.stage_from} → {t.stage_to}
                    </span>
                    {t.mock && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                        style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                      >
                        mock
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex gap-2">
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: "#272333" }}
              >
                <BotMessageSquare className="size-3.5 text-[#9ca3af]" />
              </div>
              <div
                className="rounded-2xl px-3 py-2 text-sm text-[color:var(--color-text-muted)]"
                style={{ background: "#1b1728" }}
              >
                digitando…
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="flex gap-2 p-4" style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={activeFlow ? "Responder como lead (Enter)…" : "Selecione um flow primeiro"}
            disabled={!activeFlow || pending}
            className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128] disabled:opacity-50"
            style={{ background: "#1f192a" }}
          />
          <TotumButton
            variant="primary"
            size="sm"
            onClick={send}
            disabled={!activeFlow || pending || !input.trim()}
          >
            <Send className="size-3.5" />
          </TotumButton>
        </div>
      </main>

      {/* ── Direita: painel por turno (colapsável) ── */}
      <aside
        className="flex flex-col overflow-y-auto"
        style={{
          background: "var(--color-card-totum)",
          boxShadow: "inset 1px 0 0 0 #1f192a",
          display: rightOpen ? undefined : "none",
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-3 text-sm text-white"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          {!analysisCollapsed && <span className="px-2">Análise por turno ({turns.length})</span>}
          <button
            onClick={toggleAnalysis}
            className="ml-auto flex size-8 items-center justify-center rounded-full text-[color:var(--color-text-muted)] hover:bg-[#1f192a] hover:text-white"
            title={analysisCollapsed ? "Expandir análise" : "Recolher análise"}
            aria-label={analysisCollapsed ? "Expandir análise" : "Recolher análise"}
          >
            {analysisCollapsed ? (
              <PanelRightOpen className="size-4" />
            ) : (
              <PanelRightClose className="size-4" />
            )}
          </button>
        </div>
        {!analysisCollapsed && (
          <div className="flex flex-col gap-3 p-4">
            {turns.length === 0 && (
              <p className="text-[11px] text-[color:var(--color-text-muted)]">
                Cada turno mostra a transição de estágio, temperatura, score, flags e o JSON cru.
              </p>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl p-3"
                style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-white">
                    Turno {i + 1}
                    {t.mock && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                        style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                      >
                        mock
                      </span>
                    )}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] text-white"
                    style={{ background: tempColor(t.temperatura) }}
                  >
                    {t.temperatura} · {t.score}/10
                  </span>
                </div>
                <div className="text-[11px] text-[color:var(--color-text-muted)]">
                  <span className="text-white">{t.stage_from}</span> →{" "}
                  <span className="text-white">{t.stage_to}</span>
                  <span className="ml-2">objeções: {t.objecao_count}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["send_preview", "booked", "precisa_humano", "done"] as const).map((f) => (
                    <span
                      key={f}
                      className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider"
                      style={{
                        background: t.flags[f] ? "rgba(53,166,112,0.18)" : "#1f192a",
                        color: t.flags[f] ? "#35a670" : "#9ca3af",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <details>
                  <summary className="cursor-pointer text-[10px] text-[color:var(--color-text-muted)] hover:text-white">
                    JSON cru
                  </summary>
                  <pre
                    className="mt-1 max-h-48 overflow-auto rounded-lg p-2 text-[10px] leading-relaxed text-[#d1cece]"
                    style={{ background: "#0e0918", fontFamily: "ui-monospace, Menlo, monospace" }}
                  >
                    {JSON.stringify(t.raw, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
