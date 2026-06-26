/**
 * flow-serializer.ts
 * Converts between the FLOW_FORMAT_SPEC JSON and the React Flow internal format.
 *
 * ROUND-TRIP STRATEGY (lossless):
 *   - Each imported node stores `data._raw` = complete original spec node.
 *   - On export: start with `_raw`, override UI-mapped fields, inject routing from edges.
 *   - Fields with no UI (ref, block, effects, delay, outputs, set inside branches, etc.)
 *     are automatically preserved via _raw.
 *   - Top-level envelope extras (changelog, opening_variations, etc.) live in
 *     `envelope._extra`.
 */

import type { Edge, Node } from "@xyflow/react";
import type { NodeData, NodeKind, HumanizationConfig, InterruptConfig } from "@/stores/flow-store";

// ─── Type mapping ────────────────────────────────────────────────────────────

const SPEC_TO_STORE: Record<string, NodeKind> = {
  send_message: "send",
  ai_message: "ai",
  wait: "wait",
  conditional: "conditional",
  set_variable: "variable",
  action: "action",
  end: "end",
  log: "log",
  start: "start",
  jump: "jump",
  subflow: "subflow",
  validation: "validation",
};

const STORE_TO_SPEC: Record<NodeKind, string> = {
  send: "send_message",
  ai: "ai_message",
  wait: "wait",
  conditional: "conditional",
  variable: "set_variable",
  action: "action",
  end: "end",
  log: "log",
  start: "start",
  jump: "jump",
  subflow: "subflow",
  validation: "validation",
};

/** Rótulo derivado de uma transição a partir do handle estrutural (display-only). */
function edgeLabelFor(handle?: string): { label: string; condition: string } {
  switch (handle) {
    case "reply":
      return { label: "sim", condition: "sim" };
    case "timeout":
      return { label: "sem resposta", condition: "timeout" };
    case "fail":
      return { label: "falha", condition: "nao" };
    case "default":
      return { label: "default", condition: "sempre" };
    default:
      return { label: "", condition: "sempre" };
  }
}

// ─── Envelope type ───────────────────────────────────────────────────────────

export interface FlowEnvelope {
  flow_id: string;
  version: string;
  source_script?: string;
  niche?: string;
  channel?: string;
  required_variables?: string[];
  runtime_variables?: string[];
  globals?: {
    humanization?: Record<string, unknown>;
    interrupts?: unknown[];
    loop_guards?: unknown;
  };
  entry?: string;
  _extra?: Record<string, unknown>; // passthrough: changelog, opening_variations, etc.
}

/** Estilo de rótulo de aresta para o canvas escuro. */
export const EDGE_LABEL_STYLE = {
  labelStyle: { fill: "#9ca3af", fontSize: 10, fontFamily: "monospace" },
  labelBgStyle: { fill: "#1b1728", fillOpacity: 0.95 },
  labelBgPadding: [4, 4] as [number, number],
  labelBgBorderRadius: 4,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTimeout(raw: string | number | undefined): {
  value: number;
  unit: "minutes" | "hours" | "days";
} {
  if (typeof raw === "number") return { value: raw, unit: "minutes" };
  if (!raw) return { value: 24, unit: "hours" };
  const s = String(raw).toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n)) return { value: 24, unit: "hours" };
  if (s.includes("day")) return { value: n, unit: "days" };
  if (s.includes("hour") || s.includes("h")) return { value: n, unit: "hours" };
  return { value: n, unit: "minutes" };
}

function formatTimeout(value: number, unit: "minutes" | "hours" | "days"): string {
  if (unit === "minutes") return `${value}min`;
  if (unit === "hours") return `${value}h`;
  return `${value}d`;
}

function globalsToHumanization(
  g: Record<string, unknown> | undefined,
): Partial<HumanizationConfig> {
  if (!g) return {};
  return {
    typingSpeed: (g.typing_speed_wpm as number) ?? 40,
    readingSpeed: (g.reading_speed_wpm as number) ?? 225,
    alwaysTyping: g.typing_indicator === "always",
    maxConsecutive: (g.max_consecutive_messages as number) ?? 3,
    sendWindowStart: (g.quiet_hours as string[] | undefined)?.[1] ?? "08:00",
    sendWindowEnd: (g.quiet_hours as string[] | undefined)?.[0] ?? "22:00",
    timezone: (g.timezone as string) ?? "America/Sao_Paulo",
  };
}

