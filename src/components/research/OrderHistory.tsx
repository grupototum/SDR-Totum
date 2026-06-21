/**
 * OrderHistory.tsx
 * Histórico das ordens de pesquisa — modos Lista | Card (preferência em localStorage).
 * Ações: Ver prompt (modal), Duplicar (reabre o wizard pré-preenchido).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Copy, FileText, X } from "lucide-react";
import { api, type ResearchOrder } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import { generateResearchPrompt } from "@/lib/research-prompt";

const VIEW_KEY = "totum:research-history-view";

function geoSummary(order: ResearchOrder): string {
  return order.data.geography
    .filter((g) => g.cities.length > 0)
    .map((g) => `${g.uf} (${g.cities.length})`)
    .join(", ");
}

const STATUS_LABEL: Record<ResearchOrder["status"], string> = {
  rascunho: "Rascunho",
  pronta: "Pronta",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

function PromptModal({ order, onClose }: { order: ResearchOrder; onClose: () => void }) {
  const prompt = generateResearchPrompt(order.data);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(14,9,24,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl p-6"
        style={{ background: "#1b1728", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base text-white">{order.name}</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--color-text-muted)] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <pre
          className="flex-1 overflow-auto rounded-xl p-4 text-[12px] leading-relaxed text-[color:var(--color-text-body)] whitespace-pre-wrap"
          style={{
            background: "#0e0918",
            boxShadow: "inset 0 0 0 1px #1f192a",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {prompt}
        </pre>
      </div>
    </div>
  );
}

export function OrderHistory({ onDuplicate }: { onDuplicate: (id: string) => void }) {
  const [view, setView] = useState<"list" | "card">(() => {
    if (typeof window === "undefined") return "list";
    return (window.localStorage.getItem(VIEW_KEY) as "list" | "card") || "list";
  });
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["research-orders"],
    queryFn: () => api.listResearchOrders(),
  });

  const setMode = (m: "list" | "card") => {
    setView(m);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, m);
  };

  const preview = orders.find((o) => o.id === previewId) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      {preview && <PromptModal order={preview} onClose={() => setPreviewId(null)} />}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[color:var(--color-text-muted)]">{orders.length} ordem(ns)</p>
        <div className="flex gap-1 rounded-full p-1" style={{ background: "#1f192a" }}>
          <button
            onClick={() => setMode("list")}
            className="rounded-full p-1.5"
            style={{
              background: view === "list" ? "#da2128" : "transparent",
              color: view === "list" ? "#fff" : "#9ca3af",
            }}
            title="Lista"
          >
            <List className="size-3.5" />
          </button>
          <button
            onClick={() => setMode("card")}
            className="rounded-full p-1.5"
            style={{
              background: view === "card" ? "#da2128" : "transparent",
              color: view === "card" ? "#fff" : "#9ca3af",
            }}
            title="Card"
          >
            <LayoutGrid className="size-3.5" />
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Carregando…</p>}
      {!isLoading && orders.length === 0 && (
        <p
          className="rounded-2xl p-8 text-center text-sm text-[color:var(--color-text-muted)]"
          style={{ background: "#1b1728" }}
        >
          Nenhuma ordem salva ainda. Crie uma no wizard de Pesquisa.
        </p>
      )}

      {/* Lista */}
      {view === "list" && orders.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                <th className="px-4 py-3 font-normal">Nome</th>
                <th className="px-4 py-3 font-normal">Nicho</th>
                <th className="px-4 py-3 font-normal">Geografia</th>
                <th className="px-4 py-3 font-normal">Criada em</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
                  <td className="max-w-[220px] truncate px-4 py-3 text-white">{o.name}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-body)]">{o.data.niche}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {geoSummary(o)}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{ background: "#1f192a", color: "#a06ff6" }}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPreviewId(o.id)}
                        className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                        title="Ver prompt"
                      >
                        <FileText className="size-3.5" />
                      </button>
                      <button
                        onClick={() => onDuplicate(o.id)}
                        className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                        title="Duplicar"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card */}
      {view === "card" && orders.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-col gap-3 rounded-3xl p-5"
              style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm text-white">{o.name}</h3>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: "#1f192a", color: "#a06ff6" }}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
              <div className="space-y-1 text-xs text-[color:var(--color-text-muted)]">
                <div>{o.data.niche}</div>
                <div>{geoSummary(o)}</div>
                <div>{new Date(o.createdAt).toLocaleDateString("pt-BR")}</div>
                <div>{o.data.outputFields.length} campo(s) de saída</div>
              </div>
              <div className="mt-auto flex gap-2">
                <TotumButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewId(o.id)}
                  className="flex-1"
                >
                  <FileText className="size-3.5" /> Prompt
                </TotumButton>
                <TotumButton
                  variant="outline"
                  size="sm"
                  onClick={() => onDuplicate(o.id)}
                  className="flex-1"
                >
                  <Copy className="size-3.5" /> Duplicar
                </TotumButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
