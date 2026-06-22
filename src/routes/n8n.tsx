import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api";
import type { N8nWorkflow } from "@/api";
import { toast } from "sonner";
import { Workflow as WorkflowIcon, Power, PowerOff, Save, RefreshCw } from "lucide-react";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/n8n")({
  head: () => ({
    meta: [{ title: "N8N — SDR Totum" }],
  }),
  component: N8nPage,
});

/**
 * Campos que o PUT /workflows/:id do n8n aceita. Mandar o objeto inteiro de
 * volta (com id/createdAt/etc.) faz o n8n responder 400 "must NOT have
 * additional properties". Então o round-trip preserva só estes — o resto da
 * estrutura (nodes/connections/settings) vai intacto = lossless de verdade.
 */
const PUT_KEYS = ["name", "nodes", "connections", "settings", "staticData"] as const;

function toPutPayload(wf: N8nWorkflow, name: string): N8nWorkflow {
  const out: N8nWorkflow = {};
  for (const k of PUT_KEYS) if (k in wf) out[k] = wf[k];
  out.name = name;
  return out;
}

function WorkflowDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: wf, isLoading } = useQuery({
    queryKey: ["n8n-workflow", id],
    queryFn: () => api.getN8nWorkflow(id),
  });

  const [name, setName] = useState<string | null>(null);
  // nome efetivo: o rascunho local (se editado) ou o valor vindo do n8n
  const effectiveName = name ?? (wf ? String(wf.name ?? "") : "");
  const active = Boolean(wf?.active);

  const saveName = useMutation({
    mutationFn: () => api.updateN8nWorkflow(id, toPutPayload(wf as N8nWorkflow, effectiveName)),
    onSuccess: () => {
      toast.success("Workflow atualizado (PUT)");
      setName(null);
      qc.invalidateQueries({ queryKey: ["n8n-workflow", id] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (next: boolean) => api.setN8nWorkflowActive(id, next),
    onSuccess: (_d, next) => {
      toast.success(next ? "Workflow ativado" : "Workflow desativado");
      qc.invalidateQueries({ queryKey: ["n8n-workflow", id] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !wf) {
    return (
      <div className="p-6 text-sm text-[color:var(--color-text-muted)]">Carregando workflow…</div>
    );
  }

  const dirty = name !== null && name !== String(wf.name ?? "");

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Campos escalares editáveis (round-trip seguro) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[color:var(--color-text-muted)]">Nome</label>
          <div className="flex gap-2">
            <Input value={effectiveName} onChange={(e) => setName(e.target.value)} />
            <TotumButton
              variant="primary"
              size="sm"
              onClick={() => saveName.mutate()}
              disabled={!dirty || saveName.isPending}
            >
              <Save className="size-3.5" /> Salvar (PUT)
            </TotumButton>
          </div>
        </div>

        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "#1f192a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            {active ? (
              <Power className="size-4 text-[#35a670]" />
            ) : (
              <PowerOff className="size-4 text-[color:var(--color-text-muted)]" />
            )}
            <span className="text-sm text-white">{active ? "Ativo" : "Inativo"}</span>
          </div>
          <Switch
            checked={active}
            disabled={toggleActive.isPending}
            onCheckedChange={(v) => toggleActive.mutate(v)}
          />
        </div>
      </div>

      {/* JSON read-only */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-[color:var(--color-text-muted)]">JSON (read-only)</label>
          <span className="text-[10px] text-[color:var(--color-text-muted)]">id: {id}</span>
        </div>
        <pre
          className="max-h-[55vh] overflow-auto rounded-xl p-4 text-xs leading-relaxed text-[#d1cece]"
          style={{
            background: "#0e0918",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {JSON.stringify(wf, null, 2)}
        </pre>
      </div>

      {/* Fase 2 — documentado, não gerar workflow quebrado agora */}
      <p className="text-[11px] leading-relaxed text-[color:var(--color-text-muted)]">
        <strong className="text-white">Fase 2 (TODO):</strong> transpiler do nosso formato de flow →
        workflow n8n. Formatos diferentes; não geramos workflow n8n a partir do nosso flow ainda
        para não criar workflow quebrado.
      </p>
    </div>
  );
}

function N8nPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const {
    data: list = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["n8n-workflows"],
    queryFn: () => api.listN8nWorkflows(),
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0e0918" }}>
      {/* Lista */}
      <div
        className="w-80 shrink-0 flex flex-col overflow-hidden"
        style={{ boxShadow: "inset -1px 0 0 0 #1f192a" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          <div className="flex items-center gap-2">
            <WorkflowIcon className="size-4 text-[#e3433e]" />
            <h1 className="text-sm text-white">N8N Workflows</h1>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["n8n-workflows"] })}
            className="text-[color:var(--color-text-muted)] hover:text-white"
            title="Recarregar"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="px-5 py-4 text-sm text-[color:var(--color-text-muted)]">Carregando…</p>
          )}
          {isError && (
            <p className="px-5 py-4 text-sm text-[#d91616]">
              {(error as Error)?.message ?? "Falha ao listar workflows"}
            </p>
          )}
          {!isLoading && !isError && list.length === 0 && (
            <p className="px-5 py-4 text-sm text-[color:var(--color-text-muted)]">
              Nenhum workflow.
            </p>
          )}
          {list.map((w) => {
            const selected = w.id === selectedId;
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors"
                style={{
                  background: selected ? "#1f192a" : "transparent",
                  boxShadow: "inset 0 -1px 0 0 rgba(255,255,255,0.04)",
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{w.name}</p>
                  <p className="truncate text-[10px] text-[color:var(--color-text-muted)]">
                    {w.id}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: w.active ? "rgba(53,166,112,0.15)" : "#272333",
                    color: w.active ? "#35a670" : "#9ca3af",
                  }}
                >
                  {w.active ? "ativo" : "inativo"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe */}
      <div className="flex-1 overflow-y-auto">
        {selectedId ? (
          <WorkflowDetail id={selectedId} key={selectedId} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Selecione um workflow para ver o JSON e editar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
