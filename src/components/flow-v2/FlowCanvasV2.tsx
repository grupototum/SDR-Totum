import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { useFlowV2Store } from "@/stores/flow-v2-store";
import { extractPlaceholders, findOrphanStageIds, registeredVariableNames } from "@/lib/flow-v2";
import { StageNode, type StageNodeData } from "./StageNode";

const nodeTypes: NodeTypes = { stage: StageNode };
const CANVAS_STYLE: React.CSSProperties = { background: "#f6f7f9" };
const COL_WIDTH = 300;
const ROW_HEIGHT = 180;

/**
 * Layout determinístico por profundidade a partir do entry_stage seguindo `next`.
 * Não persiste posição no JSON (mantém o round-trip lossless) — recalculado a
 * cada render a partir da própria ordem/topologia dos estágios.
 */
function layoutStages(
  stageIds: string[],
  entry: string,
  nextOf: Map<string, string | null>,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  let cursor = entry;
  let col = 0;
  while (cursor && stageIds.includes(cursor) && !visited.has(cursor)) {
    pos.set(cursor, { x: col * COL_WIDTH, y: 0 });
    visited.add(cursor);
    col += 1;
    cursor = nextOf.get(cursor) ?? "";
  }
  // Estágios fora da cadeia principal (órfãos, ramificações) — linha própria abaixo.
  let extraRow = 1;
  for (const id of stageIds) {
    if (!pos.has(id)) {
      pos.set(id, { x: 0, y: extraRow * ROW_HEIGHT });
      extraRow += 1;
    }
  }
  return pos;
}

function FlowCanvasV2Inner({ onSelectStage }: { onSelectStage?: () => void }) {
  const flow = useFlowV2Store((s) => s.flow)!;
  const selectedStageId = useFlowV2Store((s) => s.selectedStageId);
  const selectStage = useFlowV2Store((s) => s.selectStage);
  const setStageNext = useFlowV2Store((s) => s.setStageNext);

  const orphans = useMemo(() => findOrphanStageIds(flow), [flow]);
  const registered = useMemo(() => registeredVariableNames(flow), [flow]);

  const nodes: Node<StageNodeData>[] = useMemo(() => {
    const stageIds = flow.stages.map((s) => s.id);
    const nextOf = new Map(flow.stages.map((s) => [s.id, s.next ?? null]));
    const positions = layoutStages(stageIds, flow.entry_stage, nextOf);
    return flow.stages.map((stage) => {
      const placeholders = extractPlaceholders(stage);
      const hasUnregisteredPlaceholder = placeholders.some((p) => !registered.has(p));
      return {
        id: stage.id,
        type: "stage",
        position: positions.get(stage.id) ?? { x: 0, y: 0 },
        selected: stage.id === selectedStageId,
        data: {
          stage,
          isEntry: stage.id === flow.entry_stage,
          isOrphan: orphans.has(stage.id),
          hasUnregisteredPlaceholder,
        },
      };
    });
  }, [flow, selectedStageId, orphans, registered]);

  const edges: Edge[] = useMemo(
    () =>
      flow.stages
        .filter((s) => s.next && flow.stages.some((t) => t.id === s.next))
        .map((s) => ({
          id: `${s.id}->${s.next}`,
          source: s.id,
          target: s.next as string,
          animated: true,
        })),
    [flow],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      setStageNext(conn.source, conn.target);
    },
    [setStageNext],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) setStageNext(e.source, null);
    },
    [setStageNext],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, n: Node) => {
      selectStage(n.id);
      onSelectStage?.();
    },
    [selectStage, onSelectStage],
  );
  const onPaneClick = useCallback(() => selectStage(null), [selectStage]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
        style={CANVAS_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={1.5} color="#eef0f3" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor="#d7dade"
          maskColor="rgba(246,247,249,0.75)"
          bgColor="#ffffff"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvasV2({ onSelectStage }: { onSelectStage?: () => void } = {}) {
  return (
    <ReactFlowProvider>
      <FlowCanvasV2Inner onSelectStage={onSelectStage} />
    </ReactFlowProvider>
  );
}
