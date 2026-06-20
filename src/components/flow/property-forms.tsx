import { useFlowStore, type FlowNode, type NodeData } from "@/stores/flow-store";
import { Field, TInput, TTextarea, TSelect, Pill, Slider } from "./form-primitives";
import { TotumButton } from "@/components/ui/totum-button";
import { Plus, X, Lock } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);

function useUpdate(id: string) {
  const update = useFlowStore((s) => s.updateNodeData);
  return (patch: Partial<NodeData>) => update(id, patch);
}

export function StartForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  const required = node.data.requiredVars ?? [];
  return (
    <>
      <Field label="Nome da pesquisa">
        <TInput
          value={node.data.researchName ?? ""}
          onChange={(e) => upd({ researchName: e.target.value })}
        />
      </Field>
      <Field label="Nicho">
        <TInput value={node.data.niche ?? ""} onChange={(e) => upd({ niche: e.target.value })} />
      </Field>
      <Field label="Público-alvo">
        <TInput value={node.data.audience ?? ""} onChange={(e) => upd({ audience: e.target.value })} />
      </Field>
      <Field label="Variáveis obrigatórias" hint="Se uma estiver vazia, a mensagem não é enviada.">
        <div className="flex flex-wrap gap-1.5">
          {required.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              style={{ background: "#1f192a", color: "#d1cece" }}
            >
              {v}
              <button
                onClick={() => upd({ requiredVars: required.filter((_, j) => j !== i) })}
                className="text-[color:var(--color-text-muted)] hover:text-white"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              const v = prompt("Nome da variável (ex: empresa)");
              if (v) upd({ requiredVars: [...required, v] });
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-[color:var(--color-text-muted)] hover:text-white"
            style={{ boxShadow: "inset 0 0 0 1px hsla(0,0%,100%,0.1)" }}
          >
            <Plus className="size-3" /> add
          </button>
        </div>
      </Field>
    </>
  );
}

function calcTimes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const typing = Math.min((words / 40) * 60, 8) + 1;
  const reading = (words / 225) * 60 + 2;
  return { typing: Math.round(typing * 10) / 10, reading: Math.round(reading * 10) / 10 };
}

export function SendForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  const variations = node.data.variations ?? [];
  const first = variations[0]?.text ?? "";
  const times = calcTimes(first);

  return (
    <>
      {variations.map((v, i) => (
        <div
          key={v.id}
          className="space-y-2 rounded-xl p-3"
          style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px #1f192a" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {i === 0 ? "Mensagem" : `Variação ${i}`}
            </span>
            {i > 0 && (
              <button
                onClick={() =>
                  upd({ variations: variations.filter((_, j) => j !== i) })
                }
                className="text-[color:var(--color-text-muted)] hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <TTextarea
            value={v.text}
            onChange={(e) => {
              const next = variations.map((x, j) => (j === i ? { ...x, text: e.target.value } : x));
              upd({ variations: next });
            }}
            placeholder="Olá {{nome}}, …"
          />
          {i > 0 && (
            <TInput
              placeholder="quando usar (ex: decisor único)"
              value={v.when}
              onChange={(e) => {
                const next = variations.map((x, j) => (j === i ? { ...x, when: e.target.value } : x));
                upd({ variations: next });
              }}
            />
          )}
        </div>
      ))}

      <TotumButton
        variant="outline"
        size="sm"
        onClick={() => upd({ variations: [...variations, { id: uid(), text: "", when: "" }] })}
      >
        <Plus className="size-3.5" /> Adicionar variação
      </TotumButton>

      <div
        className="rounded-xl p-3 text-xs"
        style={{ background: "#1f192a" }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[color:var(--color-text-muted)]">Digitando</span>
          <span className="text-white">~{times.typing}s</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[color:var(--color-text-muted)]">Pausa para leitura</span>
          <span className="text-white">~{times.reading}s</span>
        </div>
        <button
          className="mt-2 w-full rounded-full py-1 text-[11px] text-[color:var(--color-text-muted)] hover:text-white"
          style={{ boxShadow: "inset 0 0 0 1px hsla(0,0%,100%,0.1)" }}
          onClick={() => upd({ variations: [...variations] })}
        >
          Recalcular
        </button>
      </div>
    </>
  );
}

export function AiForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  return (
    <>
      <Field label="Modelo">
        <TSelect value={node.data.model ?? "gemini"} onChange={(e) => upd({ model: e.target.value as never })}>
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
        </TSelect>
      </Field>
      <Field label="Modo">
        <div className="flex gap-2">
          <Pill active={node.data.mode !== "flexible"} onClick={() => upd({ mode: "strict" })}>
            Strict
          </Pill>
          <Pill active={node.data.mode === "flexible"} onClick={() => upd({ mode: "flexible" })}>
            Flexible
          </Pill>
        </div>
      </Field>
      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
        style={{ background: "#1f192a", color: "#a06ff6", width: "fit-content" }}
      >
        <Lock className="size-3" /> sempre proativo
      </div>
      <Field label="Instrução">
        <TTextarea
          value={node.data.instruction ?? ""}
          onChange={(e) => upd({ instruction: e.target.value })}
          placeholder="O que a IA deve fazer aqui…"
        />
      </Field>
      <Field label="Limites">
        <TTextarea
          value={node.data.limits ?? ""}
          onChange={(e) => upd({ limits: e.target.value })}
          placeholder="Ex: não promete preço, não inventa rota"
        />
      </Field>
      <Field label="Modelo de fallback (opcional)">
        <TSelect
          value={node.data.fallbackModel ?? ""}
          onChange={(e) => upd({ fallbackModel: e.target.value })}
        >
          <option value="">—</option>
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
        </TSelect>
      </Field>
    </>
  );
}

export function WaitForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  return (
    <>
      <Field label="Timeout">
        <div className="flex gap-2">
          <TInput
            type="number"
            value={node.data.timeoutValue ?? 24}
            onChange={(e) => upd({ timeoutValue: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <TSelect
            value={node.data.timeoutUnit ?? "hours"}
            onChange={(e) => upd({ timeoutUnit: e.target.value as never })}
            style={{ width: 120 }}
          >
            <option value="minutes">minutos</option>
            <option value="hours">horas</option>
            <option value="days">dias</option>
          </TSelect>
        </div>
      </Field>
      <Field label="Ação no timeout">
        <TSelect
          value={node.data.onTimeout ?? "followup"}
          onChange={(e) => upd({ onTimeout: e.target.value as never })}
        >
          <option value="followup">Followup</option>
          <option value="end">Encerrar</option>
          <option value="node">Ir para nó</option>
        </TSelect>
      </Field>
    </>
  );
}

export function ConditionalForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  const branches = node.data.branches ?? [];
  return (
    <>
      <Field label="Modelo classificador">
        <TSelect
          value={node.data.classifierModel ?? "gemini"}
          onChange={(e) => upd({ classifierModel: e.target.value as never })}
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
        </TSelect>
      </Field>
      <Field label="Ramos" hint="Sempre existe um ramo 'default' implícito ao fim.">
        <div className="flex flex-col gap-2">
          {branches.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <TInput
                value={b.label}
                onChange={(e) => {
                  const next = branches.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  );
                  upd({ branches: next });
                }}
              />
              <button
                onClick={() => upd({ branches: branches.filter((_, j) => j !== i) })}
                className="text-[color:var(--color-text-muted)] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <TotumButton
            variant="outline"
            size="sm"
            onClick={() => upd({ branches: [...branches, { id: uid(), label: "novo ramo" }] })}
          >
            <Plus className="size-3.5" /> Adicionar ramo
          </TotumButton>
        </div>
      </Field>
    </>
  );
}

export function VariableForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  return (
    <>
      <Field label="Key">
        <TInput value={node.data.varKey ?? ""} onChange={(e) => upd({ varKey: e.target.value })} />
      </Field>
      <Field label="Value">
        <TInput value={node.data.varValue ?? ""} onChange={(e) => upd({ varValue: e.target.value })} />
      </Field>
    </>
  );
}

export function ActionForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  const t = node.data.actionType ?? "audit_site";
  return (
    <>
      <Field label="Tipo de ação">
        <TSelect value={t} onChange={(e) => upd({ actionType: e.target.value as never })}>
          <option value="audit_site">Auditar site</option>
          <option value="calendar">Oferecer horário (calendário)</option>
          <option value="webhook">Webhook externo</option>
        </TSelect>
      </Field>
      {t === "calendar" && (
        <Field label="Link da agenda">
          <TInput
            value={node.data.calendarLink ?? ""}
            onChange={(e) => upd({ calendarLink: e.target.value })}
            placeholder="https://cal.com/…"
          />
        </Field>
      )}
      {t === "webhook" && (
        <Field label="URL do webhook">
          <TInput
            value={node.data.actionUrl ?? ""}
            onChange={(e) => upd({ actionUrl: e.target.value })}
            placeholder="https://…"
          />
        </Field>
      )}
    </>
  );
}

