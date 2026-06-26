import { useFlowStore, type EdgeConditionKind } from "@/stores/flow-store";
import { Field, TInput, TSelect, Slider } from "./form-primitives";
import { TotumButton } from "@/components/ui/totum-button";
import {
  StartForm,
  SendForm,
  AiForm,
  WaitForm,
  ConditionalForm,
  VariableForm,
  ActionForm,
  EndForm,
  LogForm,
  JumpForm,
  SubflowForm,
  ValidationForm,
} from "./property-forms";
import { Trash2, Plus, X, LogIn, CheckCircle2, Copy, GitBranch } from "lucide-react";
import { nodeMeta } from "./node-types";

export function PropertiesPanel() {
  const selectedId = useFlowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useFlowStore((s) => s.selectedEdgeId);
  const node = useFlowStore((s) => s.nodes.find((n) => n.id === selectedId));
  const edge = useFlowStore((s) => s.edges.find((e) => e.id === selectedEdgeId));
  const deleteNode = useFlowStore((s) => s.deleteNode);

  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto"
      style={{
        background: "#1b1728",
        boxShadow: "inset 1px 0 0 0 hsla(0,0%,100%,0.06)",
      }}
    >
      {edge ? (
        <EdgeProperties key={edge.id} edgeId={edge.id} />
      ) : node ? (
        <NodeProperties key={node.id} nodeId={node.id} onDelete={() => deleteNode(node.id)} />
      ) : (
        <GlobalSettings />
      )}
    </aside>
  );
}

const CONDITION_OPTIONS: { value: EdgeConditionKind; label: string }[] = [
  { value: "sempre", label: "Sempre (incondicional)" },
  { value: "sim", label: "Sim / resposta positiva" },
  { value: "nao", label: "Não / falha" },
  { value: "gatilho", label: "Gatilho específico" },
  { value: "timeout", label: "Sem resposta (timeout)" },
  { value: "objecao", label: "Objeção" },
];

function EdgeProperties({ edgeId }: { edgeId: string }) {
  const edge = useFlowStore((s) => s.edges.find((e) => e.id === edgeId))!;
  const updateEdgeData = useFlowStore((s) => s.updateEdgeData);
  const setSelectedEdge = useFlowStore((s) => s.setSelectedEdge);
  const data = (edge.data ?? {}) as { condition?: EdgeConditionKind; label?: string };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
          style={{ background: "#1f192a", color: "#a06ff6" }}
        >
          <GitBranch className="size-3" /> Transição
        </span>
        <button
          onClick={() => setSelectedEdge(null)}
          className="rounded-full p-1.5 text-[color:var(--color-text-muted)] hover:bg-[#272333] hover:text-white"
          title="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="text-[11px] text-[color:var(--color-text-muted)]">
        {edge.source} → {edge.target}
      </p>
      <Field label="Condição (advance)" hint="Quando esta transição é seguida.">
        <TSelect
          value={data.condition ?? "sempre"}
          onChange={(e) =>
            updateEdgeData(edgeId, { condition: e.target.value as EdgeConditionKind })
          }
        >
          {CONDITION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </TSelect>
      </Field>
      <Field label="Rótulo no canvas">
        <TInput
          value={data.label ?? ""}
          onChange={(e) => updateEdgeData(edgeId, { label: e.target.value })}
          placeholder="ex: aceitou prévia"
        />
      </Field>
    </div>
  );
}

