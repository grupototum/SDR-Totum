import { type NodeProps } from "@xyflow/react";
import { NodeShell } from "./NodeShell";
import type { FlowNode } from "@/stores/flow-store";

export function StartNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell node={p} inHandle={false}>
      <div className="space-y-1">
        <div className="text-base">{p.data.researchName || "Pesquisa"}</div>
        <div className="text-xs text-[color:var(--color-text-muted)]">
          {p.data.niche || "sem nicho definido"}
        </div>
      </div>
    </NodeShell>
  );
}

export function SendMessageNode(p: NodeProps<FlowNode>) {
  const variations = p.data.variations ?? [];
  const first = variations[0]?.text ?? "";
  return (
    <NodeShell node={p}>
      <p className="line-clamp-3 text-xs text-[color:var(--color-text-body)]">
        {first || "Sem mensagem ainda"}
      </p>
      {variations.length > 1 && (
        <div className="mt-2 text-[10px] text-[color:var(--color-text-muted)]">
          +{variations.length - 1} variação(ões)
        </div>
      )}
    </NodeShell>
  );
}

export function AiMessageNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell node={p}>
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {p.data.model ?? "gemini"} · {p.data.mode ?? "strict"}
        </div>
        <p className="line-clamp-2 text-xs text-[color:var(--color-text-body)]">
          {p.data.instruction || "Defina a instrução da IA"}
        </p>
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[10px]"
          style={{ background: "#1f192a", color: "#a06ff6" }}
        >
          sempre proativo
        </span>
      </div>
    </NodeShell>
  );
}

import { Handle, Position } from "@xyflow/react";

export function WaitNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell
      node={p}
      handles={
        <>
          <Handle type="target" position={Position.Left} />
          <Handle id="reply" type="source" position={Position.Right} style={{ top: "35%" }} />
          <Handle id="timeout" type="source" position={Position.Right} style={{ top: "75%" }} />
        </>
      }
    >
      <div className="space-y-2">
        <div className="text-sm">
          {p.data.timeoutValue ?? 24} {p.data.timeoutUnit ?? "hours"}
        </div>
        <div className="flex flex-col gap-1 text-[10px]">
          <span style={{ color: "#35a670" }}>→ resposta</span>
          <span style={{ color: "#ef9a9a" }}>→ timeout</span>
        </div>
      </div>
    </NodeShell>
  );
}

export function ConditionalNode(p: NodeProps<FlowNode>) {
  const branches = p.data.branches ?? [];
  const allBranches = [...branches, { id: "default", label: "default" }];
  return (
    <NodeShell
      node={p}
      handles={
        <>
          <Handle type="target" position={Position.Left} />
          {allBranches.map((b, i) => (
            <Handle
              key={b.id}
              id={b.id}
              type="source"
              position={Position.Right}
              style={{ top: `${((i + 1) / (allBranches.length + 1)) * 100}%` }}
            />
          ))}
        </>
      }
    >
      <div className="space-y-1 text-xs">
        <div className="text-[color:var(--color-text-muted)]">
          classificador: {p.data.classifierModel ?? "gemini"}
        </div>
        {allBranches.map((b) => (
          <div key={b.id} className="flex items-center justify-between">
            <span className="text-[color:var(--color-text-body)]">{b.label}</span>
            <span
              className="size-1.5 rounded-full"
              style={{ background: b.id === "default" ? "#9ca3af" : "#a06ff6" }}
            />
          </div>
        ))}
      </div>
    </NodeShell>
  );
}

export function SetVariableNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell node={p}>
      <div className="space-y-1 text-xs">
        <div>
          <span className="text-[color:var(--color-text-muted)]">key:</span>{" "}
          <span className="text-white">{p.data.varKey || "—"}</span>
        </div>
        <div>
          <span className="text-[color:var(--color-text-muted)]">value:</span>{" "}
          <span className="text-white">{p.data.varValue || "—"}</span>
        </div>
      </div>
    </NodeShell>
  );
}

const actionLabel: Record<string, string> = {
  audit_site: "Auditar site",
  calendar: "Oferecer horário",
  webhook: "Webhook externo",
};

export function ActionNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell
      node={p}
      handles={
        <>
          <Handle type="target" position={Position.Left} />
          <Handle id="ok" type="source" position={Position.Right} style={{ top: "35%" }} />
          <Handle id="fail" type="source" position={Position.Right} style={{ top: "75%" }} />
        </>
      }
    >
      <div className="space-y-2">
        <div className="text-sm">{actionLabel[p.data.actionType ?? "audit_site"]}</div>
        <div className="flex flex-col gap-1 text-[10px]">
          <span style={{ color: "#35a670" }}>→ ok</span>
          <span style={{ color: "#d91616" }}>→ falha</span>
        </div>
      </div>
    </NodeShell>
  );
}

const resultLabel: Record<string, string> = {
  meeting: "Reunião marcada",
  rejected: "Rejeitado",
  followup: "Followup",
};

export function EndNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell node={p} outHandle={false}>
      <div className="space-y-1">
        <div className="text-sm">{resultLabel[p.data.result ?? "meeting"]}</div>
        {p.data.note && (
          <p className="line-clamp-2 text-xs text-[color:var(--color-text-muted)]">
            {p.data.note}
          </p>
        )}
      </div>
    </NodeShell>
  );
}

export function LogNode(p: NodeProps<FlowNode>) {
  return (
    <NodeShell node={p}>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[color:var(--color-text-muted)]">Postgres</span>
          <span style={{ color: "#35a670" }}>ativo</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[color:var(--color-text-muted)]">Sheets</span>
          <span style={{ color: p.data.sheetsEnabled ? "#35a670" : "#9ca3af" }}>
            {p.data.sheetsEnabled ? "ativo" : "off"}
          </span>
        </div>
      </div>
    </NodeShell>
  );
}

export const nodeTypeComponents = {
  start: StartNode,
  send: SendMessageNode,
  ai: AiMessageNode,
  wait: WaitNode,
  conditional: ConditionalNode,
  variable: SetVariableNode,
  action: ActionNode,
  end: EndNode,
  log: LogNode,
};
