/**
 * ResearchWizard.tsx
 * Wizard de 6 passos que monta uma ORDEM DE PESQUISA DE LOTE e gera o prompt copiável.
 * Conteúdo vem de docs/MESTRE_DE_PESQUISA_v2.md via research-schema.ts.
 */
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Plus, Save, X, Bot } from "lucide-react";
import { api, type OrderData } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import {
  ANGLES,
  OPPORTUNITY_TYPES,
  OUTPUT_BLOCKS,
  autoOrderName,
  defaultOrderData,
} from "@/lib/research-schema";
import { generateResearchPrompt } from "@/lib/research-prompt";

const STEPS = [
  "Nicho & ICP",
  "Geografia",
  "Gate & Exclusões",
  "Tipos & Ângulos",
  "Campos de saída",
  "Revisão & Output",
];

// ── primitivas locais (estilo Totum) ─────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
      {children}
    </span>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128] ${props.className ?? ""}`}
      style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px #1f192a", ...props.style }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-md px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
      style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px #1f192a", minHeight: 72 }}
    />
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs transition-colors"
      style={{
        background: active ? "#da2128" : "#1f192a",
        color: active ? "#fff" : "#9ca3af",
        boxShadow: active ? "inset 0 1px 1px hsla(0,0%,100%,0.2)" : "inset 0 0 0 1px #272333",
      }}
    >
      {children}
    </button>
  );
}

function Chips({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
          style={{ background: "#1f192a", color: "#d1cece" }}
        >
          {v}
          <button
            onClick={() => onRemove(i)}
            className="text-[color:var(--color-text-muted)] hover:text-white"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ── passos ───────────────────────────────────────────────────────────────────
type StepProps = { data: OrderData; set: (patch: Partial<OrderData>) => void };

function StepNicho({ data, set }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Nicho</Label>
        <Input value={data.niche} onChange={(e) => set({ niche: e.target.value })} />
      </div>
      <div>
        <Label>Descrição do ICP</Label>
        <Textarea
          value={data.icpDescription}
          onChange={(e) => set({ icpDescription: e.target.value })}
        />
      </div>
      <div>
        <Label>Encaixe natural</Label>
        <Input value={data.naturalFit} onChange={(e) => set({ naturalFit: e.target.value })} />
      </div>
      <div>
        <Label>Upsell futuro (contexto, não entra na abordagem)</Label>
        <Textarea
          value={data.upsellContext}
          onChange={(e) => set({ upsellContext: e.target.value })}
        />
      </div>
    </div>
  );
}

function StepGeografia({ data, set }: StepProps) {
  const [draftUf, setDraftUf] = useState("");
  const addCity = (ufIdx: number, city: string) => {
    if (!city.trim()) return;
    const geography = data.geography.map((g, i) =>
      i === ufIdx ? { ...g, cities: [...g.cities, city.trim()] } : g,
    );
    set({ geography });
  };
  const removeCity = (ufIdx: number, cityIdx: number) => {
    const geography = data.geography.map((g, i) =>
      i === ufIdx ? { ...g, cities: g.cities.filter((_, j) => j !== cityIdx) } : g,
    );
    set({ geography });
  };
  return (
    <div className="space-y-4">
      {data.geography.map((g, ufIdx) => (
        <div
          key={g.uf}
          className="rounded-xl p-3"
          style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px #1f192a" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-white">{g.uf}</span>
            <button
              onClick={() => set({ geography: data.geography.filter((_, i) => i !== ufIdx) })}
              className="text-[color:var(--color-text-muted)] hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <Chips items={g.cities} onRemove={(i) => removeCity(ufIdx, i)} />
          <CityAdder onAdd={(c) => addCity(ufIdx, c)} />
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Novo estado (UF)"
          value={draftUf}
          onChange={(e) => setDraftUf(e.target.value.toUpperCase())}
          style={{ maxWidth: 160 }}
        />
        <TotumButton
          variant="outline"
          size="sm"
          onClick={() => {
            if (draftUf.trim()) {
              set({ geography: [...data.geography, { uf: draftUf.trim(), cities: [] }] });
              setDraftUf("");
            }
          }}
        >
          <Plus className="size-3.5" /> Estado
        </TotumButton>
      </div>
    </div>
  );
}

function CityAdder({ onAdd }: { onAdd: (city: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-2 flex gap-2">
      <Input
        placeholder="Adicionar cidade…"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(v);
            setV("");
          }
        }}
      />
      <TotumButton
        variant="ghost"
        size="sm"
        onClick={() => {
          onAdd(v);
          setV("");
        }}
      >
        <Plus className="size-3.5" />
      </TotumButton>
    </div>
  );
}

function StepGate({ data, set }: StepProps) {
  const [exclDraft, setExclDraft] = useState("");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Mín. avaliações Google</Label>
          <Input
            type="number"
            value={data.minReviews}
            onChange={(e) => set({ minReviews: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Nota mínima</Label>
          <Input
            type="number"
            step="0.1"
            value={data.minRating}
            onChange={(e) => set({ minRating: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Instagram ativo nos últimos (dias)</Label>
          <Input
            type="number"
            value={data.instagramActiveDays}
            onChange={(e) => set({ instagramActiveDays: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <Toggle
            active={data.requireWhatsapp}
            onClick={() => set({ requireWhatsapp: !data.requireWhatsapp })}
          >
            {data.requireWhatsapp ? "✓ " : ""}Exige WhatsApp
          </Toggle>
          <Toggle
            active={data.nonIndividualOnly}
            onClick={() => set({ nonIndividualOnly: !data.nonIndividualOnly })}
          >
            {data.nonIndividualOnly ? "✓ " : ""}Odonto não-individual
          </Toggle>
        </div>
      </div>
      <div>
        <Label>Exclusões</Label>
        <Chips
          items={data.exclusions}
          onRemove={(i) => set({ exclusions: data.exclusions.filter((_, j) => j !== i) })}
        />
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="Adicionar exclusão…"
            value={exclDraft}
            onChange={(e) => setExclDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && exclDraft.trim()) {
                set({ exclusions: [...data.exclusions, exclDraft.trim()] });
                setExclDraft("");
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StepTipos({ data, set }: StepProps) {
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <div className="space-y-5">
      <div>
        <Label>Tipos de oportunidade</Label>
        <div className="flex flex-wrap gap-2">
          {OPPORTUNITY_TYPES.map((t) => (
            <Toggle
              key={t.id}
              active={data.opportunityTypes.includes(t.id)}
              onClick={() => set({ opportunityTypes: toggle(data.opportunityTypes, t.id) })}
            >
              {t.label}
            </Toggle>
          ))}
        </div>
      </div>
      <div>
        <Label>Ângulos de munição</Label>
        <div className="flex flex-wrap gap-2">
          {ANGLES.map((a) => (
            <Toggle
              key={a}
              active={data.angles.includes(a)}
              onClick={() => set({ angles: toggle(data.angles, a) })}
            >
              {a}
            </Toggle>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepCampos({ data, set }: StepProps) {
  const selected = useMemo(() => new Set(data.outputFields), [data.outputFields]);
  const toggle = (key: string) =>
    set({
      outputFields: selected.has(key)
        ? data.outputFields.filter((k) => k !== key)
        : [...data.outputFields, key],
    });
  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--color-text-muted)]">
        Selecione os campos do schema POR PROSPECT (FASE 6).{" "}
        <span style={{ color: "#ef9a9a" }}>● bloqueante</span> ·{" "}
        <span style={{ color: "#a06ff6" }}>● munição</span>
      </p>
      {OUTPUT_BLOCKS.map((block) => (
        <div key={block.id}>
          <div className="mb-1.5 text-sm text-white">{block.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {block.fields.map((f) => {
              const on = selected.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggle(f.key)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors"
                  style={{
                    background: on ? "#272333" : "#0e0918",
                    color: on ? "#fff" : "#9ca3af",
                    boxShadow: on ? "inset 0 0 0 1px #da2128" : "inset 0 0 0 1px #1f192a",
                  }}
                >
                  {on && <Check className="size-3" />}
                  {f.label}
                  {f.blocking && <span style={{ color: "#ef9a9a" }}>●</span>}
                  {f.ammo && <span style={{ color: "#a06ff6" }}>●</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepRevisao({
  prompt,
  onSave,
  saving,
}: {
  prompt: string;
  onSave: () => void;
  saving: boolean;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <TotumButton variant="primary" size="sm" onClick={copy}>
          <Copy className="size-3.5" /> Copiar prompt
        </TotumButton>
        <TotumButton variant="secondary" size="sm" onClick={onSave} disabled={saving}>
          <Save className="size-3.5" /> {saving ? "Salvando…" : "Salvar no histórico"}
        </TotumButton>
        <TotumButton variant="ghost" size="sm" disabled title="Em breve">
          <Bot className="size-3.5" /> Rodar com agente (em breve)
        </TotumButton>
      </div>
      <pre
        className="max-h-[52vh] overflow-auto rounded-xl p-4 text-[12px] leading-relaxed text-[color:var(--color-text-body)] whitespace-pre-wrap"
        style={{
          background: "#0e0918",
          boxShadow: "inset 0 0 0 1px #1f192a",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {prompt}
      </pre>
    </div>
  );
}

// ── validação por passo ──────────────────────────────────────────────────────
function isStepValid(step: number, data: OrderData): boolean {
  switch (step) {
    case 0:
      return data.niche.trim().length > 0;
    case 1:
      return data.geography.some((g) => g.cities.length > 0);
    case 2:
      return data.minReviews > 0 && data.minRating > 0 && data.instagramActiveDays > 0;
    case 4:
      return data.outputFields.length > 0;
    default:
      return true;
  }
}

// ── componente principal ──────────────────────────────────────────────────────
export function ResearchWizard({
  initial,
  onSaved,
}: {
  initial?: OrderData;
  onSaved?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OrderData>(initial ?? defaultOrderData());
  const set = (patch: Partial<OrderData>) => setData((d) => ({ ...d, ...patch }));

  const prompt = useMemo(() => generateResearchPrompt(data), [data]);
  const valid = isStepValid(step, data);

  const saveMut = useMutation({
    mutationFn: () => api.createResearchOrder({ name: autoOrderName(data), data }),
    onSuccess: () => {
      toast.success("Ordem salva no histórico!");
      onSaved?.();
    },
    onError: (e) => toast.error(`Erro ao salvar: ${(e as Error).message}`),
  });

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <button
              key={label}
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className="flex flex-1 flex-col items-center gap-1.5"
              title={label}
            >
              <div
                className="flex size-7 items-center justify-center rounded-full text-xs transition-colors"
                style={{
                  background: current || done ? "#da2128" : "#1f192a",
                  color: current || done ? "#fff" : "#9ca3af",
                }}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className="hidden text-[10px] sm:block"
                style={{ color: current ? "#fff" : "#9ca3af" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Card do passo */}
      <div
        className="rounded-3xl p-6"
        style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="mb-1 text-lg text-white">
          {step + 1}. {STEPS[step]}
        </h2>
        <div className="mt-4 transition-opacity duration-200">
          {step === 0 && <StepNicho data={data} set={set} />}
          {step === 1 && <StepGeografia data={data} set={set} />}
          {step === 2 && <StepGate data={data} set={set} />}
          {step === 3 && <StepTipos data={data} set={set} />}
          {step === 4 && <StepCampos data={data} set={set} />}
          {step === 5 && (
            <StepRevisao
              prompt={prompt}
              onSave={() => saveMut.mutate()}
              saving={saveMut.isPending}
            />
          )}
        </div>
      </div>

      {/* Footer de navegação */}
      <div className="mt-5 flex items-center justify-between">
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Voltar
        </TotumButton>
        {!valid && (
          <span className="text-xs" style={{ color: "#ef9a9a" }}>
            {step === 1
              ? "Adicione ao menos 1 cidade"
              : step === 4
                ? "Selecione ao menos 1 campo"
                : "Preencha os campos obrigatórios"}
          </span>
        )}
        {step < STEPS.length - 1 ? (
          <TotumButton
            variant="primary"
            size="sm"
            onClick={() => setStep((s) => s + 1)}
            disabled={!valid}
          >
            Próximo
          </TotumButton>
        ) : (
          <span className="text-xs text-[color:var(--color-text-muted)]">Passo final</span>
        )}
      </div>
    </div>
  );
}
