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
import type { FlowV2, V2Stage } from "@/lib/flow-v2";
import flowV2Default from "../../../docs/flow_odonto_stages_v2.json";

const STEP_LABELS = ["Identidade", "Estágios", "Revisão"];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex size-6 items-center justify-center rounded-full text-[11px] font-medium"
            style={{
              background: i < current ? "#35a670" : i === current ? "#da2128" : "#272333",
              color: i <= current ? "#fff" : "#9ca3af",
            }}
          >
            {i < current ? <Check className="size-3" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className="h-px w-8" style={{ background: i < current ? "#35a670" : "#272333" }} />
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
}: {
  name: string;
  setName: (v: string) => void;
  objective: string;
  setObjective: (v: string) => void;
  niche: string;
  setNiche: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg text-white">Identidade do flow</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          Nome, nicho e objetivo. O Builder edita os detalhes finos depois.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">Nome do flow *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Odonto SDR v2"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">Nicho</Label>
        <Input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="ex: Odontologia"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[color:var(--color-text-muted)]">Objetivo do flow</Label>
        <Textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          placeholder="O que o SDR deve conseguir com esse flow?"
        />
      </div>
    </div>
  );
}

// ── Step 2: estágios ────────────────────────────────────────────────────────

type DraftStage = { id: string; goal: string; instruction: string };

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
          <h2 className="text-lg text-white">Estágios do flow</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
            Cada estágio é um objetivo de conversa. Adicione o suficiente para cobrir o fluxo.
          </p>
        </div>
        <TotumButton variant="outline" size="sm" onClick={add}>
          <Plus className="size-3.5" /> Adicionar
        </TotumButton>
      </div>
      {stages.length === 0 && (
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Nenhum estágio ainda. Clique em "Adicionar" para começar.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {stages.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--color-text-muted)] w-5">{i + 1}</span>
              <Input
                value={s.id}
                onChange={(e) => patch(i, { id: e.target.value })}
                placeholder="ID do estágio"
                className="flex-1"
              />
              <button
                onClick={() => remove(i)}
                className="text-[color:var(--color-text-muted)] hover:text-white"
                title="Remover"
                disabled={stages.length <= 1}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 pl-7">
              <Label className="text-[10px] text-[color:var(--color-text-muted)]">Objetivo</Label>
              <Input
                value={s.goal}
                onChange={(e) => patch(i, { goal: e.target.value })}
                placeholder="O que o bot deve alcançar neste estágio?"
              />
            </div>
            <div className="flex flex-col gap-1.5 pl-7">
              <Label className="text-[10px] text-[color:var(--color-text-muted)]">
                Instrução (como conduzir)
              </Label>
              <Textarea
                value={s.instruction}
                onChange={(e) => patch(i, { instruction: e.target.value })}
                rows={2}
                placeholder="Como o SDR deve se comportar neste estágio?"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: revisão ─────────────────────────────────────────────────────────

function Step3({
  name,
  niche,
  objective,
  stages,
}: {
  name: string;
  niche: string;
  objective: string;
  stages: DraftStage[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg text-white">Revisão</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          Confirme e crie o flow. Você pode editar tudo no Builder depois.
        </p>
      </div>
      <div
        className="flex flex-col gap-3 rounded-2xl p-5"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <p className="text-xs text-[color:var(--color-text-muted)]">Nome</p>
          <p className="text-sm text-white">{name || "—"}</p>
        </div>
        {niche && (
          <div>
            <p className="text-xs text-[color:var(--color-text-muted)]">Nicho</p>
            <p className="text-sm text-white">{niche}</p>
          </div>
        )}
        {objective && (
          <div>
            <p className="text-xs text-[color:var(--color-text-muted)]">Objetivo</p>
            <p className="text-sm text-white">{objective}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-[color:var(--color-text-muted)]">Estágios ({stages.length})</p>
          <ul className="mt-1 flex flex-col gap-1">
            {stages.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-[10px] text-[color:var(--color-text-muted)]">{i + 1}.</span>
                <span className="text-white">{s.id}</span>
                {s.goal && (
                  <span className="text-[11px] text-[color:var(--color-text-muted)] truncate">
                    — {s.goal}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
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
  const [stages, setStages] = useState<DraftStage[]>([
    { id: "abertura", goal: "", instruction: "" },
  ]);

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
      reference_copy: [],
      next: stages[i + 1]?.id,
      terminal: i === stages.length - 1 ? true : undefined,
    }));

    const newFlow: FlowV2 = {
      ...base,
      flow_id: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      niche: niche || base.niche,
      objective,
      entry_stage: v2Stages[0].id,
      stages: v2Stages,
      interrupts: base.interrupts ?? [],
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
      style={{ background: "#0e0918", minHeight: "calc(100vh - 56px)" }}
    >
      <div className="border-b border-[#1f192a] px-6 py-4">
        <StepIndicator current={step} total={STEP_LABELS.length} />
        <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
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
            />
          )}
          {step === 1 && <Step2 stages={stages} setStages={setStages} />}
          {step === 2 && <Step3 name={name} niche={niche} objective={objective} stages={stages} />}
        </div>
      </div>
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}
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