function humanizationToGlobals(h: HumanizationConfig): Record<string, unknown> {
  return {
    typing_indicator: h.alwaysTyping ? "always" : "off",
    typing_speed_wpm: h.typingSpeed,
    typing_duration_formula: "min((word_count/40)*60, 8) + random(0.5,1.5)",
    reading_speed_wpm: h.readingSpeed,
    read_gap_formula: "(word_count/225)*60 + random(1,3)",
    max_consecutive_messages: h.maxConsecutive,
    quiet_hours: [h.sendWindowEnd, h.sendWindowStart],
    timezone: h.timezone,
  };
}

function interruptsFromSpec(arr: unknown[] | undefined): InterruptConfig[] {
  if (!arr) return [];
  return arr.map((raw, i) => {
    const r = raw as Record<string, unknown>;
    return {
      id: (r.id as string) ?? `int-${i}`,
      name: (r.id as string) ?? `Interrupção ${i + 1}`,
      trigger: (r.trigger as string) ?? "",
      goToNodeId: (r.goto as string) ?? "",
      resolveBehavior: ((r.return as string) ?? "").includes("PONTO_RETORNO")
        ? "resume"
        : "fixed_node",
      fixedNodeId: ((r.return as string) ?? "").includes("PONTO_RETORNO")
        ? undefined
        : (r.return as string),
    };
  });
}

function interruptsToSpec(arr: InterruptConfig[]): unknown[] {
  return arr.map((i) => ({
    id: i.name,
    trigger: i.trigger,
    goto: i.goToNodeId,
    return:
      i.resolveBehavior === "resume" ? "{PONTO_RETORNO}" : (i.fixedNodeId ?? "{PONTO_RETORNO}"),
  }));
}

// ─── Auto-layout via BFS ─────────────────────────────────────────────────────

function layoutNodes(
  specNodes: Record<string, unknown>[],
  entry: string,
): Map<string, { x: number; y: number }> {
  const COL_GAP = 300;
  const ROW_GAP = 180;

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const n of specNodes) {
    const id = n.id as string;
    const nexts: string[] = [];
    if (n.next) nexts.push(n.next as string);
    if (n.on_reply) nexts.push(n.on_reply as string);
    if (n.on_timeout) nexts.push(n.on_timeout as string);
    if (n.default) nexts.push(n.default as string);
    if (Array.isArray(n.branches)) {
      for (const b of n.branches as Record<string, unknown>[]) {
        if (b.goto) nexts.push(b.goto as string);
      }
    }
    if (n.on_fail) nexts.push(n.on_fail as string);
    adj.set(id, [...new Set(nexts)]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const colCount = new Map<number, number>(); // how many nodes already in each column
  const visited = new Set<string>();

  const queue: Array<{ id: string; col: number }> = [{ id: entry, col: 0 }];
  visited.add(entry);

  while (queue.length > 0) {
    const { id, col } = queue.shift()!;
    const row = colCount.get(col) ?? 0;
    colCount.set(col, row + 1);
    positions.set(id, { x: col * COL_GAP + 80, y: row * ROW_GAP + 80 });

    const nexts = adj.get(id) ?? [];
    for (const nextId of nexts) {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ id: nextId, col: col + 1 });
      }
    }
  }

  // Any disconnected nodes (not reachable from entry) get appended at bottom
  let orphanY =
    (Array.from(colCount.values()).reduce((a, b) => Math.max(a, b), 0) + 1) * ROW_GAP + 80;
  for (const n of specNodes) {
    const id = n.id as string;
    if (!positions.has(id)) {
      positions.set(id, { x: 80, y: orphanY });
      orphanY += ROW_GAP;
    }
  }

  return positions;
}

// ─── IMPORT ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  nodes: Node<NodeData>[];
  edges: Edge[];
  envelope: FlowEnvelope;
  humanization: Partial<HumanizationConfig>;
  interrupts: InterruptConfig[];
}

