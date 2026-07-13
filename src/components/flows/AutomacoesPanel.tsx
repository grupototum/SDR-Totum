/**
 * AutomacoesPanel.tsx — painel n8n movido de builder.edit.tsx (Fase 1 da
 * consolidação do Builder). Sem entrada de navegação por enquanto: o destino
 * (rota própria /automacoes ou outro lugar) será decidido na Entrega 2.
 *
 * FRONTEIRA OBRIGATÓRIA — n8n é NAVEGAÇÃO unificada, não funcional:
 *   - Motor (flow stages) e n8n (workflows) têm storage e endpoints SEPARADOS.
 *   - Publicar o flow NÃO publica workflows n8n.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { N8nWorkflow } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Power, PowerOff, Save, RefreshCw } from "lucide-react";

const PUT_KEYS = ["name", "nodes", "connections", "settings", "staticData"] as const;

function toPutPayload(wf: N8nWorkflow, name: string): N8nWorkflow {
  const out: N8nWorkflow = {};
  for (const k of PUT_KEYS) if (k in wf) out[k] = wf[k];
  out.name = name;
  return out;
}

export function N8nDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: wf, isLoading } = useQuery({
    queryKey: ["n8n-workflow", id],
    queryFn: () => api.getN8nWorkflow(id),
  });
  const [name, setName] = useState<string | null>(null);
  const effectiveName = name ?? (wf ? String(wf.name ?? "") : "");
  const active = Boolean(wf?.active);

  const saveName = useMutation({
    mutationFn: () => api.updateN8nWorkflow(id, toPutPayload(wf as N8nWorkflow, effectiveName)),
    onSuccess: () => {
      toast.success("Workflow salvo");
      setName(null);
      qc.invalidateQueries({ queryKey: ["n8n-workflow", id] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleActive = useMutation({
    mutationFn: (next: boolean) => api.setN8nWorkflowActive(id, next),
    onSuccess: (_d, next) => {
      toast.success(next ? "Ativado" : "Desativado");
      qc.invalidateQueries({ queryKey: ["n8n-workflow", id] });
      qc.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !wf)
    return <div className="p-6 text-sm text-[color:var(--color-text-muted)]">Carregando…</div>;

  const dirty = name !== null && name !== String(wf.name ?? "");
  return (
    <div className="flex flex-col gap-5 p-6">
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
            <Save className="size-3.5" /> Salvar
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-[color:var(--color-text-muted)]">JSON (read-only)</label>
          <span className="text-[10px] text-[color:var(--color-text-muted)]">id: {id}</span>
        </div>
        <pre
          className="max-h-[50vh] overflow-auto rounded-xl p-4 text-xs leading-relaxed text-[#d1cece]"
          style={{
            background: "#0e0918",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            fontFamily: "ui-monospace, Menlo, monospace",
          }}
        >
          {JSON.stringify(wf, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export function AutomacoesPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    <div className="flex" style={{ height: "calc(100vh - 96px)" }}>
      {/* Lista */}
      <div
        className="w-72 shrink-0 flex flex-col overflow-hidden"
        style={{ boxShadow: "inset -1px 0 0 0 #1f192a" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ boxShadow: "inset 0 -1px 0 0 #1f192a" }}
        >
          <span className="text-sm text-white">Workflows</span>
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
            <p className="px-4 py-4 text-sm text-[color:var(--color-text-muted)]">Carregando…</p>
          )}
          {isError && (
            <p className="px-4 py-4 text-sm text-[#d91616]">
              {(error as Error)?.message ?? "Falha ao listar"}
            </p>
          )}
          {!isLoading && !isError && list.length === 0 && (
            <p className="px-4 py-4 text-sm text-[color:var(--color-text-muted)]">
              Nenhum workflow.
            </p>
          )}
          {list.map((w) => {
            const selected = w.id === selectedId;
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors"
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
          <N8nDetail id={selectedId} key={selectedId} />
        ) : (
          <div className="flex h-full items-center justify-center text-center px-6">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Selecione um workflow para ver o JSON e editar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
