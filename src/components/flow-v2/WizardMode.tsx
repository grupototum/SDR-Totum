/**
 * WizardMode.tsx — modo guiado passo-a-passo para construir o MESMO FlowV2
 * que o Builder edita. Mutaciona useFlowV2Store, então alternar modos
 * (Wizard|Builder) não perde nada.
 *
 * Passos:
 *  1. Identidade (nome, objetivo)
 *  2. Estágios (lista ordenada, add/remove/rename, marca entry)
 *  3. Conteúdo por estágio (goal, instruction, advance_when, next)
 *  4. Interrupções (objeções/loops)
 *  5. Revisão
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Flag, GripVertical, Check } from "lucide-react";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STEPS = [
  "Identidade",
  "Estágios",
  "Conteúdo por estágio",
  "Interrupções",
  "Revisão",
] as const;

export function WizardMode() {
  const [step, setStep] = useState(0);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "#0e0918" }}>
      <Stepper step={step} onStep={setStep} />
      <div className="flex-1 overflow-y-auto">
        {step === 0 && <StepIdentity />}
        {step === 1 && <StepStages />}
        {step === 2 && <StepContent />}
        {step === 3 && <StepInterrupts />}
        {step === 4 && <StepReview />}
      </div>
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ boxShadow: "inset 0 1px 0 0 #1f192a", background: "var(--color-card-totum)" }}
      >
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="size-3.5" /> Voltar
        </TotumButton>
        <span className="text-[11px] text-[color:var(--color-text-muted)]">
          Passo {step + 1} de {STEPS.length}
        </span>
        <TotumButton
          variant="primary"
          size="sm"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
        >
          Próximo <ChevronRight className="size-3.5" />
        </TotumButton>
      </div>
    </div>
  );
}

function Stepper({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  return (
    <div
      className="flex gap-1 px-6 py-4"
      style={{ background: "var(--color-card-totum)", boxShadow: "inset 0 -1px 0 0 #1f192a" }}
    >
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <button
            key={label}
            onClick={() => onStep(i)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-[11px] transition-colors",
              active
                ? "text-white"
                : done
                  ? "text-[#35a670]"
                  : "text-[color:var(--color-text-muted)] hover:text-white",
            )}
            style={
              active
                ? {
                    background:
                      "linear-gradient(135deg, rgba(227,67,62,0.22), rgba(218,33,40,0.22))",
                    boxShadow: "inset 0 0 0 1px rgba(218,33,40,0.45)",
                  }
                : done
                  ? { background: "rgba(53,166,112,0.10)" }
                  : { background: "#1f192a" }
            }
          >
            {done && <Check className="mr-1 inline size-3" />}
            {i + 1}. {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Passo 1: Identidade ─────────────────────────────────────────────────────
function StepIdentity() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const patchMeta = useFlowV2Store((s) => s.patchMeta);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-8">
      <h2 className="text-lg text-white">Como vamos chamar este fluxo?</h2>
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Dê um nome curto e descreva o objetivo. Isso é a "capa" que aparece na lista de fluxos.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">Nome do fluxo</Label>
        <Input
          value={flow.name}
          onChange={(e) => patchMeta({ name: e.target.value })}
          placeholder="Ex: SDR Odonto v2"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">
          Objetivo (uma frase — o que o bot precisa conseguir?)
        </Label>
        <Textarea
          value={flow.objective ?? ""}
          onChange={(e) => patchMeta({ objective: e.target.value })}
          rows={3}
          placeholder="Ex: Marcar reunião com donos de clínicas odontológicas qualificadas."
        />
      </div>
      <p className="text-xs text-[color:var(--color-text-muted)]">
        Versão atual: <code className="text-white">{flow.version}</code> · ID:{" "}
        <code className="text-white">{flow.flow_id}</code>
      </p>
    </div>
  );
}

// ─── Passo 2: Estágios ───────────────────────────────────────────────────────
function StepStages() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const addStage = useFlowV2Store((s) => s.addStage);
  const removeStage = useFlowV2Store((s) => s.removeStage);
  const updateStage = useFlowV2Store((s) => s.updateStage);
  const moveStage = useFlowV2Store((s) => s.moveStage);
  const patchEntry = (id: string) =>
    useFlowV2Store.setState((s) => (s.flow ? { flow: { ...s.flow, entry_stage: id } } : s));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg text-white">Quais estágios o bot vai passar?</h2>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Pense em "etapas" da conversa. Marque o ponto de partida (entry).
          </p>
        </div>
        <TotumButton variant="outline" size="sm" onClick={addStage}>
          <Plus className="size-3.5" /> Novo estágio
        </TotumButton>
      </div>

      <div className="flex flex-col gap-2">
        {flow.stages.map((st, i) => {
          const isEntry = flow.entry_stage === st.id;
          return (
            <div
              key={st.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                background: "#1b1728",
                boxShadow: isEntry ? "inset 0 0 0 1px rgba(218,33,40,0.45)" : "var(--shadow-card)",
              }}
            >
              <div className="flex flex-col text-[color:var(--color-text-muted)]">
                <button
                  onClick={() => moveStage(st.id, -1)}
                  disabled={i === 0}
                  className="hover:text-white disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveStage(st.id, 1)}
                  disabled={i === flow.stages.length - 1}
                  className="hover:text-white disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <GripVertical className="size-3.5 text-[color:var(--color-text-muted)]" />
              <Input
                value={st.id}
                onChange={(e) => updateStage(st.id, { id: e.target.value })}
                className="flex-1"
              />
              <button
                onClick={() => patchEntry(st.id)}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] transition-colors",
                  isEntry
                    ? "text-white"
                    : "text-[color:var(--color-text-muted)] hover:text-white",
                )}
                style={{
                  background: isEntry ? "rgba(218,33,40,0.25)" : "#1f192a",
                }}
                title="Marcar como entry stage"
              >
                {isEntry ? "✓ entry" : "entry"}
              </button>
              <button
                onClick={() => updateStage(st.id, { terminal: !st.terminal || undefined })}
                className="rounded-full px-2 py-1 text-[10px]"
                style={{
                  background: st.terminal ? "rgba(53,166,112,0.20)" : "#1f192a",
                  color: st.terminal ? "#35a670" : "#9ca3af",
                }}
              >
                <Flag className="inline size-3" /> terminal
              </button>
              <button
                onClick={() => removeStage(st.id)}
                disabled={flow.stages.length <= 1}
                className="text-[color:var(--color-text-muted)] hover:text-[#da2128] disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Passo 3: Conteúdo por estágio ───────────────────────────────────────────
function StepContent() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const updateStage = useFlowV2Store((s) => s.updateStage);
  const [idx, setIdx] = useState(0);
  const stage = flow.stages[idx];
  if (!stage) return null;
  const stageIds = flow.stages.map((s) => s.id).filter((id) => id !== stage.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-white">
          Estágio {idx + 1}/{flow.stages.length}:{" "}
          <span className="text-[#e3433e]">{stage.id}</span>
        </h2>
        <div className="flex gap-2">
          <button
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
            className="text-[color:var(--color-text-muted)] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            disabled={idx === flow.stages.length - 1}
            onClick={() => setIdx((i) => i + 1)}
            className="text-[color:var(--color-text-muted)] hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">
          Objetivo deste estágio (uma frase)
        </Label>
        <Textarea
          value={stage.goal ?? ""}
          onChange={(e) => updateStage(stage.id, { goal: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">
          Como o bot deve conduzir (instrução para o modelo)
        </Label>
        <Textarea
          value={stage.instruction ?? ""}
          onChange={(e) => updateStage(stage.id, { instruction: e.target.value })}
          rows={5}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">
          Quando avançar para o próximo (condição em linguagem natural)
        </Label>
        <Textarea
          value={stage.advance_when ?? ""}
          onChange={(e) => updateStage(stage.id, { advance_when: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">Próximo estágio</Label>
        <select
          value={stage.next ?? ""}
          onChange={(e) => updateStage(stage.id, { next: e.target.value || undefined })}
          className="h-9 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#1f192a] px-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
        >
          <option value="">— (nenhum / terminal)</option>
          {stageIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Passo 4: Interrupções ───────────────────────────────────────────────────
function StepInterrupts() {
  const flow = useFlowV2Store((s) => s.flow)!;
  const addInterrupt = useFlowV2Store((s) => s.addInterrupt);
  const updateInterrupt = useFlowV2Store((s) => s.updateInterrupt);
  const removeInterrupt = useFlowV2Store((s) => s.removeInterrupt);
  const interrupts = flow.interrupts ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg text-white">Interrupções (objeções e desvios)</h2>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Situações em que o lead "sai do trilho" e o bot precisa responder antes de voltar.
          </p>
        </div>
        <TotumButton variant="outline" size="sm" onClick={addInterrupt}>
          <Plus className="size-3.5" /> Nova
        </TotumButton>
      </div>

      {interrupts.length === 0 && (
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Nenhuma interrupção configurada. Tudo bem — comece sem nenhuma e adicione conforme aparece
          nas conversas reais.
        </p>
      )}

      {interrupts.map((it) => (
        <div
          key={it.id}
          className="flex flex-col gap-3 rounded-xl p-4"
          style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2">
            <Input
              value={it.id}
              onChange={(e) => updateInterrupt(it.id, { id: e.target.value })}
              className="max-w-[240px]"
            />
            <button
              onClick={() => removeInterrupt(it.id)}
              className="ml-auto text-[color:var(--color-text-muted)] hover:text-[#da2128]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <Textarea
            value={it.trigger ?? ""}
            onChange={(e) => updateInterrupt(it.id, { trigger: e.target.value })}
            rows={2}
            placeholder="Quando dispara (ex: lead pergunta preço)"
          />
          <Textarea
            value={it.handler_instruction ?? ""}
            onChange={(e) => updateInterrupt(it.id, { handler_instruction: e.target.value })}
            rows={3}
            placeholder="Como o bot trata"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Passo 5: Revisão ────────────────────────────────────────────────────────
function StepReview() {
  const flow = useFlowV2Store((s) => s.flow)!;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h2 className="text-lg text-white">Revisão</h2>
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Confira o resumo. Use o botão "Salvar" ou "Publicar" no topo para persistir.
      </p>
      <div
        className="grid grid-cols-2 gap-3 rounded-xl p-4 text-sm"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <Cell label="Nome" value={flow.name} />
        <Cell label="Versão" value={flow.version} />
        <Cell label="Entry" value={flow.entry_stage} />
        <Cell label="Estágios" value={String(flow.stages.length)} />
        <Cell label="Interrupções" value={String(flow.interrupts?.length ?? 0)} />
        <Cell label="Vars requeridas" value={String(flow.required_variables?.length ?? 0)} />
      </div>
      <div
        className="flex flex-col gap-2 rounded-xl p-4 text-sm"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <span className="text-xs text-[color:var(--color-text-muted)]">Roteiro</span>
        <ol className="ml-5 list-decimal text-white">
          {flow.stages.map((s) => (
            <li key={s.id}>
              <span className="text-white">{s.id}</span>
              {s.terminal && <span className="ml-2 text-[#35a670]">(terminal)</span>}
              <span className="ml-2 text-[color:var(--color-text-muted)]">— {s.goal}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-white">{value}</div>
    </div>
  );
}