export function EndForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  return (
    <>
      <Field label="Resultado">
        <TSelect value={node.data.result ?? "meeting"} onChange={(e) => upd({ result: e.target.value as never })}>
          <option value="meeting">Reunião marcada</option>
          <option value="rejected">Rejeitado</option>
          <option value="followup">Followup</option>
        </TSelect>
      </Field>
      <Field label="Nota">
        <TTextarea value={node.data.note ?? ""} onChange={(e) => upd({ note: e.target.value })} />
      </Field>
    </>
  );
}

const LOG_FIELDS = [
  "empresa", "resultado", "temperatura", "score", "abriu_pela_observacao",
  "gatilho_preview", "agendou", "objeções", "resumo", "transcript",
  "próxima_ação", "onde_travou",
];

export function LogForm({ node }: { node: FlowNode }) {
  const upd = useUpdate(node.id);
  return (
    <>
      <Field label="Destino">
        <div className="space-y-2">
          <div
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
            style={{ background: "#1f192a", color: "#35a670" }}
          >
            <span>PostgreSQL</span>
            <span>sempre ativo</span>
          </div>
          <label className="flex items-center justify-between rounded-xl px-3 py-2 text-xs" style={{ background: "#1f192a", color: "#d1cece" }}>
            <span>Google Sheets</span>
            <input
              type="checkbox"
              checked={!!node.data.sheetsEnabled}
              onChange={(e) => upd({ sheetsEnabled: e.target.checked })}
              className="accent-[#da2128]"
            />
          </label>
        </div>
      </Field>
      {node.data.sheetsEnabled && (
        <>
          <Field label="Spreadsheet ID">
            <TInput
              value={node.data.spreadsheetId ?? ""}
              onChange={(e) => upd({ spreadsheetId: e.target.value })}
            />
          </Field>
          <Field label="Nome da aba">
            <TInput value={node.data.sheetTab ?? "Leads"} onChange={(e) => upd({ sheetTab: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="Campos do relatório">
        <div className="flex flex-wrap gap-1">
          {LOG_FIELDS.map((f) => (
            <span
              key={f}
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: "#1f192a", color: "#9ca3af" }}
            >
              {f}
            </span>
          ))}
        </div>
      </Field>
    </>
  );
}