function NodeProperties({ nodeId, onDelete }: { nodeId: string; onDelete: () => void }) {
  const node = useFlowStore((s) => s.nodes.find((n) => n.id === nodeId))!;
  const entryNodeId = useFlowStore((s) => s.entryNodeId);
  const setEntryNode = useFlowStore((s) => s.setEntryNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);
  const meta = nodeMeta(node.type as never);
  const Icon = meta.icon;
  const isEntry = entryNodeId === nodeId;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
            style={meta.badgeStyle}
          >
            <Icon className="size-3" /> {meta.badgeLabel}
          </span>
          {isEntry && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]"
              style={{ background: "rgba(53,166,112,0.15)", color: "#35a670" }}
            >
              <CheckCircle2 className="size-3" /> entrada
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => duplicateNode(nodeId)}
            className="rounded-full p-1.5 text-[color:var(--color-text-muted)] hover:bg-[#272333] hover:text-white"
            title="Duplicar node"
          >
            <Copy className="size-4" />
          </button>
          {node.type !== "start" && (
            <button
              onClick={onDelete}
              className="rounded-full p-1.5 text-[color:var(--color-text-muted)] hover:bg-[#272333] hover:text-[#d91616]"
              title="Excluir node"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => setEntryNode(nodeId)}
        disabled={isEntry}
        className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors disabled:opacity-50"
        style={{
          background: isEntry ? "rgba(53,166,112,0.12)" : "#1f192a",
          color: isEntry ? "#35a670" : "#d1cece",
        }}
        title="Marcar este nó como ponto de entrada do flow"
      >
        <LogIn className="size-3.5" />
        {isEntry ? "É o nó de entrada" : "Definir como nó de entrada"}
      </button>

      {node.type === "start" && <StartForm node={node} />}
      {node.type === "send" && <SendForm node={node} />}
      {node.type === "ai" && <AiForm node={node} />}
      {node.type === "wait" && <WaitForm node={node} />}
      {node.type === "conditional" && <ConditionalForm node={node} />}
      {node.type === "variable" && <VariableForm node={node} />}
      {node.type === "action" && <ActionForm node={node} />}
      {node.type === "end" && <EndForm node={node} />}
      {node.type === "log" && <LogForm node={node} />}
      {node.type === "jump" && <JumpForm node={node} />}
      {node.type === "subflow" && <SubflowForm node={node} />}
      {node.type === "validation" && <ValidationForm node={node} />}
    </div>
  );
}

function VariablesSection() {
  const variables = useFlowStore((s) => s.variables);
  const addVariable = useFlowStore((s) => s.addVariable);
  const updateVariable = useFlowStore((s) => s.updateVariable);
  const removeVariable = useFlowStore((s) => s.removeVariable);

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-base">Variáveis do flow</h2>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          Obrigatórias = exigidas para iniciar. Runtime = preenchidas durante a conversa.
        </p>
      </header>

      {variables.length === 0 && (
        <p className="text-[11px] text-[color:var(--color-text-muted)]">
          Nenhuma variável declarada ainda.
        </p>
      )}

      {variables.map((v) => (
        <div
          key={v.id}
          className="space-y-2 rounded-xl p-3"
          style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px #1f192a" }}
        >
          <div className="flex items-center gap-2">
            <TInput
              value={v.key}
              onChange={(e) => updateVariable(v.id, { key: e.target.value })}
              placeholder="NOME_VARIAVEL"
              style={{ flex: 1, fontSize: 12 }}
            />
            <button
              onClick={() => removeVariable(v.id)}
              className="text-[color:var(--color-text-muted)] hover:text-[#d91616]"
              title="Remover variável"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <TSelect
              value={v.scope}
              onChange={(e) =>
                updateVariable(v.id, { scope: e.target.value as "required" | "runtime" })
              }
              style={{ flex: 1, fontSize: 12 }}
            >
              <option value="required">Obrigatória</option>
              <option value="runtime">Runtime</option>
            </TSelect>
            <TSelect
              value={v.capture ?? "none"}
              onChange={(e) =>
                updateVariable(v.id, {
                  capture: e.target.value as "none" | "phone" | "email" | "date" | "entity",
                })
              }
              style={{ flex: 1, fontSize: 12 }}
            >
              <option value="none">sem captura</option>
              <option value="phone">telefone</option>
              <option value="email">e-mail</option>
              <option value="date">data</option>
              <option value="entity">entidade (LLM)</option>
            </TSelect>
          </div>
        </div>
      ))}

      <TotumButton variant="outline" size="sm" onClick={addVariable}>
        <Plus className="size-3.5" /> Nova variável
      </TotumButton>
    </section>
  );
}

