import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { importFlow, exportFlow, type FlowEnvelope } from "@/lib/flow-serializer";

export type NodeKind =
  | "start"
  | "send"
  | "ai"
  | "wait"
  | "conditional"
  | "variable"
  | "action"
  | "end"
  | "log"
  | "jump"
  | "subflow"
  | "validation";

export interface BranchOption {
  id: string;
  label: string;
}

export interface MessageVariation {
  id: string;
  text: string;
  when: string;
}

/** Condição que governa o "advance" de uma transição (aresta). */
export type EdgeConditionKind = "sim" | "nao" | "gatilho" | "timeout" | "objecao" | "sempre";

export interface EdgeData extends Record<string, unknown> {
  /** Tipo da condição que dispara esta transição. */
  condition?: EdgeConditionKind;
  /** Rótulo visível no canvas. */
  label?: string;
}

/** Variável declarada do flow (painel dedicado, separado do start). */
export type FlowVarScope = "required" | "runtime";
export interface FlowVariable {
  id: string;
  key: string;
  scope: FlowVarScope;
  /** captura tipada opcional (telefone/email/data/entidade-LLM). */
  capture?: "none" | "phone" | "email" | "date" | "entity";
  note?: string;
}

export interface NodeData extends Record<string, unknown> {
  label?: string;
  _raw?: Record<string, unknown>;
  // start
  researchName?: string;
  niche?: string;
  audience?: string;
  requiredVars?: string[];
  // send
  variations?: MessageVariation[];
  /** mídia anexada: áudio .ogg, imagem, PDF/documento. */
  mediaType?: "none" | "audio" | "image" | "pdf";
  mediaUrl?: string;
  /** divide a fala em 1-3 mensagens com "digitando…" entre elas. */
  splitMessages?: boolean;
  // ai
  model?: string;
  mode?: "strict" | "flexible";
  instruction?: string;
  limits?: string;
  fallbackModel?: string;
  /** além de gerar resposta, classifica intenção/objeção e ramifica. */
  aiClassify?: boolean;
  // wait
  timeoutValue?: number;
  timeoutUnit?: "minutes" | "hours" | "days";
  onTimeout?: "followup" | "end" | "node";
  /** delay com indicador "digitando" durante a espera. */
  waitTyping?: boolean;
  /** modo da espera: aguardar resposta, ou até um horário/data (wait-until). */
  waitMode?: "reply" | "until";
  waitUntil?: string;
  /** comportamento fora da janela de envio. */
  respectQuietHours?: boolean;
  // conditional
  classifierModel?: string;
  branches?: BranchOption[];
  // variable
  varKey?: string;
  varValue?: string;
  /** captura tipada: telefone/email/data, ou entidade via LLM. */
  capture?: "none" | "phone" | "email" | "date" | "entity";
  captureEntity?: string;
  // action
  actionType?:
    | "audit_site"
    | "calendar"
    | "webhook"
    | "send_preview"
    | "book"
    | "handoff"
    | "crm_tag"
    | "crm_status";
  actionUrl?: string;
  calendarLink?: string;
  /** handoff: para quem notificar; crm: tag/status a aplicar. */
  handoffTarget?: string;
  crmTag?: string;
  crmStatus?: string;
  // jump / go-to
  jumpTargetId?: string;
  /** restaura o ponto de retorno pós-objeção em vez de um nó fixo. */
  jumpReturn?: boolean;
  // subflow
  subflowId?: string;
  // validation
  validationRegex?: string;
  validationVar?: string;
  // end
  result?: "meeting" | "rejected" | "followup";
  note?: string;
  // log
  sheetsEnabled?: boolean;
  spreadsheetId?: string;
  sheetTab?: string;
  // status
  status?: "idle" | "running" | "ok" | "error";
  errorMsg?: string;
}

export type FlowNode = Node<NodeData>;

export interface HumanizationConfig {
  readingSpeed: number;
  typingSpeed: number;
  alwaysTyping: boolean;
  maxConsecutive: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  timezone: string;
}

export interface InterruptConfig {
  id: string;
  name: string;
  trigger: string;
  goToNodeId: string;
  resolveBehavior: "resume" | "fixed_node";
  fixedNodeId?: string;
}

interface FlowStore {
  flowName: string;
  nodes: FlowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  /** aresta selecionada (para editar condição da transição). */
  selectedEdgeId: string | null;
  /** id do nó marcado como entrada do flow. */
  entryNodeId: string | null;
  /** variáveis declaradas do flow (painel dedicado). */
  variables: FlowVariable[];
  humanization: HumanizationConfig;
  interrupts: InterruptConfig[];
  envelope: FlowEnvelope;
  /** id do flow no backend (null = ainda não salvo). */
  currentFlowId: string | null;
  /** flow publicado = roteiro que o cérebro do motor usa. */
  published: boolean;

