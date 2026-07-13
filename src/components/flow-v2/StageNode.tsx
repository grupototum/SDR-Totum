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
    ? "0 0 0 2px #f59e0b, 0 1px 3px rgba(16,24,40,0.12)"
    : selected
      ? "0 0 0 2px #da2128, 0 4px 12px rgba(16,24,40,0.18)"
      : isEntry
        ? "0 0 0 2px #35a670, 0 1px 3px rgba(16,24,40,0.12)"
        : "0 1px 3px rgba(16,24,40,0.12)";

  return (
    <div
      className="relative w-[240px] rounded-2xl p-4 transition-all"
      style={{ background: "#ffffff", boxShadow: shadow, borderRadius: 16 }}
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

      <p className="line-clamp-3 text-xs text-[#4b5563]">{stage.goal || "(sem goal)"}</p>

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
