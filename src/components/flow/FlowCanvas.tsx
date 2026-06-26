import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useFlowStore, type NodeKind } from "@/stores/flow-store";
import { nodeTypeComponents } from "./nodes";
import { NodeTray } from "./NodeTray";

const CANVAS_STYLE: React.CSSProperties = { background: "#0e0918" };

function FlowCanvasInner() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const addNode = useFlowStore((s) => s.addNode);
  const setSelected = useFlowStore((s) => s.setSelected);
  const setSelectedEdge = useFlowStore((s) => s.setSelectedEdge);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/node-kind") as NodeKind;
      if (!kind) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(kind, position);
    },
    [addNode, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, n: Node) => setSelected(n.id),
    [setSelected],
  );
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, e: Edge) => setSelectedEdge(e.id),
    [setSelectedEdge],
  );
  const handlePaneClick = useCallback(() => setSelected(null), [setSelected]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypeComponents}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
        style={CANVAS_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={1.5} color="#272333" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-right"
          style={{ marginBottom: 140 }}
          nodeColor="#272333"
          maskColor="rgba(14,9,24,0.7)"
          pannable
          zoomable
        />
      </ReactFlow>
      <NodeTray />
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