  setFlowName: (name: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  updateNodeData: (id: string, patch: Partial<NodeData>) => void;
  duplicateNode: (id: string) => void;
  deleteNode: (id: string) => void;
  setSelected: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  updateEdgeData: (id: string, patch: Partial<EdgeData>) => void;
  setEntryNode: (id: string) => void;
  addVariable: () => void;
  updateVariable: (id: string, patch: Partial<FlowVariable>) => void;
  removeVariable: (id: string) => void;
  updateHumanization: (patch: Partial<HumanizationConfig>) => void;
  addInterrupt: () => void;
  updateInterrupt: (id: string, patch: Partial<InterruptConfig>) => void;
  removeInterrupt: (id: string) => void;
  loadFlow: (jsonStr: string, meta?: { id?: string | null; active?: boolean }) => void;
  exportToJSON: () => string;
  setCurrentFlow: (id: string | null, active?: boolean) => void;
  setPublished: (v: boolean) => void;
  resetFlow: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultDataFor = (kind: NodeKind): NodeData => {
  switch (kind) {
    case "start":
      return { researchName: "Nova pesquisa", niche: "", audience: "", requiredVars: ["nome"] };
    case "send":
      return {
        variations: [{ id: uid(), text: "Olá {{nome}}, tudo bem?", when: "" }],
      };
    case "ai":
      return {
        model: "gemini-2.5-flash",
        mode: "strict",
        instruction: "",
        limits: "",
        fallbackModel: "",
      };
    case "wait":
      return { timeoutValue: 24, timeoutUnit: "hours", onTimeout: "followup" };
    case "conditional":
      return {
        classifierModel: "groq-llama-3.3-70b",
        branches: [
          { id: uid(), label: "aceita prévia" },
          { id: uid(), label: "objeção" },
        ],
      };
    case "variable":
      return { varKey: "resultado", varValue: "" };
    case "action":
      return { actionType: "audit_site" };
    case "end":
      return { result: "meeting", note: "" };
    case "log":
      return { sheetsEnabled: false, spreadsheetId: "", sheetTab: "Leads" };
    case "jump":
      return { jumpTargetId: "", jumpReturn: true };
    case "subflow":
      return { subflowId: "" };
    case "validation":
      return { validationRegex: "", validationVar: "" };
  }
};

const defaultEnvelope: FlowEnvelope = {
  flow_id: "novo_flow",
  version: "1.0",
};

const defaultHumanization: HumanizationConfig = {
  readingSpeed: 225,
  typingSpeed: 40,
  alwaysTyping: true,
  maxConsecutive: 3,
  sendWindowStart: "08:00",
  sendWindowEnd: "22:00",
  timezone: "America/Sao_Paulo",
};

const defaultInterrupts: InterruptConfig[] = [
  {
    id: uid(),
    name: "Objeção precoce",
    trigger: "lead objeta interesse, agência ou preço antes da abertura",
    goToNodeId: "",
    resolveBehavior: "resume",
  },
];

/** Deriva as variáveis declaradas a partir do envelope (required + runtime). */
function variablesFromEnvelope(env: FlowEnvelope): FlowVariable[] {
  const out: FlowVariable[] = [];
  for (const k of env.required_variables ?? []) out.push({ id: uid(), key: k, scope: "required" });
  for (const k of env.runtime_variables ?? []) out.push({ id: uid(), key: k, scope: "runtime" });
  return out;
}

/** Rótulo padrão de uma transição quando não há condição explícita. */
const CONDITION_LABEL: Record<EdgeConditionKind, string> = {
  sim: "sim",
  nao: "não",
  gatilho: "gatilho",
  timeout: "sem resposta",
  objecao: "objeção",
  sempre: "",
};

/** Deriva condição+label de uma aresta a partir do handle estrutural (lossless). */
function deriveEdgeCondition(handle?: string | null): EdgeData {
  switch (handle) {
    case "reply":
      return { condition: "sim", label: CONDITION_LABEL.sim };
    case "timeout":
      return { condition: "timeout", label: CONDITION_LABEL.timeout };
    case "fail":
      return { condition: "nao", label: "falha" };
    case "default":
      return { condition: "sempre", label: "default" };
    default:
      return { condition: "sempre", label: "" };
  }
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  flowName: "Flow sem título",
  nodes: [
    {
      id: "start-1",
      type: "start",
      position: { x: 80, y: 200 },
      data: defaultDataFor("start"),
    },
  ],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  entryNodeId: "start-1",
  variables: [],
  humanization: defaultHumanization,
  interrupts: defaultInterrupts,
  envelope: defaultEnvelope,
  currentFlowId: null,
  published: false,

  setFlowName: (name) => set({ flowName: name }),
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as FlowNode[] })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (conn) =>
    set((s) => {
      const cond = deriveEdgeCondition(conn.sourceHandle);
      return {
        edges: addEdge(
          { ...conn, animated: true, label: cond.label || undefined, data: cond },
          s.edges,
        ),
      };
    }),

