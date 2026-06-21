import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, History, Plus, Save, Sparkles, X } from "lucide-react";

import { MultiStepForm } from "@/components/ui/multistep-form";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  ANGULOS,
  CIDADES_POR_ESTADO,
  ESTADOS,
  OUTPUT_BLOCKS,
  OUTPUT_FIELDS,
  TIPOS,
  createDefaultOrder,
} from "@/lib/research/content";
import { generateResearchPrompt } from "@/lib/research/generate-prompt";
import { getOrder, saveOrder } from "@/lib/research/storage";
import type { OrderData, ProspectType } from "@/lib/research/types";

export const Route = createFileRoute("/pesquisa/")({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pesquisa — SDR Totum" },
      {
        name: "description",
        content:
          "Monte uma ordem de pesquisa de lote e gere um prompt pronto pra colar em qualquer agente.",
      },
    ],
  }),
  component: PesquisaWizard,
});

const STEPS = [
  { id: "icp", title: "Nicho & ICP" },
  { id: "geo", title: "Geografia" },
  { id: "gate", title: "Gate & Exclusões" },
  { id: "tipos", title: "Tipos & Ângulos" },
  { id: "campos", title: "Campos de saída" },
  { id: "output", title: "Revisão & Output" },
];

function PesquisaWizard() {
  const { from } = Route.useSearch();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderData>(() => {
    if (from) {
      const existing = getOrder(from);
      if (existing) return structuredClone(existing.data);
    }
    return createDefaultOrder();
  });
  const [step, setStep] = useState(0);

  const patch = (p: Partial<OrderData>) => setOrder((o) => ({ ...o, ...p }));

  const prompt = useMemo(() => generateResearchPrompt(order), [order]);

  const validations = [
    order.nicho.trim().length > 0,
    order.cidades.length >= 1,
    order.gate.minAvaliacoes >= 0 &&
      order.gate.notaMinima >= 0 &&
      order.gate.notaMinima <= 5 &&
      order.gate.instagramAtivoDias >= 0,
    true,
    order.camposSaida.length >= 1,
    true,
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar o prompt");
    }
  };

  const handleSave = () => {
    if (order.camposSaida.length < 1) {
      toast.error("Selecione ao menos um campo de saída");
      return;
    }
    saveOrder(order);
    toast.success("Ordem salva no histórico");
    navigate({ to: "/pesquisa/historico" });
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1 text-sm text-[color:var(--color-text-muted)] hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> Início
            </Link>
            <h1 className="text-3xl">Nova Pesquisa</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
              Monte a ordem de pesquisa de lote e gere o prompt para o agente.
            </p>
          </div>
          <TotumButton asChild variant="ghost" size="sm">
            <Link to="/pesquisa/historico">
              <History className="size-4" /> Histórico
            </Link>
          </TotumButton>
        </div>

        {/* Card */}
        <section
          className="p-8"
          style={{
            background: "#1b1728",
            borderRadius: 24,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <MultiStepForm
            steps={STEPS}
            current={step}
            onStepChange={setStep}
            canProceed={validations[step]}
            finishSlot={
              <>
                <TotumButton variant="ghost" onClick={handleCopy}>
                  <Copy className="size-4" /> Copiar prompt
                </TotumButton>
                <TotumButton variant="outline" disabled title="Em breve" className="opacity-50">
                  <Sparkles className="size-4" /> Rodar com agente (em breve)
                </TotumButton>
                <TotumButton onClick={handleSave}>
                  <Save className="size-4" /> Salvar no histórico
                </TotumButton>
              </>
            }
          >
            {step === 0 && <StepIcp order={order} patch={patch} />}
            {step === 1 && <StepGeo order={order} patch={patch} />}
            {step === 2 && <StepGate order={order} patch={patch} />}
            {step === 3 && <StepTipos order={order} patch={patch} />}
            {step === 4 && <StepCampos order={order} patch={patch} />}
            {step === 5 && <StepOutput prompt={prompt} order={order} />}
          </MultiStepForm>
        </section>
      </div>
    </main>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */

interface StepProps {
  order: OrderData;
  patch: (p: Partial<OrderData>) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-[color:var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
      style={{ background: "#1f192a", boxShadow: "var(--shadow-inset-border)" }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[color:var(--color-text-muted)] hover:text-white"
          aria-label={`Remover ${label}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
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
            <Chip key={v} label={v} onRemove={() => onChange(values.filter((x) => x !== v))} />
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({
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
      className={cn(
        "rounded-full px-4 py-2 text-sm transition-all",
        active ? "text-white" : "text-[color:var(--color-text-muted)]",
      )}
      style={{
        background: active ? "#da2128" : "#1f192a",
        boxShadow: active ? "var(--shadow-btn-primary)" : "var(--shadow-inset-border)",
      }}
    >
      {children}
    </button>
  );
}

/* ── steps ───────────────────────────────────────────────────── */

function StepIcp({ order, patch }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Nicho" hint="Segmento-alvo do lote.">
        <Input
          value={order.nicho}
          onChange={(e) => patch({ nicho: e.target.value })}
          placeholder="Clínicas odontológicas"
        />
      </Field>
      <Field label="Descrição do ICP">
        <Textarea
          value={order.descricaoIcp}
          onChange={(e) => patch({ descricaoIcp: e.target.value })}
          placeholder="Quem é o cliente ideal? Porte, perfil, dores típicas…"
          rows={3}
        />
      </Field>
      <Field label="Encaixe natural" hint="Oferta que encaixa direto neste ICP.">
        <Input
          value={order.encaixeNatural}
          onChange={(e) => patch({ encaixeNatural: e.target.value })}
          placeholder="Landing Page Express"
        />
      </Field>
      <Field label="Upsell futuro" hint="Contexto para evolução da conta.">
        <Textarea
          value={order.upsellFuturo}
          onChange={(e) => patch({ upsellFuturo: e.target.value })}
          placeholder="O que pode ser vendido depois?"
          rows={2}
        />
      </Field>
    </div>
  );
}

function StepGeo({ order, patch }: StepProps) {
  const toggleEstado = (uf: string) => {
    const has = order.estados.includes(uf);
    const cityList = CIDADES_POR_ESTADO[uf] ?? [];
    if (has) {
      patch({
        estados: order.estados.filter((e) => e !== uf),
        cidades: order.cidades.filter((c) => !cityList.includes(c)),
      });
    } else {
      patch({
        estados: [...order.estados, uf],
        cidades: Array.from(new Set([...order.cidades, ...cityList])),
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Field label="Estados" hint="Ative um estado para pré-popular suas cidades.">
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((uf) => (
            <Pill key={uf} active={order.estados.includes(uf)} onClick={() => toggleEstado(uf)}>
              {uf}
            </Pill>
          ))}
        </div>
      </Field>
      <Field label="Cidades" hint="Adicione ou remova cidades individualmente (mín. 1).">
        <ChipInput
          values={order.cidades}
          onChange={(cidades) => patch({ cidades })}
          placeholder="Adicionar cidade…"
        />
      </Field>
    </div>
  );
}

function StepGate({ order, patch }: StepProps) {
  const g = order.gate;
  const setGate = (p: Partial<OrderData["gate"]>) => patch({ gate: { ...g, ...p } });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Mín. de avaliações">
          <Input
            type="number"
            min={0}
            value={g.minAvaliacoes}
            onChange={(e) => setGate({ minAvaliacoes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Nota mínima (0–5)">
          <Input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={g.notaMinima}
            onChange={(e) => setGate({ notaMinima: Number(e.target.value) })}
          />
        </Field>
        <Field label="Instagram ativo nos últimos (dias)">
          <Input
            type="number"
            min={0}
            value={g.instagramAtivoDias}
            onChange={(e) => setGate({ instagramAtivoDias: Number(e.target.value) })}
          />
        </Field>
      </div>

      <ToggleRow
        label="Exige WhatsApp"
        checked={g.exigeWhatsapp}
        onChange={(v) => setGate({ exigeWhatsapp: v })}
      />
      <ToggleRow
        label="Somente nicho odonto não-individual"
        hint="Exclui consultórios de profissional único."
        checked={g.somenteNaoIndividual}
        onChange={(v) => setGate({ somenteNaoIndividual: v })}
      />

      <Field label="Exclusões" hint="Perfis que NÃO devem ser prospectados.">
        <ChipInput
          values={order.exclusoes}
          onChange={(exclusoes) => patch({ exclusoes })}
          placeholder="Adicionar exclusão…"
        />
      </Field>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-3"
      style={{ background: "#1f192a", boxShadow: "var(--shadow-inset-border)" }}
    >
      <div>
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs text-[color:var(--color-text-muted)]">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function StepTipos({ order, patch }: StepProps) {
  const toggleTipo = (id: ProspectType) =>
    patch({
      tipos: order.tipos.includes(id) ? order.tipos.filter((t) => t !== id) : [...order.tipos, id],
    });
  const toggleAngulo = (id: (typeof ANGULOS)[number]["id"]) =>
    patch({
      angulos: order.angulos.includes(id)
        ? order.angulos.filter((a) => a !== id)
        : [...order.angulos, id],
    });

  return (
    <div className="flex flex-col gap-6">
      <Field label="Tipos de prospecção">
        <div className="flex flex-col gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTipo(t.id)}
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-all"
              style={{
                background: "#1f192a",
                boxShadow: order.tipos.includes(t.id)
                  ? "inset 0 0 0 1px #da2128"
                  : "var(--shadow-inset-border)",
              }}
            >
              <div>
                <p className="text-sm text-white">{t.label}</p>
                <p className="text-xs text-[color:var(--color-text-muted)]">{t.descricao}</p>
              </div>
              {order.tipos.includes(t.id) && <Check className="size-4 text-[#ef9a9a]" />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Ângulos de munição">
        <div className="flex flex-col gap-2">
          {ANGULOS.map((a) => {
            const active = order.angulos.includes(a.id);
            return (
              <label
                key={a.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3"
                style={{
                  background: "#1f192a",
                  boxShadow: "var(--shadow-inset-border)",
                }}
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={() => toggleAngulo(a.id)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm text-white">{a.label}</p>
                  <p className="text-xs text-[color:var(--color-text-muted)]">{a.descricao}</p>
                </div>
              </label>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function StepCampos({ order, patch }: StepProps) {
  const checked = new Set(order.camposSaida);
  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    patch({ camposSaida: Array.from(next) });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Selecione os campos do schema POR PROSPECT (FASE 6). Campos{" "}
        <span className="text-[#ef9a9a]">bloqueantes</span> e de munição já vêm marcados.
        Selecionados: {order.camposSaida.length}/{OUTPUT_FIELDS.length}.
      </p>
      {OUTPUT_BLOCKS.map((block) => {
        const fields = OUTPUT_FIELDS.filter((f) => f.block === block.id);
        return (
          <div key={block.id} className="flex flex-col gap-2">
            <h3 className="text-sm text-white">
              Bloco {block.id} — {block.label}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2"
                  style={{
                    background: "#1f192a",
                    boxShadow: "var(--shadow-inset-border)",
                  }}
                >
                  <Checkbox checked={checked.has(f.key)} onCheckedChange={() => toggle(f.key)} />
                  <span className="flex-1 text-sm text-white">{f.label}</span>
                  {f.blocking && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#ef9a9a]"
                      style={{ background: "rgba(218,33,40,0.15)" }}
                    >
                      bloqueante
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepOutput({ prompt, order }: { prompt: string; order: OrderData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-xs text-[color:var(--color-text-muted)]">
        <span>{order.nicho || "—"}</span>
        <span>·</span>
        <span>{order.estados.join("/") || "—"}</span>
        <span>·</span>
        <span>{order.cidades.length} cidade(s)</span>
        <span>·</span>
        <span>{order.camposSaida.length} campo(s)</span>
      </div>
      <pre
        className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl p-5 text-xs leading-relaxed text-[#d1cece]"
        style={{
          background: "#0e0918",
          boxShadow: "var(--shadow-inset-border)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        {prompt}
      </pre>
    </div>
  );
}
