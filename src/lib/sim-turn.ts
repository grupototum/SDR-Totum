/**
 * sim-turn.ts — motor de simulação local (sem WhatsApp).
 *
 * Avança um flow v2 (estágios) de forma determinística para testar a conversa
 * sem o motor real. É usado pelo mock da camada de dados E como FALLBACK no
 * cliente quando o engine (POST /api/sim/turn) está indisponível.
 */
import type { SimTurnRequest, SimTurnResponse, SimFlags } from "@/api/types";

interface RawStage {
  id: string;
  goal?: string;
  reference_copy?: string[];
  actions?: string[];
  advance_when?: string;
  next?: string;
  terminal?: boolean;
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] || `{{${k}}}`);
}

/** Calcula um turno simulado a partir do flow + histórico + estágio atual. */
export function mockSimTurn(req: SimTurnRequest): SimTurnResponse {
  const stages = (Array.isArray(req.flow.stages) ? req.flow.stages : []) as RawStage[];

  // Flow sem estágios (v1 legado ou vazio): resposta genérica.
  if (stages.length === 0) {
    return {
      reply: "Entendi! (simulação genérica — este flow não tem estágios v2.)",
      stage_from: req.currentStage || "—",
      stage_to: req.currentStage || "—",
      temperatura: "morno",
      score: 5,
      flags: { send_preview: false, booked: false, precisa_humano: false, done: false },
      raw: { mock: true, note: "flow sem stages v2" },
    };
  }

  const entry = String(req.flow.entry_stage ?? stages[0].id);
  const fromId = req.currentStage || entry;
  const idx = Math.max(
    0,
    stages.findIndex((s) => s.id === fromId),
  );
  const stage = stages[idx] ?? stages[0];

  const refs = stage.reference_copy ?? [];
  const replyTpl = refs[0] ?? stage.goal ?? "Certo!";
  const reply = interpolate(replyTpl, req.variables);

  const toId = stage.terminal ? stage.id : (stage.next ?? stage.id);
  const actions = stage.actions ?? [];
  const flags: SimFlags = {
    send_preview: actions.includes("send_preview"),
    booked: actions.includes("book"),
    precisa_humano: false,
    done: Boolean(stage.terminal),
  };

  const progress = stages.length > 1 ? idx / (stages.length - 1) : 1;
  const temperatura = flags.done
    ? flags.booked
      ? "quente"
      : "frio"
    : progress > 0.6
      ? "quente"
      : progress > 0.3
        ? "morno"
        : "frio";
  const score = Math.min(10, Math.max(1, Math.round(1 + progress * 9)));

  return {
    reply,
    stage_from: fromId,
    stage_to: toId,
    temperatura,
    score,
    flags,
    raw: {
      mock: true,
      stage_from: fromId,
      stage_to: toId,
      advance_when: stage.advance_when,
      actions,
      flags,
      temperatura,
      score,
      turn: req.history.filter((m) => m.role === "sdr").length + 1,
    },
  };
}