  addNode: (kind, position) => {
    const id = `${kind}-${uid()}`;
    const node: FlowNode = { id, type: kind, position, data: defaultDataFor(kind) };
    set((s) => ({ nodes: [...s.nodes, node] }));
  },

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    })),

  duplicateNode: (id) =>
    set((s) => {
      const src = s.nodes.find((n) => n.id === id);
      if (!src) return {};
      const newId = `${src.type}-${uid()}`;
      const clone: FlowNode = {
        ...src,
        id: newId,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        data: { ...structuredClone(src.data), _raw: undefined },
        selected: false,
      };
      return { nodes: [...s.nodes, clone], selectedNodeId: newId, selectedEdgeId: null };
    }),

  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      entryNodeId: s.entryNodeId === id ? null : s.entryNodeId,
    })),

  setSelected: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  updateEdgeData: (id, patch) =>
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        const data = { ...(e.data as EdgeData), ...patch } as EdgeData;
        return { ...e, data, label: data.label || undefined };
      }),
    })),
  setEntryNode: (id) => set({ entryNodeId: id }),
  addVariable: () =>
    set((s) => ({
      variables: [...s.variables, { id: uid(), key: "nova_variavel", scope: "runtime" }],
    })),
  updateVariable: (id, patch) =>
    set((s) => ({
      variables: s.variables.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    })),
  removeVariable: (id) => set((s) => ({ variables: s.variables.filter((v) => v.id !== id) })),

  updateHumanization: (patch) => set((s) => ({ humanization: { ...s.humanization, ...patch } })),

  addInterrupt: () =>
    set((s) => ({
      interrupts: [
        ...s.interrupts,
        {
          id: uid(),
          name: "Nova interrupção",
          trigger: "",
          goToNodeId: "",
          resolveBehavior: "resume",
        },
      ],
    })),
  updateInterrupt: (id, patch) =>
    set((s) => ({
      interrupts: s.interrupts.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),
  removeInterrupt: (id) => set((s) => ({ interrupts: s.interrupts.filter((i) => i.id !== id) })),

  loadFlow: (jsonStr, meta) => {
    try {
      const result = importFlow(jsonStr);
      const name = result.envelope.flow_id ?? "Flow importado";
      set({
        nodes: result.nodes as FlowNode[],
        edges: result.edges,
        envelope: result.envelope,
        humanization: { ...defaultHumanization, ...result.humanization },
        interrupts: result.interrupts.length > 0 ? result.interrupts : defaultInterrupts,
        variables: variablesFromEnvelope(result.envelope),
        entryNodeId: result.envelope.entry ?? result.nodes[0]?.id ?? null,
        selectedNodeId: null,
        selectedEdgeId: null,
        flowName: name,
        currentFlowId: meta?.id ?? null,
        published: meta?.active ?? false,
      });
    } catch (err) {
      throw new Error(`Falha ao importar flow: ${(err as Error).message}`);
    }
  },

  exportToJSON: () => {
    const s = get();
    // Variáveis do painel dedicado têm precedência sobre o envelope antigo.
    const required = s.variables.filter((v) => v.scope === "required").map((v) => v.key);
    const runtime = s.variables.filter((v) => v.scope === "runtime").map((v) => v.key);
    const envelope: FlowEnvelope = {
      ...s.envelope,
      entry: s.entryNodeId ?? s.envelope.entry ?? s.nodes[0]?.id ?? "",
      required_variables: required.length ? required : s.envelope.required_variables,
      runtime_variables: runtime.length ? runtime : s.envelope.runtime_variables,
    };
    return exportFlow({
      nodes: s.nodes,
      edges: s.edges,
      envelope,
      humanization: s.humanization,
      interrupts: s.interrupts,
    });
  },

  setCurrentFlow: (id, active) =>
    set((s) => ({ currentFlowId: id, published: active ?? s.published })),
  setPublished: (v) => set({ published: v }),

  resetFlow: () =>
    set({
      flowName: "Flow sem título",
      nodes: [
        {
          id: "start-1",
          type: "start",
          position: { x: 80, y: 200 },
          data: defaultDataFor("start"),
        },
      ],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      entryNodeId: "start-1",
      variables: [],
      humanization: defaultHumanization,
      interrupts: defaultInterrupts,
      envelope: defaultEnvelope,
      currentFlowId: null,
      published: false,
    }),
}));
