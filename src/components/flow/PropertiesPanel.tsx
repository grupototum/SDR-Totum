import { useFlowStore } from "@/stores/flow-store";
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
} from "./property-forms";
import { Trash2, Plus, X } from "lucide-react";
import { nodeMeta } from "./node-types";

export function PropertiesPanel() {
  const selectedId = useFlowStore((s) => s.selectedNodeId);
  const node = useFlowStore((s) => s.nodes.find((n) => n.id === selectedId));
  const deleteNode = useFlowStore((s) => s.deleteNode);

  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto"
      style={{
        background: "#1b1728",
        boxShadow: "inset 1px 0 0 0 hsla(0,0%,100%,0.06)",
      }}
    >
      {node ? (
        <NodeProperties key={node.id} nodeId={node.id} onDelete={() => deleteNode(node.id)} />
      ) : (
        <GlobalSettings />
      )}
    </aside>
  );
}

function NodeProperties({ nodeId, onDelete }: { nodeId: string; onDelete: () => void }) {
  const node = useFlowStore((s) => s.nodes.find((n) => n.id === nodeId))!;
  const meta = nodeMeta(node.type as never);
  const Icon = meta.icon;

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
        </div>
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

      {node.type === "start" && <StartForm node={node} />}
      {node.type === "send" && <SendForm node={node} />}
      {node.type === "ai" && <AiForm node={node} />}
      {node.type === "wait" && <WaitForm node={node} />}
      {node.type === "conditional" && <ConditionalForm node={node} />}
      {node.type === "variable" && <VariableForm node={node} />}
      {node.type === "action" && <ActionForm node={node} />}
      {node.type === "end" && <EndForm node={node} />}
      {node.type === "log" && <LogForm node={node} />}
    </div>
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
