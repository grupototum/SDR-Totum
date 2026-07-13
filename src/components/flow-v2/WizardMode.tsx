/**
 * WizardMode.tsx — wizard guiado para criar um flow v2 por etapas.
 * Popula o flow-v2-store (mesma fonte de verdade que o Builder).
 * Trocar para o modo Builder após o wizard preserva tudo.
 */
import { useState } from "react";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import type { FlowV2, V2Stage, V2Interrupt } from "@/lib/flow-v2";
import flowV2Default from "../../../docs/flow_odonto_stages_v2.json";

const STEP_LABELS = ["Identidade", "Estágios", "Conteúdo", "Interrupções", "Revisão"];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex size-6 items-center justify-center rounded-full text-[11px] font-medium"
            style={{
              background: i < current ? "#35a670" : i === current ? "#da2128" : "#eef0f3",
              color: i <= current ? "#fff" : "#6b7280",
            }}
          >
            {i < current ? <Check className="size-3" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className="h-px w-8" style={{ background: i < current ? "#35a670" : "#eef0f3" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: identidade ──────────────────────────────────────────────────────

function Step1({
  name,
  setName,
  objective,
  setObjective,
  niche,
  setNiche,
  guardrails,
  setGuardrails,
}: {
  name: string;
  setName: (v: string) => void;
  objective: string;
  setObjective: (v: string) => void;
  niche: string;
  setNiche: (v: string) => void;
  guardrails: string;
  setGuardrails: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg text-[#111827]">Identidade do flow</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Nome, nicho e objetivo. O Builder edita os detalhes finos depois.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[#6b7280]">Nome do flow *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Odonto SDR v2"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[#6b7280]">Nicho</Label>
        <Input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="ex: Odontologia"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[#6b7280]">Objetivo do flow</Label>
        <Textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          placeholder="O que o SDR deve conseguir com esse flow?"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[#6b7280]">Guardrails globais (uma regra por linha)</Label>
        <Textarea
          value={guardrails}
          onChange={(e) => setGuardrails(e.target.value)}
          rows={3}
          placeholder="ex: Nunca falar preço antes da prévia"
        />
      </div>
    </div>
  );
}

// ── Step 2: estágios ────────────────────────────────────────────────────────

type DraftStage = {
  id: string;
  goal: string;
  instruction: string;
  advance_when?: string;
  reference_copy?: string;
};

function Step2({
  stages,
  setStages,
}: {
  stages: DraftStage[];
  setStages: (s: DraftStage[]) => void;
}) {
  const add = () =>
    setStages([...stages, { id: `estagio_${stages.length + 1}`, goal: "", instruction: "" }]);
  const remove = (i: number) => setStages(stages.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<DraftStage>) =>
    setStages(stages.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg text-[#111827]">Estágios do flow</h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Cada estágio é um objetivo de conversa. Adicione o suficiente para cobrir o fluxo.
          </p>
        </div>
        <TotumButton variant="outline" size="sm" onClick={add}>
          <Plus className="size-3.5" /> Adicionar
        </TotumButton>
      </div>
      {stages.length === 0 && (
        <p className="text-sm text-[#6b7280]">
          Nenhum estágio ainda. Clique em "Adicionar" para começar.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {stages.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: "#ffffff", boxShadow: "0 1px 3px rgba(16,24,40,0.12)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6b7280] w-5">{i + 1}</span>
              <Input
                value={s.id}
                onChange={(e) => patch(i, { id: e.target.value })}
                placeholder="ID do estágio"
                className="flex-1"
              />
              <button
                onClick={() => remove(i)}
                className="text-[#6b7280] hover:text-[#111827]"
                title="Remover"
                disabled={stages.length <= 1}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 pl-7">
              <Label className="text-[10px] text-[#6b7280]">Objetivo</Label>
              <Input
                value={s.goal}
                onChange={(e) => patch(i, { goal: e.target.value })}
                placeholder="O que o bot deve alcançar neste estágio?"
              />
            </div>
            <div className="flex flex-col gap-1.5 pl-7">
              <Label className="text-[10px] text-[#6b7280]">Instrução (como conduzir)</Label>
              <Textarea
                value={s.instruction}
                onChange={(e) => patch(i, { instruction: e.target.value })}
                rows={2}
                placeholder="Como o SDR deve se comportar neste estágio?"
              />
            </div>
            <div className="flex flex-col gap-1.5 pl-7">
              <Label className="text-[10px] text-[#6b7280]">
                Advance when (condição para avançar)
              </Label>
              <Input
                value={s.advance_when ?? ""}
                onChange={(e) => patch(i, { advance_when: e.target.value })}
                placeholder="ex: o lead confirmou interesse na prévia"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: conteúdo (reference_copy por estágio) ───────────────────────────

function Step3({
  stages,
  setStages,
}: {
  stages: DraftStage[];
  setStages: (s: DraftStage[]) => void;
}) {
  const patchCopy = (i: number, val: string) =>
    setStages(stages.map((s, idx) => (idx === i ? { ...s, reference_copy: val } : s)));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg text-[#111827]">Conteúdo de referência</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Exemplos de mensagem / copy para cada estágio. Opcional — pode preencher depois no
          Builder.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {stages.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl p-4"
            style={{ background: "#ffffff", boxShadow: "0 1px 3px rgba(16,24,40,0.12)" }}
          >
            <Label className="text-xs text-[#6b7280]">
              {i + 1}. {s.id}
              {s.goal && <span className="ml-1 opacity-60">— {s.goal}</span>}
            </Label>
            <Textarea
              value={s.reference_copy ?? ""}
              onChange={(e) => patchCopy(i, e.target.value)}
              rows={2}
              placeholder="Exemplos de mensagens que o SDR pode enviar neste estágio…"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 4: interrupções ─────────────────────────────────────────────────────

type DraftInterrupt = { id: string; trigger: string; handler_instruction: string };

function Step4({
  interrupts,
  setInterrupts,
}: {
  interrupts: DraftInterrupt[];
  setInterrupts: (v: DraftInterrupt[]) => void;
}) {
  const add = () =>
    setInterrupts([
      ...interrupts,
      { id: `interrupcao_${interrupts.length + 1}`, trigger: "", handler_instruction: "" },
    ]);
  const remove = (i: number) => setInterrupts(interrupts.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<DraftInterrupt>) =>
    setInterrupts(interrupts.map((v, idx) => (idx === i ? { ...v, ...p } : v)));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg text-[#111827]">Interrupções</h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Situações que desviam do fluxo normal (ex: objeção de preço, "já tenho dentista").
            Opcional.
          </p>
        </div>
        <TotumButton variant="outline" size="sm" onClick={add}>
          <Plus className="size-3.5" /> Adicionar
        </TotumButton>
      </div>
      {interrupts.length === 0 && (
        <p className="text-sm text-[#6b7280]">
          Nenhuma interrupção. Você pode adicionar depois no Builder.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {interrupts.map((v, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: "#ffffff", boxShadow: "0 1px 3px rgba(16,24,40,0.12)" }}
          >
            <div className="flex items-center gap-2">
              <Input
                value={v.id}
                onChange={(e) => patch(i, { id: e.target.value })}
                placeholder="ID da interrupção"
                className="flex-1"
              />
              <button onClick={() => remove(i)} className="text-[#6b7280] hover:text-[#111827]">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] text-[#6b7280]">Gatilho (quando ativar)</Label>
              <Input
                value={v.trigger}
                onChange={(e) => patch(i, { trigger: e.target.value })}
                placeholder="ex: lead menciona preço ou concorrente"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] text-[#6b7280]">Instrução de tratamento</Label>
              <Textarea
                value={v.handler_instruction}
                onChange={(e) => patch(i, { handler_instruction: e.target.value })}
                rows={2}
                placeholder="Como o SDR deve responder quando isso acontecer?"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 5: revisão ─────────────────────────────────────────────────────────

function Step5({
  name,
  niche,
  objective,
  stages,
  interrupts,
}: {
  name: string;
  niche: string;
  objective: string;
  stages: DraftStage[];
  interrupts: DraftInterrupt[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg text-[#111827]">Revisão</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Confirme e crie o flow. Você pode editar tudo no Builder depois.
        </p>
      </div>
      <div
        className="flex flex-col gap-3 rounded-2xl p-5"
        style={{ background: "#ffffff", boxShadow: "0 1px 3px rgba(16,24,40,0.12)" }}
      >
        <div>
          <p className="text-xs text-[#6b7280]">Nome</p>
          <p className="text-sm text-[#111827]">{name || "—"}</p>
        </div>
        {niche && (
          <div>
            <p className="text-xs text-[#6b7280]">Nicho</p>
            <p className="text-sm text-[#111827]">{niche}</p>
          </div>
        )}
        {objective && (
          <div>
            <p className="text-xs text-[#6b7280]">Objetivo</p>
            <p className="text-sm text-[#111827]">{objective}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-[#6b7280]">Estágios ({stages.length})</p>
          <ul className="mt-1 flex flex-col gap-1">
            {stages.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-[10px] text-[#6b7280]">{i + 1}.</span>
                <span className="text-[#111827]">{s.id}</span>
                {s.goal && <span className="text-[11px] text-[#6b7280] truncate">— {s.goal}</span>}
              </li>
            ))}
          </ul>
        </div>
        {interrupts.length > 0 && (
          <div>
            <p className="text-xs text-[#6b7280]">Interrupções ({interrupts.length})</p>
            <ul className="mt-1 flex flex-col gap-1">
              {interrupts.map((v, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="text-[10px] text-[#6b7280]">{i + 1}.</span>
                  <span className="text-[#111827]">{v.id}</span>
                  {v.trigger && (
                    <span className="text-[11px] text-[#6b7280] truncate">— {v.trigger}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────

export function WizardMode() {
  const setFlow = useFlowV2Store((s) => s.setFlow);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [objective, setObjective] = useState("");
  const [guardrails, setGuardrails] = useState("");
  const [stages, setStages] = useState<DraftStage[]>([
    { id: "abertura", goal: "", instruction: "" },
  ]);
  const [interrupts, setInterrupts] = useState<DraftInterrupt[]>([]);

  function applyToStore() {
    if (!name.trim()) {
      toast.error("Nome do flow é obrigatório.");
      return false;
    }
    if (stages.length === 0) {
      toast.error("Adicione pelo menos 1 estágio.");
      return false;
    }

    const base = flowV2Default as unknown as FlowV2;
    const v2Stages: V2Stage[] = stages.map((s, i) => ({
      id: s.id || `estagio_${i + 1}`,
      goal: s.goal,
      instruction: s.instruction,
      advance_when: s.advance_when || undefined,
      reference_copy: s.reference_copy
        ? s.reference_copy
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [],
      next: stages[i + 1]?.id,
      terminal: i === stages.length - 1 ? true : undefined,
    }));

    const v2Interrupts: V2Interrupt[] = interrupts.map((v) => ({
      id: v.id || `interrupcao`,
      trigger: v.trigger,
      handler_instruction: v.handler_instruction,
    }));

    const guardrailLines = guardrails
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const newFlow: FlowV2 = {
      ...base,
      flow_id: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      niche: niche || base.niche,
      objective,
      meta: { ...base.meta, authoring_mode: "copilot" },
      globals: {
        ...base.globals,
        guardrails: guardrailLines.length > 0 ? guardrailLines : (base.globals.guardrails ?? []),
      },
      entry_stage: v2Stages[0].id,
      stages: v2Stages,
      interrupts: v2Interrupts.length > 0 ? v2Interrupts : (base.interrupts ?? []),
    };

    setFlow(newFlow);
    toast.success("Flow criado no builder. Agora você pode editar os detalhes.");
    return true;
  }

  const canNext =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? stages.length > 0 && stages.every((s) => s.id.trim())
        : true;

  function next() {
    if (step === STEP_LABELS.length - 1) {
      applyToStore();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{ background: "#f6f7f9", minHeight: "calc(100vh - 56px)" }}
    >
      <div className="border-b border-[#e5e7eb] px-6 py-4">
        <StepIndicator current={step} total={STEP_LABELS.length} />
        <p className="mt-2 text-xs text-[#6b7280]">
          Passo {step + 1} de {STEP_LABELS.length}: {STEP_LABELS[step]}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-6 py-8">
          {step === 0 && (
            <Step1
              name={name}
              setName={setName}
              objective={objective}
              setObjective={setObjective}
              niche={niche}
              setNiche={setNiche}
              guardrails={guardrails}
              setGuardrails={setGuardrails}
            />
          )}
          {step === 1 && <Step2 stages={stages} setStages={setStages} />}
          {step === 2 && <Step3 stages={stages} setStages={setStages} />}
          {step === 3 && <Step4 interrupts={interrupts} setInterrupts={setInterrupts} />}
          {step === 4 && (
            <Step5
              name={name}
              niche={niche}
              objective={objective}
              stages={stages}
              interrupts={interrupts}
            />
          )}
        </div>
      </div>
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ boxShadow: "inset 0 1px 0 0 #e5e7eb" }}
      >
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="size-3.5" /> Voltar
        </TotumButton>
        <TotumButton variant="primary" size="sm" onClick={next} disabled={!canNext}>
          {step === STEP_LABELS.length - 1 ? (
            <>
              <Check className="size-3.5" /> Criar no builder
            </>
          ) : (
            <>
              Próximo <ChevronRight className="size-3.5" />
            </>
          )}
        </TotumButton>
      </div>
    </div>
  );
}
