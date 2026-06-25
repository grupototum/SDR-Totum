import { create } from "zustand";
import {
  parseFlowV2,
  serializeFlowV2,
  type FlowV2,
  type V2Globals,
  type V2Interrupt,
  type V2Stage,
} from "@/lib/flow-v2";

interface FlowV2Store {
  flow: FlowV2 | null;
  selectedStageId: string | null;
  /** id persistido em /api/flows (null = ainda não salvo). */
  currentFlowId: string | null;
  published: boolean;

  loadFromJSON: (json: string) => void;
  setFlow: (flow: FlowV2) => void;
  exportToJSON: () => string;

  selectStage: (id: string | null) => void;
  setCurrentFlow: (id: string) => void;
  setPublished: (v: boolean) => void;

  // Envelope / meta
  patchMeta: (patch: Partial<Pick<FlowV2, "name" | "objective">>) => void;
  patchGlobals: (patch: Partial<V2Globals>) => void;

  // Estágios
  updateStage: (id: string, patch: Partial<V2Stage>) => void;
  addStage: () => void;
  removeStage: (id: string) => void;
  moveStage: (id: string, dir: -1 | 1) => void;

  // Interrupções
  updateInterrupt: (id: string, patch: Partial<V2Interrupt>) => void;
  addInterrupt: () => void;
  removeInterrupt: (id: string) => void;
}

function uniqueId(items: { id: string }[], base = "novo_estagio"): string {
  let id = base;
  let n = 2;
  const ids = new Set(items.map((s) => s.id));
  while (ids.has(id)) id = `${base}_${n++}`;
  return id;
}

export const useFlowV2Store = create<FlowV2Store>((set, get) => ({
  flow: null,
  selectedStageId: null,
  currentFlowId: null,
  published: false,

  loadFromJSON: (json) => {
    const flow = parseFlowV2(json);
    set({
      flow,
      selectedStageId: flow.stages[0]?.id ?? null,
      currentFlowId: null,
      published: false,
    });
  },

  setFlow: (flow) => set({ flow, selectedStageId: flow.stages[0]?.id ?? null }),

  exportToJSON: () => {
    const { flow } = get();
    if (!flow) throw new Error("Nenhum flow v2 carregado.");
    return serializeFlowV2(flow);
  },

  selectStage: (id) => set({ selectedStageId: id }),
  setCurrentFlow: (id) => set({ currentFlowId: id }),
  setPublished: (v) => set({ published: v }),

  patchMeta: (patch) => set((s) => (s.flow ? { flow: { ...s.flow, ...patch } } : s)),

  patchGlobals: (patch) =>
    set((s) => (s.flow ? { flow: { ...s.flow, globals: { ...s.flow.globals, ...patch } } } : s)),

  updateStage: (id, patch) =>
    set((s) => {
      if (!s.flow) return s;
      const stages = s.flow.stages.map((st) => (st.id === id ? { ...st, ...patch } : st));
      // Renomear id: mantém a seleção apontando para o novo id.
      const selected = patch.id && s.selectedStageId === id ? patch.id : s.selectedStageId;
      return { flow: { ...s.flow, stages }, selectedStageId: selected };
    }),

  addStage: () =>
    set((s) => {
      if (!s.flow) return s;
      const id = uniqueId(s.flow.stages);
      const stage: V2Stage = { id, goal: "", instruction: "", reference_copy: [] };
      return { flow: { ...s.flow, stages: [...s.flow.stages, stage] }, selectedStageId: id };
    }),

  removeStage: (id) =>
    set((s) => {
      if (!s.flow) return s;
      const stages = s.flow.stages.filter((st) => st.id !== id);
      const selectedStageId =
        s.selectedStageId === id ? (stages[0]?.id ?? null) : s.selectedStageId;
      return { flow: { ...s.flow, stages }, selectedStageId };
    }),

  moveStage: (id, dir) =>
    set((s) => {
      if (!s.flow) return s;
      const stages = [...s.flow.stages];
      const i = stages.findIndex((st) => st.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= stages.length) return s;
      [stages[i], stages[j]] = [stages[j], stages[i]];
      return { flow: { ...s.flow, stages } };
    }),

  updateInterrupt: (id, patch) =>
    set((s) => {
      if (!s.flow) return s;
      const interrupts = (s.flow.interrupts ?? []).map((it) =>
        it.id === id ? { ...it, ...patch } : it,
      );
      return { flow: { ...s.flow, interrupts } };
    }),

  addInterrupt: () =>
    set((s) => {
      if (!s.flow) return s;
      const existing = s.flow.interrupts ?? [];
      const it: V2Interrupt = {
        id: uniqueId(existing, "interrupcao"),
        trigger: "",
        handler_instruction: "",
        categories: [],
        max_iterations: 2,
      };
      return { flow: { ...s.flow, interrupts: [...existing, it] } };
    }),

  removeInterrupt: (id) =>
    set((s) =>
      s.flow
        ? {
            flow: { ...s.flow, interrupts: (s.flow.interrupts ?? []).filter((it) => it.id !== id) },
          }
        : s,
    ),
}));
