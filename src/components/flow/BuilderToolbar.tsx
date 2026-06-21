import { useRef } from "react";
import { useFlowStore } from "@/stores/flow-store";
import { TotumButton } from "@/components/ui/totum-button";
import { ChevronRight, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export function BuilderToolbar() {
  const flowName = useFlowStore((s) => s.flowName);
  const setFlowName = useFlowStore((s) => s.setFlowName);
  const loadFlow = useFlowStore((s) => s.loadFlow);
  const exportToJSON = useFlowStore((s) => s.exportToJSON);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string;
        loadFlow(json);
        toast.success("Flow importado com sucesso!");
      } catch (err) {
        toast.error(`Erro ao importar: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
  }

  function handleExport() {
    try {
      const json = exportToJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${flowName.replace(/\s+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Flow exportado!");
    } catch (err) {
      toast.error(`Erro ao exportar: ${(err as Error).message}`);
    }
  }

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 px-5"
      style={{
        background: "rgba(27, 23, 40, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "inset 0 -1px 0 0 #1f192a",
      }}
    >
      {/* Flow name */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">Flows</span>
        <ChevronRight className="size-3.5 text-[color:var(--color-text-muted)]" />
        <input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="bg-transparent text-white outline-none focus:bg-[#1f192a] focus:px-2 focus:py-1 rounded-md"
          style={{ minWidth: 120 }}
        />
      </div>

      {/* Center: import/export */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          title="Importar flow JSON"
        >
          <Upload className="size-3.5" /> Importar JSON
        </TotumButton>
        <TotumButton variant="ghost" size="sm" onClick={handleExport} title="Exportar flow JSON">
          <Download className="size-3.5" /> Exportar JSON
        </TotumButton>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <TotumButton variant="ghost" size="sm" onClick={() => toast.success("Flow salvo")}>
          Salvar
        </TotumButton>
        <TotumButton
          variant="secondary"
          size="sm"
          onClick={() => toast.info("Iniciando teste do flow…")}
        >
          Testar Flow
        </TotumButton>
        <TotumButton variant="primary" size="sm" onClick={() => toast.success("Flow publicado")}>
          Publicar
        </TotumButton>
        <span
          className="rounded-full px-3 py-1 text-[11px]"
          style={{ background: "#1f192a", color: "#a06ff6" }}
        >
          v1.0
        </span>
        <div
          className="flex size-8 items-center justify-center rounded-full text-xs text-white"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          T
        </div>
      </div>
    </header>
  );
}
