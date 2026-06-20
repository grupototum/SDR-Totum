import { Handle, Position, type NodeProps } from "@xyflow/react";
import { type ReactNode } from "react";
import { useFlowStore, type FlowNode } from "@/stores/flow-store";
import { nodeMeta } from "./node-types";
import { AlertCircle } from "lucide-react";

interface NodeShellProps {
  node: NodeProps<FlowNode>;
  children?: ReactNode;
  /** custom handles override default in+out */
  handles?: ReactNode;
  inHandle?: boolean;
  outHandle?: boolean;
}

export function NodeShell({
  node,
  children,
  handles,
  inHandle = true,
  outHandle = true,
}: NodeShellProps) {
  const meta = nodeMeta(node.type as never);
  const Icon = meta.icon;
  const selected = node.selected;
  const status = node.data.status;
  const hasError = status === "error";

  const shadow = hasError
    ? "var(--shadow-node-error)"
    : selected
      ? "var(--shadow-node-selected)"
      : "var(--shadow-card)";

  return (
    <div
      className="relative w-[240px] rounded-2xl p-4 transition-all"
      style={{
        background: "#1b1728",
        boxShadow: shadow,
        borderRadius: 16,
      }}
    >
      {hasError && (
        <div
          className="absolute -right-1 -top-1 rounded-full p-1 text-white"
          style={{ background: "#d91616" }}
          title={node.data.errorMsg || "Erro"}
        >
          <AlertCircle className="size-3" />
        </div>
      )}
      {status === "running" && (
        <div
          className="absolute -right-1 -top-1 animate-pulse rounded-full px-2 py-0.5 text-[10px] text-white"
          style={{ background: "#077ac7" }}
        >
          Rodando…
        </div>
      )}
      {status === "ok" && (
        <div
          className="absolute -right-1 -top-1 rounded-full px-2 py-0.5 text-[10px] text-white"
          style={{ background: "#35a670" }}
        >
          OK
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
          style={meta.badgeStyle}
        >
          <Icon className="size-3" />
          {meta.badgeLabel}
        </span>
      </div>

      <div className="text-sm text-white/90">{children}</div>

      {handles ?? (
        <>
          {inHandle && <Handle type="target" position={Position.Left} />}
          {outHandle && <Handle type="source" position={Position.Right} />}
        </>
      )}
    </div>
  );
}