function GlobalSettings() {
  const h = useFlowStore((s) => s.humanization);
  const updH = useFlowStore((s) => s.updateHumanization);
  const interrupts = useFlowStore((s) => s.interrupts);
  const addI = useFlowStore((s) => s.addInterrupt);
  const updI = useFlowStore((s) => s.updateInterrupt);
  const rmI = useFlowStore((s) => s.removeInterrupt);
  const nodes = useFlowStore((s) => s.nodes);

  return (
    <div className="flex flex-col gap-6 p-5">
      <VariablesSection />

      <div style={{ height: 1, background: "#1f192a" }} />

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-base">Humanização</h2>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Como as mensagens são entregues para parecerem humanas.
          </p>
        </header>

        <Field label={`Velocidade de leitura · ${h.readingSpeed} ppm`}>
          <Slider
            value={h.readingSpeed}
            onChange={(v) => updH({ readingSpeed: v })}
            min={150}
            max={300}
          />
        </Field>
        <Field label={`Velocidade de digitação · ${h.typingSpeed} ppm`}>
          <Slider
            value={h.typingSpeed}
            onChange={(v) => updH({ typingSpeed: v })}
            min={20}
            max={80}
          />
        </Field>

        <div
          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
          style={{ background: "#1f192a" }}
        >
          <div>
            <div className="text-white">Indicador "digitando"</div>
            <div className="text-[color:var(--color-text-muted)]">sempre ligado</div>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: "#35a670", color: "#fff" }}
          >
            ON
          </span>
        </div>

        <Field label="Máx mensagens consecutivas">
          <TInput
            type="number"
            value={h.maxConsecutive}
            onChange={(e) => updH({ maxConsecutive: Number(e.target.value) })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Início envio">
            <TInput
              type="time"
              value={h.sendWindowStart}
              onChange={(e) => updH({ sendWindowStart: e.target.value })}
            />
          </Field>
          <Field label="Fim envio">
            <TInput
              type="time"
              value={h.sendWindowEnd}
              onChange={(e) => updH({ sendWindowEnd: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Timezone">
          <TSelect value={h.timezone} onChange={(e) => updH({ timezone: e.target.value })}>
            <option>America/Sao_Paulo</option>
            <option>America/Fortaleza</option>
            <option>America/Manaus</option>
            <option>UTC</option>
            <option>Europe/Lisbon</option>
          </TSelect>
        </Field>
      </section>

      <div style={{ height: 1, background: "#1f192a" }} />

      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-base">Interrupções</h2>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Gatilhos que pausam o fluxo, executam um bloco e voltam ao ponto de origem.
          </p>
        </header>

        {interrupts.map((it) => (
          <div
            key={it.id}
            className="space-y-2 rounded-xl p-3"
            style={{ background: "#0e0918", boxShadow: "inset 0 0 0 1px #1f192a" }}
          >
            <div className="flex items-center gap-2">
              <TInput
                value={it.name}
                onChange={(e) => updI(it.id, { name: e.target.value })}
                placeholder="Nome"
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                onClick={() => rmI(it.id)}
                className="text-[color:var(--color-text-muted)] hover:text-[#d91616]"
              >
                <X className="size-4" />
              </button>
            </div>
            <TInput
              value={it.trigger}
              onChange={(e) => updI(it.id, { trigger: e.target.value })}
              placeholder="Gatilho (ex: lead objeta…)"
              style={{ fontSize: 12 }}
            />
            <TSelect
              value={it.goToNodeId}
              onChange={(e) => updI(it.id, { goToNodeId: e.target.value })}
            >
              <option value="">Ir para… (escolha um nó)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {nodeMeta(n.type as never).label} · {n.id}
                </option>
              ))}
            </TSelect>
            <div className="flex gap-2 text-[11px]">
              <label className="flex items-center gap-1 text-[color:var(--color-text-body)]">
                <input
                  type="radio"
                  checked={it.resolveBehavior === "resume"}
                  onChange={() => updI(it.id, { resolveBehavior: "resume" })}
                  className="accent-[#da2128]"
                />
                voltar à origem
              </label>
              <label className="flex items-center gap-1 text-[color:var(--color-text-body)]">
                <input
                  type="radio"
                  checked={it.resolveBehavior === "fixed_node"}
                  onChange={() => updI(it.id, { resolveBehavior: "fixed_node" })}
                  className="accent-[#da2128]"
                />
                ir para nó fixo
              </label>
            </div>
          </div>
        ))}

        <TotumButton variant="outline" size="sm" onClick={addI}>
          <Plus className="size-3.5" /> Nova Interrupção
        </TotumButton>
      </section>
    </div>
  );
}
