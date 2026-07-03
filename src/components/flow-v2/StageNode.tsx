import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Flag, LogIn } from "lucide-react";
import type { V2Stage } from "@/lib/flow-v2";

export interface StageNodeData extends Record<string, unknown> {
  stage: V2Stage;
  isEntry: boolean;
  isOrphan: boolean;
  hasUnregisteredPlaceholder: boolean;
}

export function StageNode({ data, selected }: NodeProps & { data: StageNodeData }) {
  const { stage, isEntry, isOrphan, hasUnregisteredPlaceholder } = data;

  const shadow = isOrphan
    ? "0 0 0 2px #f59e0b, var(--shadow-card)"
    : selected
      ? "var(--shadow-node-selected)"
      : isEntry
        ? "0 0 0 2px #35a670, var(--shadow-card)"
        : "var(--shadow-card)";

  return (
    <div
      className="relative w-[240px] rounded-2xl p-4 transition-all"
      style={{ background: "#1b1728", boxShadow: shadow, borderRadius: 16 }}
    >
      {isEntry && (
        <div
          className="absolute -left-1 -top-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider text-white"
          style={{ background: "#35a670" }}
          title="Estágio de entrada"
        >
          <LogIn className="size-2.5" /> entrada
        </div>
      )}
      {isOrphan && (
        <div
          className="absolute -right-1 -top-1 rounded-full p-1 text-white"
          style={{ background: "#f59e0b" }}
          title="Nenhum estágio leva até aqui — transição removida ou nunca ligada"
        >
          <AlertTriangle className="size-3" />
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
          style={{ background: "rgba(227,67,62,0.15)", color: "#e3433e" }}
        >
          {stage.id}
        </span>
        {stage.terminal && <Flag className="size-3.5 text-[#35a670]" />}
      </div>

      <p className="line-clamp-3 text-xs text-white/70">{stage.goal || "(sem goal)"}</p>

      {hasUnregisteredPlaceholder && (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-[#f59e0b]">
          <AlertTriangle className="size-3" /> placeholder não registrado
        </p>
      )}

      <Handle type="target" position={Position.Left} />
      {!stage.terminal && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