export function importFlow(jsonStr: string): ImportResult {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`JSON inválido: ${(e as SyntaxError).message}`);
  }

  // Extract known envelope fields; rest → _extra
  const KNOWN_ENVELOPE = new Set([
    "flow_id",
    "version",
    "source_script",
    "niche",
    "channel",
    "required_variables",
    "runtime_variables",
    "globals",
    "entry",
    "nodes",
  ]);
  const _extra: Record<string, unknown> = {};
  for (const k of Object.keys(spec)) {
    if (!KNOWN_ENVELOPE.has(k)) _extra[k] = spec[k];
  }

  const specNodes = (spec.nodes as Record<string, unknown>[]) ?? [];
  const entry = (spec.entry as string) ?? (specNodes[0]?.id as string) ?? "";

  const globals = spec.globals as Record<string, unknown> | undefined;
  const humanizationSpec = globals?.humanization as Record<string, unknown> | undefined;
  const interruptsSpec = globals?.interrupts as unknown[] | undefined;

  const positions = layoutNodes(specNodes, entry);

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(source: string, target: string, sourceHandle?: string, labelOverride?: string) {
    if (!target) return;
    const id = `e-${source}-${target}${sourceHandle ? `-${sourceHandle}` : ""}`;
    if (edgeSet.has(id)) return;
    edgeSet.add(id);
    const derived = edgeLabelFor(sourceHandle);
    const label = labelOverride ?? derived.label;
    edges.push({
      id,
      source,
      target,
      sourceHandle: sourceHandle ?? undefined,
      animated: true,
      label: label || undefined,
      data: { condition: derived.condition, label },
      ...(label ? EDGE_LABEL_STYLE : {}),
    });
  }

  for (const specNode of specNodes) {
    const id = specNode.id as string;
    const specType = specNode.type as string;
    const storeType = SPEC_TO_STORE[specType] ?? (specType as NodeKind);
    const pos = positions.get(id) ?? { x: 80, y: 80 };

    // --- Extract UI fields from spec node ---
    const data: NodeData = {
      _raw: specNode,
    };

    if (storeType === "send") {
      if (Array.isArray(specNode.variants)) {
        data.variations = (specNode.variants as Record<string, unknown>[]).map((v) => ({
          id: (v.id as string) ?? crypto.randomUUID(),
          text: (v.text as string) ?? "",
          when: (v.when as string) ?? "",
        }));
      } else if (specNode.text) {
        data.variations = [{ id: "v0", text: specNode.text as string, when: "" }];
      } else {
        data.variations = [];
      }
      const media = specNode.media as Record<string, unknown> | undefined;
      if (media) {
        data.mediaType = (media.type as NodeData["mediaType"]) ?? "none";
        data.mediaUrl = (media.url as string) ?? "";
      }
      if (specNode.split_messages) data.splitMessages = true;
    }

    if (storeType === "ai") {
      data.model = (specNode.model as string) ?? "gemini-2.5-flash";
      data.mode = (specNode.mode as "strict" | "flexible") ?? "strict";
      data.instruction = (specNode.instruction as string) ?? "";
      data.limits = (specNode.limits as string) ?? "";
      if (specNode.classify) data.aiClassify = true;
    }

    if (storeType === "wait") {
      const to = parseTimeout(specNode.timeout as string | number | undefined);
      data.timeoutValue = to.value;
      data.timeoutUnit = to.unit;
      if (specNode.typing) data.waitTyping = true;
      if (specNode.wait_until) {
        data.waitMode = "until";
        data.waitUntil = specNode.wait_until as string;
      }
      if (specNode.respect_quiet_hours) data.respectQuietHours = true;
    }

    if (storeType === "conditional") {
      const branches = (specNode.branches as Record<string, unknown>[]) ?? [];
      data.classifierModel = (specNode.classifier as string) ?? "gemini";
      data.branches = branches.map((b, i) => ({
        id: `b${i}`,
        label: (b.when as string) ?? "",
      }));
    }

    if (storeType === "variable") {
      const setObj = (specNode.set as Record<string, unknown>) ?? {};
      const keys = Object.keys(setObj);
      data.varKey = keys[0] ?? "";
      data.varValue = keys[0] ? String(setObj[keys[0]]) : "";
      if (specNode.capture) {
        data.capture = specNode.capture as NodeData["capture"];
        if (specNode.capture_entity) data.captureEntity = specNode.capture_entity as string;
      }
    }

    if (storeType === "action") {
      const actionMap: Record<string, string> = {
        site_audit: "audit_site",
        calendar: "calendar",
        webhook: "webhook",
        send_preview: "send_preview",
        book: "book",
        handoff: "handoff",
        crm_tag: "crm_tag",
        crm_status: "crm_status",
      };
      data.actionType = (actionMap[specNode.action as string] ??
        "audit_site") as NodeData["actionType"];
      if (specNode.handoff_target) data.handoffTarget = specNode.handoff_target as string;
      if (specNode.crm_tag) data.crmTag = specNode.crm_tag as string;
      if (specNode.crm_status) data.crmStatus = specNode.crm_status as string;
    }

    if (storeType === "jump") {
      const target = (specNode.target as string) ?? "";
      data.jumpReturn = target.includes("PONTO_RETORNO");
      data.jumpTargetId = data.jumpReturn ? "" : target;
    }

    if (storeType === "subflow") {
      data.subflowId = (specNode.subflow as string) ?? "";
    }

    if (storeType === "validation") {
      data.validationRegex = (specNode.regex as string) ?? "";
      data.validationVar = (specNode.var as string) ?? "";
    }

    if (storeType === "end") {
      const setObj = (specNode.set as Record<string, unknown>) ?? {};
      const specResult = setObj.resultado as string | undefined;
      const resultMap: Record<string, string> = {
        reuniao_marcada: "meeting",
        rejeitado: "rejected",
        followup: "followup",
      };
      data.result = (resultMap[specResult ?? ""] ?? "meeting") as NodeData["result"];
      data.note = (specNode.note as string) ?? "";
    }

    if (storeType === "log") {
      data.sheetsEnabled = false;
    }

    nodes.push({ id, type: storeType, position: pos, data });

    // --- Create edges from routing fields ---
    if (specNode.next) addEdge(id, specNode.next as string);
    if (specNode.target && !String(specNode.target).includes("PONTO_RETORNO")) {
      addEdge(id, specNode.target as string);
    }
    if (specNode.on_reply) addEdge(id, specNode.on_reply as string, "reply");
    if (specNode.on_timeout) addEdge(id, specNode.on_timeout as string, "timeout");
    if (specNode.on_fail) addEdge(id, specNode.on_fail as string, "fail");

    if (Array.isArray(specNode.branches)) {
      const branches = specNode.branches as Record<string, unknown>[];
      branches.forEach((b, i) => {
        if (b.goto) addEdge(id, b.goto as string, `b${i}`, (b.when as string) ?? undefined);
      });
    }
    if (specNode.default) addEdge(id, specNode.default as string, "default");
  }

  const envelope: FlowEnvelope = {
    flow_id: (spec.flow_id as string) ?? "",
    version: (spec.version as string) ?? "1.0",
    source_script: spec.source_script as string | undefined,
    niche: spec.niche as string | undefined,
    channel: spec.channel as string | undefined,
    required_variables: spec.required_variables as string[] | undefined,
    runtime_variables: spec.runtime_variables as string[] | undefined,
    entry,
    globals: globals as FlowEnvelope["globals"],
    _extra,
  };

  return {
    nodes,
    edges,
    envelope,
    humanization: globalsToHumanization(humanizationSpec),
    interrupts: interruptsFromSpec(interruptsSpec),
  };
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────

