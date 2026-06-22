/**
 * sim-turn.ts — motor de simulação local (sem WhatsApp).
 *
 * Avança um flow v2 (estágios) de forma determinística para testar a conversa
 * sem o motor real. É usado pelo mock da camada de dados E como FALLBACK no
 * cliente quando o engine (POST /api/sim/turn) está indisponível.
 *
 * Multi-turno real: encadeia `sessionState` (objecao_count) entre turnos e
 * trata o loop de interrupção (objeção) com max_iterations / on_exceed do flow.
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

interface RawInterrupt {
  id: string;
  handler_instruction?: string;
  max_iterations?: number;
  on_exceed?: { goto?: string; set?: Record<string, unknown> };
  return?: string;
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] || `{{${k}}}`);
}

/** Heurística: a última fala do lead parece uma objeção? */
function isObjection(text: string): boolean {
  return /\b(pre[çc]o|caro|valor|quanto custa|n[ãa]o (preciso|quero|tenho interesse)|j[áa] tenho|ag[êe]ncia|depois|sem tempo|n[ãa]o é o momento|ocupad)/i.test(
    text,
  );
}

/** Calcula um turno simulado a partir do flow + histórico + estado de sessão. */
export function mockSimTurn(req: SimTurnRequest): SimTurnResponse {
  const stages = (Array.isArray(req.flow.stages) ? req.flow.stages : []) as RawStage[];
  const session = { ...(req.sessionState ?? {}) } as { objecao_count?: number };
  let objecaoCount = Number(session.objecao_count ?? 0);

  // Flow sem estágios (v1 legado ou vazio): resposta genérica.
  if (stages.length === 0) {
    return {
      reply: "Entendi! (simulação genérica — este flow não tem estágios v2.)",
      stage_from: req.currentStage || "—",
      stage_to: req.currentStage || "—",
      temperatura: "morno",
      score: 5,
      flags: { send_preview: false, booked: false, precisa_humano: false, done: false },
      objecao_count: objecaoCount,
      guardrail_violation: false,
      sessionState: { ...session, objecao_count: objecaoCount },
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

  const lastLead = [...req.history].reverse().find((m) => m.role === "lead")?.text ?? "";
  const interrupt = (Array.isArray(req.flow.interrupts) ? req.flow.interrupts : [])[0] as
    | RawInterrupt
    | undefined;

  // ── Loop de interrupção (objeção): acolhe e volta ao ponto de origem ──
  if (interrupt && !stage.terminal && isObjection(lastLead)) {
    objecaoCount += 1;
    const maxIter = Number(interrupt.max_iterations ?? 2);
    if (objecaoCount > maxIter) {
      const goto = interrupt.on_exceed?.goto ?? fromId;
      return {
        reply: "Sem problema, não quero tomar seu tempo. Qualquer coisa estou à disposição 🙏",
        stage_from: fromId,
        stage_to: goto,
        temperatura: "frio",
        score: 2,
        flags: { send_preview: false, booked: false, precisa_humano: false, done: true },
        objecao_count: objecaoCount,
        guardrail_violation: false,
        sessionState: { ...session, objecao_count: objecaoCount },
        raw: {
          mock: true,
          interrupt: interrupt.id,
          on_exceed: interrupt.on_exceed,
          objecao_count: objecaoCount,
        },
      };
    }
    const reply = interpolate(
      interrupt.handler_instruction
        ? "Entendo total. Sem te prender a nada — só queria te mostrar o que enxerguei. Posso seguir?"
        : "Entendo!",
      req.variables,
    );
    return {
      reply,
      stage_from: fromId,
      stage_to: fromId, // volta ao ponto de origem (PONTO_RETORNO)
      temperatura: "morno",
      score: 4,
      flags: { send_preview: false, booked: false, precisa_humano: false, done: false },
      objecao_count: objecaoCount,
      guardrail_violation: false,
      sessionState: { ...session, objecao_count: objecaoCount },
      raw: {
        mock: true,
        interrupt: interrupt.id,
        return: interrupt.return,
        objecao_count: objecaoCount,
      },
    };
  }

  // ── Avanço normal de estágio ──
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
    objecao_count: objecaoCount,
    guardrail_violation: false,
    sessionState: { ...session, objecao_count: objecaoCount },
    raw: {
      mock: true,
      stage_from: fromId,
      stage_to: toId,
      advance_when: stage.advance_when,
      actions,
      flags,
      temperatura,
      score,
      objecao_count: objecaoCount,
      turn: req.history.filter((m) => m.role === "sdr").length + 1,
    },
  };
}
