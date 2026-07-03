import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronRight,
  Upload,
  Download,
  Save,
  Rocket,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Flag,
  X,
  Layers,
  ShieldAlert,
  SlidersHorizontal,
  Wand2,
  Workflow,
  ArrowLeft,
  Search,
  AlertTriangle,
  PlayCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { api } from "@/api";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { detectFormat, summarizeV1, type V1LegacySummary, type V2Stage } from "@/lib/flow-v2";
import flowV2Default from "../../../docs/flow_odonto_stages_v2.json";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FlowV2 } from "@/lib/flow-v2";
import { WizardMode } from "./WizardMode";
import { FlowCanvasV2 } from "./FlowCanvasV2";
import { extractPlaceholders, registeredVariableNames } from "@/lib/flow-v2";

type View = "stage" | "interrupts" | "globals" | "pesquisa";
type Mode = "wizard" | "canvas" | "builder";

const MODE_KEY = "totum:builder-mode";

export function V2Builder({ flowId }: { flowId?: string } = {}) {
  const flow = useFlowV2Store((s) => s.flow);
  const setFlow = useFlowV2Store((s) => s.setFlow);
  const setCurrentFlow = useFlowV2Store((s) => s.setCurrentFlow);
  const currentFlowId = useFlowV2Store((s) => s.currentFlowId);
  const [view, setView] = useState<View>("stage");
  const [legacy, setLegacy] = useState<V1LegacySummary | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "canvas";
    return (window.localStorage.getItem(MODE_KEY) as Mode) || "canvas";
  });

  // Carrega flow por id quando vier da URL. Sem id → mantém o draft do store,
  // ou carrega o flow v2 padrão como rascunho inicial.
  const remoteQuery = useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => api.getFlow(flowId!),
    enabled: !!flowId && flowId !== currentFlowId,
  });

  useEffect(() => {
    if (flowId && remoteQuery.data) {
      // Guard: se o flowId já está no store, não re-setar — sem isso,
      // setFlow altera `flow` (que está nos deps) causando loop infinito.
      if (flowId === currentFlowId) return;
      setFlow(remoteQuery.data as unknown as FlowV2);
      setCurrentFlow(flowId);
    } else if (!flowId && !flow) {
      setFlow(flowV2Default as unknown as FlowV2);
    }
  }, [flowId, remoteQuery.data, currentFlowId, flow, setFlow, setCurrentFlow]);

  const setModeAndStore = (m: Mode) => {
    setMode(m);
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, m);
  };

  if (!flow) {
    return <div className="p-6 text-sm text-[color:var(--color-text-muted)]">Carregando…</div>;
  }

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden"
      style={{ background: "#0e0918" }}
    >
      <V2Toolbar
        onLegacy={setLegacy}
        mode={mode}
        setMode={setModeAndStore}
        onSimulate={() => setSimOpen(true)}
      />
      {mode === "wizard" && <WizardMode />}
      {mode === "canvas" && (
        <div
          className="grid flex-1 overflow-hidden"
          style={{ gridTemplateColumns: "300px 1fr 360px" }}
        >
          <StageRail view={view} setView={setView} />
          <FlowCanvasV2 onSelectStage={() => setView("stage")} />
          <div className="overflow-y-auto" style={{ boxShadow: "inset 1px 0 0 0 #1f192a" }}>
            {view === "pesquisa" ? <PesquisaPanel /> : <StageEditor />}
          </div>
        </div>
      )}
      {mode === "builder" && (
        <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "300px 1fr" }}>
          <StageRail view={view} setView={setView} />
          <div className="overflow-y-auto">
            {view === "stage" && <StageEditor />}
            {view === "interrupts" && <InterruptsEditor />}
            {view === "globals" && <GlobalsPanel />}
          </div>
        </div>
      )}
      {legacy && <LegacyOverlay summary={legacy} onClose={() => setLegacy(null)} />}
      {simOpen && <SimulationOverlay onClose={() => setSimOpen(false)} />}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function V2Toolbar({
  onLegacy,
  mode,
  setMode,
  onSimulate,
}: {
  onLegacy: (s: V1LegacySummary) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  onSimulate: () => void;
}) {
  const flow = useFlowV2Store((s) => s.flow)!;
  const patchMeta = useFlowV2Store((s) => s.patchMeta);
  const exportToJSON = useFlowV2Store((s) => s.exportToJSON);
  const loadFromJSON = useFlowV2Store((s) => s.loadFromJSON);
  const currentFlowId = useFlowV2Store((s) => s.currentFlowId);
  const published = useFlowV2Store((s) => s.published);
  const setCurrentFlow = useFlowV2Store((s) => s.setCurrentFlow);
  const setPublished = useFlowV2Store((s) => s.setPublished);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function persist(): Promise<string> {
    const env = JSON.parse(exportToJSON()) as Record<string, unknown>;
    if (currentFlowId) {
      await api.updateFlow(currentFlowId, env);
      return currentFlowId;
    }
    const { id } = await api.createFlow(env);
    setCurrentFlow(id);
    return id;
  }

  const saveMut = useMutation({
    mutationFn: persist,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Flow v2 salvo");
    },
    onError: (e) => toast.error(`Erro ao salvar: ${(e as Error).message}`),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const id = await persist();
      await api.publishFlow(id);
    },
    onSuccess: () => {
      setPublished(true);
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Estágios publicados — agora é o roteiro do motor");
    },
    onError: (e) => toast.error(`Erro ao publicar: ${(e as Error).message}`),
  });

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      try {
        const fmt = detectFormat(JSON.parse(json));
        if (fmt === "v1") {
          onLegacy(summarizeV1(json));
          toast.info("Flow v1 (legado) — abrindo visualização somente-leitura");
        } else if (fmt === "v2") {
          loadFromJSON(json);
          toast.success("Flow v2 importado");
        } else {
          toast.error("Formato não reconhecido (nem v2 nem v1).");
        }
      } catch (err) {
        toast.error(`Erro ao importar: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleExport() {
    const json = exportToJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(flow.flow_id || "flow_v2").replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Flow v2 exportado");
  }

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 px-5"
      style={{
        background: "rgba(27, 23, 40, 0.85)",
        backdropFilter: "blur(24px)",
        boxShadow: "inset 0 -1px 0 0 #1f192a",
      }}
    >
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/builder"
          className="flex items-center gap-1 text-[color:var(--color-text-muted)] hover:text-white"
          title="Voltar para fluxos"
        >
          <ArrowLeft className="size-3.5" /> Fluxos
        </Link>
        <ChevronRight className="size-3.5 text-[color:var(--color-text-muted)]" />
        <input
          value={flow.name}
          onChange={(e) => patchMeta({ name: e.target.value })}
          className="rounded-md bg-transparent text-white outline-none focus:bg-[#1f192a] focus:px-2 focus:py-1"
          style={{ minWidth: 200 }}
        />
        <span
          className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
          style={{
            background: published ? "rgba(53,166,112,0.15)" : "#1f192a",
            color: published ? "#35a670" : "#9ca3af",
          }}
        >
          {published && <CheckCircle2 className="size-3" />}
          {published ? "Publicado" : "Rascunho"}
        </span>
      </div>

      {/* Toggle Wizard | Builder — mesmo fluxo, vistas diferentes */}
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{ background: "#1f192a" }}
        role="tablist"
        aria-label="Modo de edição"
      >
        <button
          onClick={() => setMode("wizard")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors"
          style={{
            background: mode === "wizard" ? "#da2128" : "transparent",
            color: mode === "wizard" ? "#fff" : "#9ca3af",
          }}
          aria-selected={mode === "wizard"}
          role="tab"
        >
          <Wand2 className="size-3.5" /> Wizard
        </button>
        <button
          onClick={() => setMode("canvas")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors"
          style={{
            background: mode === "canvas" ? "#da2128" : "transparent",
            color: mode === "canvas" ? "#fff" : "#9ca3af",
          }}
          aria-selected={mode === "canvas"}
          role="tab"
        >
          <Workflow className="size-3.5" /> Canvas
        </button>
        <button
          onClick={() => setMode("builder")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors"
          style={{
            background: mode === "builder" ? "#da2128" : "transparent",
            color: mode === "builder" ? "#fff" : "#9ca3af",
          }}
          aria-selected={mode === "builder"}
          role="tab"
        >
          <Layers className="size-3.5" /> Formulário
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />
        <TotumButton variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-3.5" /> Importar
        </TotumButton>
        <TotumButton variant="ghost" size="sm" onClick={handleExport}>
          <Download className="size-3.5" /> Exportar
        </TotumButton>
        <TotumButton variant="ghost" size="sm" asChild>
          <Link to="/builder-legacy">
            <Layers className="size-3.5" /> Flow Builder
          </Link>
        </TotumButton>
        <TotumButton variant="ghost" size="sm" onClick={onSimulate}>
          <PlayCircle className="size-3.5" /> Simular
        </TotumButton>
      </div>

      <div className="flex items-center gap-2">
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || publishMut.isPending}
        >
          <Save className="size-3.5" /> {saveMut.isPending ? "Salvando…" : "Salvar"}
        </TotumButton>
        <TotumButton
          variant="primary"
          size="sm"
          onClick={() => publishMut.mutate()}
          disabled={publishMut.isPending}
        >
          <Rocket className="size-3.5" /> {publishMut.isPending ? "Publicando…" : "Publicar"}
        </TotumButton>
      </div>
    </header>
  );
}

// ─── Rail esquerdo: lista de estágios + navegação ────────────────────────────

function StageRail({ view, setView }: { view: View; setView: (v: View) => void }) {
  const flow = useFlowV2Store((s) => s.flow)!;
  const selectedStageId = useFlowV2Store((s) => s.selectedStageId);
  const selectStage = useFlowV2Store((s) => s.selectStage);
  const addStage = useFlowV2Store((s) => s.addStage);
  const moveStage = useFlowV2Store((s) => s.moveStage);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ background: "var(--color-card-totum)", boxShadow: "inset -1px 0 0 0 #1f192a" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
      >
        <span className="flex items-center gap-2 text-sm text-white">
          <Layers className="size-4 text-[#e3433e]" /> Estágios
        </span>
        <button
          onClick={addStage}
          title="Adicionar estágio"
          className="text-[color:var(--color-text-muted)] hover:text-white"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {flow.stages.map((st, i) => {
          const selected = view === "stage" && st.id === selectedStageId;
          const isEntry = flow.entry_stage === st.id;
          return (
            <div key={st.id} className="group flex items-center gap-1 px-2">
              <button
                onClick={() => {
                  selectStage(st.id);
                  setView("stage");
                }}
                className={cn(
                  "flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selected ? "text-white" : "text-[color:var(--color-text-muted)] hover:text-white",
                )}
                style={
                  selected
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(227,67,62,0.18), rgba(218,33,40,0.18))",
                        boxShadow: "inset 0 0 0 1px rgba(218,33,40,0.45)",
                      }
                    : undefined
                }
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="text-[10px] text-[color:var(--color-text-muted)]">{i + 1}</span>
                  <span className="truncate">{st.id}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {isEntry && (
                    <span className="rounded-full bg-[#077ac7]/20 px-1.5 text-[9px] text-[#5cb8f0]">
                      entry
                    </span>
                  )}
                  {st.terminal && <Flag className="size-3 text-[#35a670]" />}
                </span>
              </button>
              <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => moveStage(st.id, -1)}
                  className="text-[color:var(--color-text-muted)] hover:text-white"
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  onClick={() => moveStage(st.id, 1)}
                  className="text-[color:var(--color-text-muted)] hover:text-white"
                >
                  <ArrowDown className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 p-2" style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
        <RailNav
          active={view === "pesquisa"}
          onClick={() => setView("pesquisa")}
          icon={<Search className="size-4" />}
          label={`Pesquisa (${(flow.required_variables ?? []).length} variáveis)`}
        />
        <RailNav
          active={view === "interrupts"}
          onClick={() => setView("interrupts")}
          icon={<ShieldAlert className="size-4" />}
          label={`Interrupções (${flow.interrupts?.length ?? 0})`}
        />
        <RailNav
          active={view === "globals"}
          onClick={() => setView("globals")}
          icon={<SlidersHorizontal className="size-4" />}
          label="Global (humanização, guardrails, modelos)"
        />
      </div>
    </div>
  );
}

function RailNav({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors",
        active
          ? "bg-[#1f192a] text-white"
          : "text-[color:var(--color-text-muted)] hover:text-white",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

// ─── Placeholder picker (insere {{VAR}} na posição do cursor) ────────────────

function insertAtCursor(
  el: HTMLTextAreaElement | null,
  value: string,
  text: string,
  onChange: (v: string) => void,
) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  onChange(value.slice(0, start) + text + value.slice(end));
}

function PlaceholderPicker({ onInsert }: { onInsert: (name: string) => void }) {
  const flow = useFlowV2Store((s) => s.flow)!;
  const createPlaceholder = useFlowV2Store((s) => s.createPlaceholder);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const names = useMemo(() => [...registeredVariableNames(flow)].sort(), [flow]);

  function pick(name: string) {
    onInsert(`{{${name}}}`);
    setOpen(false);
  }

  function createAndPick() {
    const name = draft
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");
    if (!name) return;
    createPlaceholder(name);
    pick(name);
    setDraft("");
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] text-[color:var(--color-text-muted)] hover:text-white"
        title="Inserir placeholder"
      >
        + placeholder
      </button>
      {open && (
        <div
          className="absolute right-0 top-5 z-30 flex w-56 flex-col gap-1 rounded-lg p-2"
          style={{ background: "#1f192a", boxShadow: "var(--shadow-card)" }}
        >
          <div className="max-h-40 overflow-y-auto">
            {names.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-[color:var(--color-text-muted)]">
                Nenhuma variável registrada.
              </p>
            )}
            {names.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => pick(n)}
                className="block w-full rounded px-2 py-1 text-left text-xs text-white hover:bg-[#272333]"
              >
                {`{{${n}}}`}
              </button>
            ))}
          </div>
          <div className="flex gap-1 border-t border-white/10 pt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createAndPick();
                }
              }}
              placeholder="NOVA_VAR"
              className="min-w-0 flex-1 rounded bg-transparent px-2 py-1 text-xs text-white outline-none"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}
            />
            <button
              type="button"
              onClick={createAndPick}
              className="rounded px-2 text-xs text-white"
              style={{ background: "#da2128" }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editor de estágio ───────────────────────────────────────────────────────

function StageEditor() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const selectedStageId = useFlowV2Store((s) => s.selectedStageId);
  const updateStage = useFlowV2Store((s) => s.updateStage);
  const removeStage = useFlowV2Store((s) => s.removeStage);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const stage = useMemo(
    () => flow.stages.find((s) => s.id === selectedStageId),
    [flow.stages, selectedStageId],
  );

  const stageIds = useMemo(
    () => flow.stages.map((s) => s.id).filter((id) => id !== stage?.id),
    [flow.stages, stage?.id],
  );

  if (!stage) {
    return (
      <div className="p-6 text-sm text-[color:var(--color-text-muted)]">
        Selecione um estágio à esquerda.
      </div>
    );
  }

  const patch = (p: Partial<V2Stage>) => updateStage(stage.id, p);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-white">Estágio</h2>
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={() => removeStage(stage.id)}
          disabled={flow.stages.length <= 1}
        >
          <Trash2 className="size-3.5" /> Remover
        </TotumButton>
      </div>

      <Field label="ID (identificador do estágio)">
        <Input value={stage.id} onChange={(e) => patch({ id: e.target.value })} />
      </Field>
      <Field label="Goal (objetivo do estágio)">
        <Textarea
          value={stage.goal ?? ""}
          onChange={(e) => patch({ goal: e.target.value })}
          rows={2}
        />
      </Field>
      <Field
        label="Instruction (como o modelo conduz)"
        action={
          <PlaceholderPicker
            onInsert={(text) =>
              patch({
                instruction: (() => {
                  const current = stage.instruction ?? "";
                  let next = current;
                  insertAtCursor(instructionRef.current, current, text, (v) => (next = v));
                  return next;
                })(),
              })
            }
          />
        }
      >
        <Textarea
          ref={instructionRef}
          value={stage.instruction ?? ""}
          onChange={(e) => patch({ instruction: e.target.value })}
          rows={4}
        />
      </Field>

      <StringListField
        label="Reference copy (exemplos de fala)"
        values={stage.reference_copy ?? []}
        onChange={(v) => patch({ reference_copy: v })}
        multiline
        withPlaceholderPicker
      />

      <StringListField
        label="Guardrails do estágio (opcional)"
        values={stage.guardrails ?? []}
        onChange={(v) => patch({ guardrails: v })}
        multiline
      />

      <ChipsField
        label="Actions"
        values={stage.actions ?? []}
        onChange={(v) => patch({ actions: v })}
        placeholder="ex: send_preview, book"
      />

      <Field label="Advance when (condição para avançar)">
        <Textarea
          value={stage.advance_when ?? ""}
          onChange={(e) => patch({ advance_when: e.target.value })}
          rows={2}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Next (próximo estágio)">
          <select
            value={stage.next ?? ""}
            onChange={(e) => patch({ next: e.target.value || undefined })}
            className="h-9 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#1f192a] px-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
          >
            <option value="">— (nenhum)</option>
            {stageIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </Field>
        <div
          className="flex items-end justify-between gap-2 rounded-xl px-4 py-2"
          style={{ background: "#1f192a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
        >
          <span className="text-sm text-white">Terminal</span>
          <Switch
            checked={Boolean(stage.terminal)}
            onCheckedChange={(v) => patch({ terminal: v || undefined })}
          />
        </div>
      </div>

      {stage.terminal && (
        <Field label="Report (id do schema de report)">
          <Input value={stage.report ?? ""} onChange={(e) => patch({ report: e.target.value })} />
        </Field>
      )}
    </div>
  );
}

// ─── Editor de interrupções ──────────────────────────────────────────────────

function InterruptsEditor() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const updateInterrupt = useFlowV2Store((s) => s.updateInterrupt);
  const addInterrupt = useFlowV2Store((s) => s.addInterrupt);
  const removeInterrupt = useFlowV2Store((s) => s.removeInterrupt);
  const interrupts = flow.interrupts ?? [];
  const stageIds = useMemo(() => flow.stages.map((s) => s.id), [flow.stages]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-white">Interrupções</h2>
        <TotumButton variant="outline" size="sm" onClick={addInterrupt}>
          <Plus className="size-3.5" /> Nova
        </TotumButton>
      </div>

      {interrupts.length === 0 && (
        <p className="text-sm text-[color:var(--color-text-muted)]">Nenhuma interrupção.</p>
      )}

      {interrupts.map((it) => (
        <div
          key={it.id}
          className="flex flex-col gap-4 rounded-2xl p-5"
          style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between">
            <Input
              value={it.id}
              onChange={(e) => updateInterrupt(it.id, { id: e.target.value })}
              className="max-w-[240px]"
            />
            <TotumButton variant="ghost" size="sm" onClick={() => removeInterrupt(it.id)}>
              <Trash2 className="size-3.5" />
            </TotumButton>
          </div>
          <Field label="Trigger (quando dispara)">
            <Textarea
              value={it.trigger ?? ""}
              onChange={(e) => updateInterrupt(it.id, { trigger: e.target.value })}
              rows={2}
            />
          </Field>
          <Field label="Handler instruction (como tratar)">
            <Textarea
              value={it.handler_instruction ?? ""}
              onChange={(e) => updateInterrupt(it.id, { handler_instruction: e.target.value })}
              rows={3}
            />
          </Field>
          <ChipsField
            label="Categories"
            values={it.categories ?? []}
            onChange={(v) => updateInterrupt(it.id, { categories: v })}
            placeholder="ex: preco, tempo"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max iterations">
              <Input
                type="number"
                min={0}
                value={it.max_iterations ?? 0}
                onChange={(e) => updateInterrupt(it.id, { max_iterations: Number(e.target.value) })}
              />
            </Field>
            <Field label="Return (estágio de origem)">
              <Input
                value={it.return ?? ""}
                onChange={(e) => updateInterrupt(it.id, { return: e.target.value })}
              />
            </Field>
          </div>
          <Field label="On exceed → goto">
            <select
              value={it.on_exceed?.goto ?? ""}
              onChange={(e) =>
                updateInterrupt(it.id, {
                  on_exceed: { ...(it.on_exceed ?? {}), goto: e.target.value || undefined },
                })
              }
              className="h-9 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#1f192a] px-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
            >
              <option value="">— (nenhum)</option>
              {stageIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </Field>
          {it.on_exceed?.set && (
            <p className="text-[11px] text-[color:var(--color-text-muted)]">
              on_exceed.set preservado: <code>{JSON.stringify(it.on_exceed.set)}</code>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Painel global ───────────────────────────────────────────────────────────

function GlobalsPanel() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const patchGlobals = useFlowV2Store((s) => s.patchGlobals);
  const patchMeta = useFlowV2Store((s) => s.patchMeta);
  const g = flow.globals;
  const h = g.humanization;
  const setH = (p: Partial<typeof h>) => patchGlobals({ humanization: { ...h, ...p } });
  const md = g.model_defaults;
  const setMd = (p: Partial<typeof md>) => patchGlobals({ model_defaults: { ...md, ...p } });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h2 className="text-lg text-white">Configurações globais</h2>

      <Field label="Objetivo do flow">
        <Textarea
          value={flow.objective ?? ""}
          onChange={(e) => patchMeta({ objective: e.target.value })}
          rows={2}
        />
      </Field>

      <section
        className="flex flex-col gap-4 rounded-2xl p-5"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <h3 className="text-sm text-white">Humanização</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Typing wpm">
            <Input
              type="number"
              value={h.typing_wpm}
              onChange={(e) => setH({ typing_wpm: Number(e.target.value) })}
            />
          </Field>
          <Field label="Reading wpm">
            <Input
              type="number"
              value={h.reading_wpm}
              onChange={(e) => setH({ reading_wpm: Number(e.target.value) })}
            />
          </Field>
          <Field label="Máx. consecutivas">
            <Input
              type="number"
              value={h.max_consecutive}
              onChange={(e) => setH({ max_consecutive: Number(e.target.value) })}
            />
          </Field>
          <Field label="Typing indicator">
            <Input
              value={h.typing_indicator}
              onChange={(e) => setH({ typing_indicator: e.target.value })}
            />
          </Field>
          <Field label="Quiet hours (início)">
            <Input
              value={h.quiet_hours?.[0] ?? ""}
              onChange={(e) => setH({ quiet_hours: [e.target.value, h.quiet_hours?.[1] ?? ""] })}
            />
          </Field>
          <Field label="Quiet hours (fim)">
            <Input
              value={h.quiet_hours?.[1] ?? ""}
              onChange={(e) => setH({ quiet_hours: [h.quiet_hours?.[0] ?? "", e.target.value] })}
            />
          </Field>
          <Field label="Timezone">
            <Input value={h.timezone} onChange={(e) => setH({ timezone: e.target.value })} />
          </Field>
        </div>
      </section>

      <section
        className="flex flex-col gap-4 rounded-2xl p-5"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <h3 className="text-sm text-white">Modelos padrão</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Generator">
            <Input value={md.generator} onChange={(e) => setMd({ generator: e.target.value })} />
          </Field>
          <Field label="Classifier">
            <Input value={md.classifier} onChange={(e) => setMd({ classifier: e.target.value })} />
          </Field>
        </div>
      </section>

      <section
        className="flex flex-col gap-3 rounded-2xl p-5"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <h3 className="text-sm text-white">Guardrails globais</h3>
        <StringListField
          label=""
          values={g.guardrails ?? []}
          onChange={(v) => patchGlobals({ guardrails: v })}
          multiline
        />
      </section>
    </div>
  );
}

// ─── Bloco Pesquisa (variáveis de pesquisa do lead) ─────────────────────────

function PesquisaPanel() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const setRequiredVariable = useFlowV2Store((s) => s.setRequiredVariable);
  const setVariableDescription = useFlowV2Store((s) => s.setVariableDescription);
  const removeVariable = useFlowV2Store((s) => s.removeVariable);
  const createPlaceholder = useFlowV2Store((s) => s.createPlaceholder);
  const [draft, setDraft] = useState("");

  const required = new Set(flow.required_variables ?? []);
  const names = new Set([...Object.keys(flow.variables ?? {}), ...required]);

  const usedNotRegistered = useMemo(() => {
    const registered = registeredVariableNames(flow);
    const used = new Set<string>();
    for (const st of flow.stages) for (const p of extractPlaceholders(st)) used.add(p);
    return [...used].filter((p) => !registered.has(p));
  }, [flow]);

  function addVariable() {
    const name = draft
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");
    if (!name) return;
    createPlaceholder(name);
    setDraft("");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg text-white">Pesquisa</h2>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          Variáveis de pesquisa do lead que o flow exige (ex: QTD_AVALIACOES, CONCORRENTE_1). Não
          vira estágio de conversa — o motor aborta o disparo se uma variável obrigatória faltar.
        </p>
      </div>

      {usedNotRegistered.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-xs"
          style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Usados na copy mas não registrados aqui:{" "}
            {usedNotRegistered.map((p) => `{{${p}}}`).join(", ")}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {[...names].map((name) => (
          <div
            key={name}
            className="flex flex-col gap-2 rounded-xl p-4"
            style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm text-white">{`{{${name}}}`}</code>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
                  <Switch
                    checked={required.has(name)}
                    onCheckedChange={(v) => setRequiredVariable(name, v)}
                  />
                  Obrigatória
                </label>
                <button
                  onClick={() => removeVariable(name)}
                  className="text-[color:var(--color-text-muted)] hover:text-white"
                  title="Remover"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
            <Input
              placeholder="Descrição (o que essa variável representa)"
              value={flow.variable_descriptions?.[name] ?? ""}
              onChange={(e) => setVariableDescription(name, e.target.value)}
            />
          </div>
        ))}
        {names.size === 0 && (
          <p className="text-sm text-[color:var(--color-text-muted)]">Nenhuma variável ainda.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addVariable();
            }
          }}
          placeholder="NOVA_VARIAVEL"
        />
        <TotumButton variant="outline" size="md" onClick={addVariable} type="button">
          <Plus className="size-4" /> Adicionar
        </TotumButton>
      </div>
    </div>
  );
}

// ─── Simulação (motor v3) ─────────────────────────────────────────────────────

function SimulationOverlay({ onClose }: { onClose: () => void }) {
  const flow = useFlowV2Store((s) => s.flow)!;
  const exportToJSON = useFlowV2Store((s) => s.exportToJSON);
  const [llm, setLlm] = useState<"mock" | "real">("mock");

  const statusQuery = useQuery({
    queryKey: ["sim-v3-status"],
    queryFn: () => api.getSimV3Status(),
    retry: false,
  });

  const runMut = useMutation({
    mutationFn: () => api.runSimulationV3({ flow: JSON.parse(exportToJSON()), llm }),
    onError: (e) => toast.error(`Erro ao simular: ${(e as Error).message}`),
  });

  const realAvailable = Boolean(statusQuery.data?.realLlmConfigured);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-2xl p-6"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg text-white">Simular</h2>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Roda as 3 personas (interessado, cético, secretária) contra o flow atual do canvas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--color-text-muted)] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1 rounded-full p-1"
            style={{ background: "#1f192a" }}
          >
            <button
              onClick={() => setLlm("mock")}
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: llm === "mock" ? "#da2128" : "transparent",
                color: llm === "mock" ? "#fff" : "#9ca3af",
              }}
            >
              Modo A · Mock
            </button>
            <button
              onClick={() => setLlm("real")}
              disabled={!realAvailable}
              title={realAvailable ? "" : "Motor sem GROQ_API_KEY/NVIDIA_API_KEY configurada"}
              className="rounded-full px-3 py-1 text-xs disabled:opacity-40"
              style={{
                background: llm === "real" ? "#da2128" : "transparent",
                color: llm === "real" ? "#fff" : "#9ca3af",
              }}
            >
              Modo B · LLM real
            </button>
          </div>
          <TotumButton
            variant="primary"
            size="sm"
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
          >
            <PlayCircle className="size-3.5" /> {runMut.isPending ? "Rodando…" : "Rodar simulação"}
          </TotumButton>
        </div>

        <div className="flex-1 overflow-y-auto">
          {statusQuery.isError && (
            <p className="text-xs text-[#f59e0b]">
              Motor v3 indisponível (proxy /api/engine-v3 não configurado ou motor offline).
            </p>
          )}
          {!runMut.data && !runMut.isPending && (
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Flow atual: {flow.stages.length} estágios. Clique em "Rodar simulação".
            </p>
          )}
          {runMut.data?.results.map((r) => (
            <div
              key={r.id}
              className="mb-3 flex flex-col gap-2 rounded-xl p-4"
              style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">{r.label}</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: r.passed ? "rgba(53,166,112,0.15)" : "rgba(217,22,22,0.15)",
                    color: r.passed ? "#35a670" : "#d91616",
                  }}
                >
                  {r.passed ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                  {r.passed ? "PASSOU" : "FALHOU"}
                </span>
              </div>
              <p className="text-[11px] text-[color:var(--color-text-muted)]">
                desfecho={r.status} stage={r.stage} temp={r.temperatura} trocas={r.trocas}
              </p>
              <div
                className="max-h-40 overflow-y-auto rounded-lg p-3 text-xs leading-relaxed text-[#d1cece]"
                style={{ background: "#1f192a", fontFamily: "ui-monospace, Menlo, monospace" }}
              >
                {r.transcript.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
              {r.violations.length > 0 && (
                <ul className="text-[11px] text-[#f59e0b]">
                  {r.violations.map((v, i) => (
                    <li key={i}>⚠️ {v}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Legacy v1 (read-only) ───────────────────────────────────────────────────

function LegacyOverlay({ summary, onClose }: { summary: V1LegacySummary; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-2xl p-6"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg text-white">Legado v1 (somente leitura)</h2>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {summary.flowId} · v{summary.version} · {summary.nodeCount} nós · entry:{" "}
              {summary.entry}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--color-text-muted)] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="text-xs text-[color:var(--color-text-muted)]">
          O formato de trabalho é o v2 (estágios). O v1 é mostrado só para consulta — não é editável
          aqui.
        </p>
        <div
          className="flex-1 overflow-y-auto rounded-xl"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0" style={{ background: "#0e0918" }}>
              <tr className="text-[color:var(--color-text-muted)]">
                <th className="px-3 py-2">id</th>
                <th className="px-3 py-2">type</th>
                <th className="px-3 py-2">label</th>
              </tr>
            </thead>
            <tbody>
              {summary.nodes.map((n) => (
                <tr key={n.id} style={{ boxShadow: "inset 0 -1px 0 0 rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-1.5 text-white">{n.id}</td>
                  <td className="px-3 py-1.5 text-[color:var(--color-text-muted)]">{n.type}</td>
                  <td className="px-3 py-1.5 text-[color:var(--color-text-muted)]">{n.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Primitivos de form ──────────────────────────────────────────────────────

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(label || action) && (
        <div className="flex items-center justify-between">
          {label && <Label className="text-xs text-[color:var(--color-text-muted)]">{label}</Label>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function StringListField({
  label,
  values,
  onChange,
  multiline,
  withPlaceholderPicker,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  multiline?: boolean;
  withPlaceholderPicker?: boolean;
}) {
  const refs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const update = (i: number, val: string) =>
    onChange(values.map((v, idx) => (idx === i ? val : v)));
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const add = () => onChange([...values, ""]);
  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        {values.map((v, i) => (
          <div key={`${i}-${v.slice(0, 16)}`} className="flex flex-col gap-1">
            {withPlaceholderPicker && (
              <div className="flex justify-end">
                <PlaceholderPicker
                  onInsert={(text) => {
                    let next = v;
                    insertAtCursor(refs.current[i] ?? null, v, text, (nv) => (next = nv));
                    update(i, next);
                  }}
                />
              </div>
            )}
            <div className="flex gap-2">
              {multiline ? (
                <Textarea
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  value={v}
                  onChange={(e) => update(i, e.target.value)}
                  rows={2}
                  className="flex-1"
                />
              ) : (
                <Input value={v} onChange={(e) => update(i, e.target.value)} className="flex-1" />
              )}
              <button
                onClick={() => remove(i)}
                className="self-start pt-2 text-[color:var(--color-text-muted)] hover:text-white"
                title="Remover"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        <TotumButton variant="outline" size="sm" onClick={add} className="self-start">
          <Plus className="size-3.5" /> Adicionar
        </TotumButton>
      </div>
    </Field>
  );
}

function ChipsField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <TotumButton variant="outline" size="md" onClick={add} type="button">
            <Plus className="size-4" />
          </TotumButton>
        </div>
        {values.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                style={{
                  background: "#1f192a",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              >
                {v}
                <button
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  className="text-[color:var(--color-text-muted)] hover:text-white"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}
