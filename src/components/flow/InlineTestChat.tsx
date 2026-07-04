/**
 * InlineTestChat — teste de UMA conversa do flow ABERTO no canvas.
 *
 * Compartilha o flow-store (exporta o envelope atual via exportToJSON) e POSTa
 * em /api/sim/turn (api.simTurn → proxy same-origin /api/engine/api/sim/turn),
 * com fallback no mock local quando o motor está indisponível.
 *
 * NÃO é o laboratório: a bateria/scorecard continua sendo o /simulator.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFlowStore } from "@/stores/flow-store";
import { simTurnWithFallback, engineErrorOf } from "@/lib/sim-turn";
import type { SimMessage, SimTurnResponse } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import {
  X,
  Send,
  BotMessageSquare,
  User,
  FlaskConical,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Turn = { lead: string; mock: boolean } & SimTurnResponse;

function tempColor(t: string) {
  if (t === "quente") return "#da2128";
  if (t === "morno") return "#f59e0b";
  if (t === "frio") return "#077ac7";
  return "#9ca3af";
}

export function InlineTestChat({ onClose }: { onClose: () => void }) {
  const exportToJSON = useFlowStore((s) => s.exportToJSON);
  const flowName = useFlowStore((s) => s.flowName);
  const entryNodeId = useFlowStore((s) => s.entryNodeId);
  // Selecionar o array estável e derivar (selector com .filter/.map cria nova
  // referência a cada render → loop de re-render no zustand).
  const storeVariables = useFlowStore((s) => s.variables);
  const requiredVars = useMemo(
    () => storeVariables.filter((v) => v.scope === "required").map((v) => v.key),
    [storeVariables],
  );

  const [variables, setVariables] = useState<Record<string, string>>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionState, setSessionState] = useState<Record<string, unknown>>({});
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Snapshot do envelope do flow aberto (sempre o estado atual do canvas).
  const activeFlow = useMemo(() => {
    try {
      return JSON.parse(exportToJSON()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [exportToJSON]);

  const currentStage = turns.length ? turns[turns.length - 1].stage_to : (entryNodeId ?? "");

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
    try {
      const res = await simTurnWithFallback({
        flow: activeFlow,
        variables,
        history,
        currentStage,
        sessionState,
      });
      const mock = res.raw?.mock === true;
      const engineErr = engineErrorOf(res);
      setTurns((t) => [...t, { lead: text, mock, ...res }]);
      setSessionState(res.sessionState);
      if (engineErr) toast.warning(`Motor inacessível (${engineErr}) — turno via MOCK`);
      else if (mock) toast.info("Turno via MOCK — não validado pelo motor real");
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

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex w-[420px] flex-col"
      style={{ background: "#0e0918", boxShadow: "-12px 0 40px rgba(0,0,0,0.5)" }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-[#e3433e]" />
          <div className="min-w-0">
            <div className="truncate text-sm text-white">Testar Flow</div>
            <div className="truncate text-[10px] text-[color:var(--color-text-muted)]">
              {flowName} · 1 conversa
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            className="rounded-full p-1.5 text-[color:var(--color-text-muted)] hover:bg-[#1f192a] hover:text-white"
            title="Reiniciar conversa"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[color:var(--color-text-muted)] hover:bg-[#1f192a] hover:text-white"
            title="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Nota: este é o teste rápido; a bateria/scorecard fica no /simulator */}
      <div
        className="flex items-center gap-1.5 px-4 py-2 text-[10px]"
        style={{ background: "rgba(160,111,246,0.1)", color: "#a06ff6" }}
      >
        <span>Teste de 1 conversa do flow aberto.</span>
        <Link
          to="/simulator"
          className="inline-flex items-center gap-1 font-medium hover:underline"
        >
          Bateria / scorecard → /simulator
        </Link>
      </div>

      {requiredVars.length > 0 && (
        <div
          className="flex flex-col gap-2 px-4 py-3"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Variáveis da persona ({requiredVars.length})
          </span>
          <div className="grid grid-cols-2 gap-2">
            {requiredVars.map((v) => (
              <input
                key={v}
                value={variables[v] ?? ""}
                onChange={(e) => setVariables((p) => ({ ...p, [v]: e.target.value }))}
                placeholder={v}
                className="rounded-md px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[#da2128]"
                style={{ background: "#1f192a" }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {turns.length === 0 && (
          <p className="mt-8 text-center text-sm text-[color:var(--color-text-muted)]">
            Digite como o lead para iniciar a conversa.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="flex flex-row-reverse gap-2">
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: "#432d33", color: "#ef9a9a" }}
              >
                <User className="size-3.5" />
              </div>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                style={{ background: "#1f192a", color: "#d1cece" }}
              >
                {t.lead}
              </div>
            </div>
            <div className="flex gap-2">
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: "#272333", color: "#9ca3af" }}
              >
                <BotMessageSquare className="size-3.5" />
              </div>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                style={{ background: "#1b1728", color: "#fff", boxShadow: "var(--shadow-card)" }}
              >
                {t.reply}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-[color:var(--color-text-muted)]">
                    {t.stage_from} → {t.stage_to}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-white"
                    style={{ background: tempColor(t.temperatura) }}
                  >
                    {t.temperatura} · {t.score}/10
                  </span>
                  {t.mock && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 uppercase tracking-wider"
                      style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                    >
                      <AlertTriangle className="size-2.5" /> mock
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

      <div className="flex gap-2 p-3" style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={activeFlow ? "Responder como lead (Enter)…" : "Flow inválido"}
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
    </div>
  );
}
