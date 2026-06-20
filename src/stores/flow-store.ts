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

export type NodeKind =
  | "start"
  | "send"
  | "ai"
  | "wait"
  | "conditional"
  | "variable"
  | "action"
  | "end"
  | "log";

export interface BranchOption {
  id: string;
  label: string;
}

export interface MessageVariation {
  id: string;
  text: string;
  when: string;
}

export interface NodeData extends Record<string, unknown> {
  label?: string;
  // start
  researchName?: string;
  niche?: string;
  audience?: string;
  requiredVars?: string[];
  // send
  variations?: MessageVariation[];
  // ai
  model?: "gemini" | "claude" | "groq" | "openai";
  mode?: "strict" | "flexible";
  instruction?: string;
  limits?: string;
  fallbackModel?: string;
  // wait
  timeoutValue?: number;
  timeoutUnit?: "minutes" | "hours" | "days";
  onTimeout?: "followup" | "end" | "node";
  // conditional
  classifierModel?: "gemini" | "claude" | "groq" | "openai";
  branches?: BranchOption[];
  // variable
  varKey?: string;
  varValue?: string;
  // action
  actionType?: "audit_site" | "calendar" | "webhook";
  actionUrl?: string;
  calendarLink?: string;
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
  readingSpeed: number; // wpm
  typingSpeed: number; // wpm
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
  humanization: HumanizationConfig;
  interrupts: InterruptConfig[];

  setFlowName: (name: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  updateNodeData: (id: string, patch: Partial<NodeData>) => void;
  deleteNode: (id: string) => void;
  setSelected: (id: string | null) => void;
  updateHumanization: (patch: Partial<HumanizationConfig>) => void;
  addInterrupt: () => void;
  updateInterrupt: (id: string, patch: Partial<InterruptConfig>) => void;
  removeInterrupt: (id: string) => void;
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
        model: "gemini",
        mode: "strict",
        instruction: "",
        limits: "",
        fallbackModel: "",
      };
    case "wait":
      return { timeoutValue: 24, timeoutUnit: "hours", onTimeout: "followup" };
    case "conditional":
      return {
        classifierModel: "gemini",
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
  }
};

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
  humanization: {
    readingSpeed: 225,
    typingSpeed: 40,
    alwaysTyping: true,
    maxConsecutive: 3,
    sendWindowStart: "08:00",
    sendWindowEnd: "22:00",
    timezone: "America/Sao_Paulo",
  },
  interrupts: [
    {
      id: uid(),
      name: "Objeção precoce",
      trigger: "lead objeta interesse, agência ou preço antes da abertura",
      goToNodeId: "",
      resolveBehavior: "resume",
    },
  ],

  setFlowName: (name) => set({ flowName: name }),
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as FlowNode[] })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (conn) => set((s) => ({ edges: addEdge({ ...conn, animated: true }, s.edges) })),

  addNode: (kind, position) => {
    const id = `${kind}-${uid()}`;
    const node: FlowNode = { id, type: kind, position, data: defaultDataFor(kind) };
    set((s) => ({ nodes: [...s.nodes, node] }));
  },

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    })),

  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  setSelected: (id) => set({ selectedNodeId: id }),

  updateHumanization: (patch) =>
    set((s) => ({ humanization: { ...s.humanization, ...patch } })),

  addInterrupt: () =>
    set((s) => ({
      interrupts: [
        ...s.interrupts,
        { id: uid(), name: "Nova interrupção", trigger: "", goToNodeId: "", resolveBehavior: "resume" },
      ],
    })),
  updateInterrupt: (id, patch) =>
    set((s) => ({
      interrupts: s.interrupts.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),
  removeInterrupt: (id) =>
    set((s) => ({ interrupts: s.interrupts.filter((i) => i.id !== id) })),
}));