export function exportFlow(params: {
  nodes: Node<NodeData>[];
  edges: Edge[];
  envelope: FlowEnvelope;
  humanization: HumanizationConfig;
  interrupts: InterruptConfig[];
}): string {
  const { nodes, edges, envelope, humanization, interrupts } = params;

  // Build edge lookup
  const outEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source)!.push(e);
  }

  function getNext(nodeId: string): string | undefined {
    return outEdges.get(nodeId)?.find((e) => !e.sourceHandle)?.target;
  }

  function getHandleTarget(nodeId: string, handle: string): string | undefined {
    return outEdges.get(nodeId)?.find((e) => e.sourceHandle === handle)?.target;
  }

  const specNodes = nodes.map((node) => {
    const raw = (node.data._raw as Record<string, unknown>) ?? {};
    const specType = STORE_TO_SPEC[node.type as NodeKind] ?? node.type;

    // Start with raw (passthrough), override id and type
    const out: Record<string, unknown> = { ...raw, id: node.id, type: specType };

    // Override UI-mapped fields
    if (node.type === "send") {
      const vars = node.data.variations ?? [];
      if (vars.length === 1 && !vars[0].when) {
        out.text = vars[0].text;
        delete out.variants;
      } else {
        out.variants = vars.map((v) => ({ id: v.id, when: v.when, text: v.text }));
        delete out.text;
      }
      // Mídia (áudio .ogg / imagem / PDF) — só persiste se configurada.
      if (node.data.mediaType && node.data.mediaType !== "none") {
        out.media = { type: node.data.mediaType, url: node.data.mediaUrl ?? "" };
      } else delete out.media;
      if (node.data.splitMessages) out.split_messages = true;
      else delete out.split_messages;
      // Routing
      const next = getNext(node.id) ?? (raw.next as string | undefined);
      if (next) out.next = next;
      else delete out.next;
    }

    if (node.type === "ai") {
      out.model = node.data.model ?? "gemini-2.5-flash";
      out.mode = node.data.mode ?? "strict";
      out.proactive = true;
      if (node.data.instruction) out.instruction = node.data.instruction;
      if (node.data.limits) out.limits = node.data.limits;
      if (node.data.aiClassify) out.classify = true;
      else delete out.classify;
      const next = getNext(node.id) ?? (raw.next as string | undefined);
      if (next) out.next = next;
      else delete out.next;
    }

    if (node.type === "wait") {
      const rawTimeout = raw.timeout as string | undefined;
      const fromUI = formatTimeout(node.data.timeoutValue ?? 24, node.data.timeoutUnit ?? "hours");
      out.timeout = rawTimeout ?? fromUI;
      const onReply = getHandleTarget(node.id, "reply") ?? (raw.on_reply as string | undefined);
      const onTimeout =
        getHandleTarget(node.id, "timeout") ?? (raw.on_timeout as string | undefined);
      if (onReply) out.on_reply = onReply;
      else delete out.on_reply;
      if (onTimeout) out.on_timeout = onTimeout;
      else delete out.on_timeout;
      if (node.data.waitTyping) out.typing = true;
      else delete out.typing;
      if (node.data.waitMode === "until" && node.data.waitUntil) {
        out.wait_until = node.data.waitUntil;
      } else delete out.wait_until;
      if (node.data.respectQuietHours) out.respect_quiet_hours = true;
      else delete out.respect_quiet_hours;
      delete out.next;
    }

    if (node.type === "conditional") {
      const rawBranches = (raw.branches as Record<string, unknown>[]) ?? [];
      const uiBranches = node.data.branches ?? [];

      out.branches = rawBranches.map((rb, i) => {
        const uiLabel = uiBranches[i]?.label;
        const goto = getHandleTarget(node.id, `b${i}`) ?? (rb.goto as string | undefined);
        const merged: Record<string, unknown> = { ...rb };
        if (uiLabel) merged.when = uiLabel;
        if (goto) merged.goto = goto;
        else delete merged.goto;
        return merged;
      });

      // If UI has more branches than raw (user added), append them
      for (let i = rawBranches.length; i < uiBranches.length; i++) {
        const goto = getHandleTarget(node.id, `b${i}`);
        const nb: Record<string, unknown> = { when: uiBranches[i].label };
        if (goto) nb.goto = goto;
        out.branches = [...(out.branches as unknown[]), nb];
      }

      out.classifier = node.data.classifierModel ?? (raw.classifier as string) ?? "gemini";
      const def = getHandleTarget(node.id, "default") ?? (raw.default as string | undefined);
      if (def) out.default = def;
      else delete out.default;
    }

    if (node.type === "variable") {
      const key = node.data.varKey ?? "";
      const val = node.data.varValue ?? "";
      if (key) out.set = { [key]: val };
      if (node.data.capture && node.data.capture !== "none") {
        out.capture = node.data.capture;
        if (node.data.capture === "entity" && node.data.captureEntity) {
          out.capture_entity = node.data.captureEntity;
        } else delete out.capture_entity;
      } else {
        delete out.capture;
        delete out.capture_entity;
      }
      const next = getNext(node.id) ?? (raw.next as string | undefined);
      if (next) out.next = next;
      else delete out.next;
    }

    if (node.type === "action") {
      const actionMap: Record<string, string> = {
        audit_site: "site_audit",
        calendar: "calendar",
        webhook: "webhook",
        send_preview: "send_preview",
        book: "book",
        handoff: "handoff",
        crm_tag: "crm_tag",
        crm_status: "crm_status",
      };
      // Prefer raw.action to preserve non-standard action types (e.g. enviar_previa)
      const rawAction = raw.action as string | undefined;
      out.action =
        rawAction ?? actionMap[node.data.actionType ?? "audit_site"] ?? node.data.actionType;
      // Parâmetros específicos (só persistem se configurados).
      if (node.data.actionType === "handoff" && node.data.handoffTarget) {
        out.handoff_target = node.data.handoffTarget;
      } else delete out.handoff_target;
      if (node.data.actionType === "crm_tag" && node.data.crmTag) out.crm_tag = node.data.crmTag;
      else delete out.crm_tag;
      if (node.data.actionType === "crm_status" && node.data.crmStatus) {
        out.crm_status = node.data.crmStatus;
      } else delete out.crm_status;
      const next = getNext(node.id) ?? (raw.next as string | undefined);
      if (next) out.next = next;
      else delete out.next;
      const fail = getHandleTarget(node.id, "fail") ?? (raw.on_fail as string | undefined);
      if (fail) out.on_fail = fail;
      else delete out.on_fail;
    }

    if (node.type === "end") {
      const resultMap: Record<string, string> = {
        meeting: "reuniao_marcada",
        rejected: "rejeitado",
        followup: "followup",
      };
      const setObj = (raw.set as Record<string, unknown>) ?? {};
      out.set = { ...setObj, resultado: resultMap[node.data.result ?? "meeting"] };
      if (node.data.note) out.note = node.data.note;
    }

    if (node.type === "jump") {
      // jump/go-to: volta ao ponto de retorno pós-objeção, ou a um nó fixo.
      out.target = node.data.jumpReturn
        ? "{PONTO_RETORNO}"
        : (getNext(node.id) ?? node.data.jumpTargetId ?? (raw.target as string) ?? "");
      delete out.next;
    }

    if (node.type === "subflow") {
      out.subflow = node.data.subflowId ?? (raw.subflow as string) ?? "";
      const next = getNext(node.id) ?? (raw.next as string | undefined);
      if (next) out.next = next;
      else delete out.next;
    }

    if (node.type === "validation") {
      if (node.data.validationRegex) out.regex = node.data.validationRegex;
      if (node.data.validationVar) out.var = node.data.validationVar;
      const next = getNext(node.id) ?? (raw.next as string | undefined);
      if (next) out.next = next;
      else delete out.next;
      const fail = getHandleTarget(node.id, "fail") ?? (raw.on_fail as string | undefined);
      if (fail) out.on_fail = fail;
      else delete out.on_fail;
    }

    return out;
  });

  // Rebuild globals
  const updatedGlobals: Record<string, unknown> = {
    ...(envelope.globals ?? {}),
    humanization: humanizationToGlobals(humanization),
    interrupts: interruptsToSpec(interrupts),
  };
  if (envelope.globals?.loop_guards) {
    updatedGlobals.loop_guards = envelope.globals.loop_guards;
  }

  const output: Record<string, unknown> = {
    flow_id: envelope.flow_id,
    version: envelope.version,
  };
  if (envelope.source_script) output.source_script = envelope.source_script;
  if (envelope.niche) output.niche = envelope.niche;
  if (envelope.channel) output.channel = envelope.channel;
  if (envelope.required_variables) output.required_variables = envelope.required_variables;
  if (envelope.runtime_variables) output.runtime_variables = envelope.runtime_variables;
  output.globals = updatedGlobals;
  output.entry = envelope.entry ?? nodes[0]?.id ?? "";
  output.nodes = specNodes;

  // Restore extra fields (changelog, opening_variations, etc.)
  if (envelope._extra) {
    for (const [k, v] of Object.entries(envelope._extra)) {
      output[k] = v;
    }
  }

  return JSON.stringify(output, null, 2);
}
