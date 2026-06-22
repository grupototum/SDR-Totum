/**
 * sim-harness.ts — bateria de personas para medir a saúde de um flow.
 *
 * Cada persona é um roteiro de falas do lead. A bateria roda cada persona
 * turno-a-turno pelo mesmo caminho do chat (turnFn = api.simTurn com fallback
 * mock), encadeando sessionState, e calcula a métrica de saúde:
 *   % de personas que fecham (booked) SEM violar guard-rail.
 */
import type { SimMessage, SimTurnRequest, SimTurnResponse } from "@/api/types";

export interface Persona {
  id: string;
  name: string;
  variables: Record<string, string>;
  /** Falas do lead, em ordem. Após o fim, repete a última. */
  leads: string[];
}

export interface BatteryResult {
  persona: string;
  booked: boolean;
  guardrail_violation: boolean;
  turns: number;
  finalStage: string;
  healthy: boolean;
}

export interface BatterySummary {
  results: BatteryResult[];
  total: number;
  healthy: number;
  healthRate: number; // 0..1 — % booked sem violar guard-rail
}

const ODONTO_VARS: Record<string, string> = {
  NOME_EMPRESA: "Clínica Sorriso",
  NOME_DONO: "Dr. Carlos",
  ESPECIALIDADE: "Implantes",
  CIDADE: "Foz do Iguaçu",
  QTD_AVALIACOES: "187",
  CONTEUDO_RECENTE: "implante de zircônia",
  CONCORRENTE_1: "OdontoVita",
  CONCORRENTE_2: "SmilePlus",
  CONCORRENTE_3: "DentalPro",
  tipo_clinica: "especializada",
  TEM_SITE: "sim",
};

export const PERSONAS: Persona[] = [
  {
    id: "decisor_facil",
    name: "Decisor fácil",
    variables: ODONTO_VARS,
    leads: [
      "sim, sou eu",
      "temos site sim",
      "faz total sentido",
      "pode mandar",
      "recebi",
      "amanhã 10h",
    ],
  },
  {
    id: "objecao_preco_1x",
    name: "Objeção de preço (1×)",
    variables: ODONTO_VARS,
    leads: [
      "sim, sou eu",
      "quanto custa?",
      "ok, pode seguir",
      "temos site",
      "manda a prévia",
      "recebi",
      "16h",
    ],
  },
  {
    id: "objetor_persistente",
    name: "Objetor persistente",
    variables: ODONTO_VARS,
    leads: ["sim", "tá caro", "não tenho interesse", "já tenho agência", "depois"],
  },
  {
    id: "direto_ao_ponto",
    name: "Direto ao ponto",
    variables: ODONTO_VARS,
    leads: [
      "sou eu, pode falar",
      "sim, temos site",
      "entendi a lógica",
      "manda a prévia",
      "ok",
      "pode ser 10h",
    ],
  },
];

type TurnFn = (req: SimTurnRequest) => Promise<SimTurnResponse>;

export async function runPersona(
  flow: Record<string, unknown>,
  persona: Persona,
  turnFn: TurnFn,
  maxTurns = 14,
): Promise<BatteryResult> {
  const entry = String(flow.entry_stage ?? "");
  let stage = entry;
  let session: Record<string, unknown> = {};
  const history: SimMessage[] = [];
  let booked = false;
  let guardrail = false;
  let turns = 0;

  for (let i = 0; i < maxTurns; i++) {
    const lead = persona.leads[Math.min(i, persona.leads.length - 1)] ?? "ok";
    history.push({ role: "lead", text: lead });
    const res = await turnFn({
      flow,
      variables: persona.variables,
      history,
      currentStage: stage,
      sessionState: session,
    });
    history.push({ role: "sdr", text: res.reply });
    stage = res.stage_to;
    session = res.sessionState;
    turns++;
    if (res.flags.booked) booked = true;
    if (res.guardrail_violation) guardrail = true;
    if (res.flags.done) break;
  }

  return {
    persona: persona.name,
    booked,
    guardrail_violation: guardrail,
    turns,
    finalStage: stage,
    healthy: booked && !guardrail,
  };
}

export async function runBattery(
  flow: Record<string, unknown>,
  turnFn: TurnFn,
): Promise<BatterySummary> {
  const results = await Promise.all(PERSONAS.map((p) => runPersona(flow, p, turnFn)));
  const healthy = results.filter((r) => r.healthy).length;
  return {
    results,
    total: results.length,
    healthy,
    healthRate: results.length ? healthy / results.length : 0,
  };
}
