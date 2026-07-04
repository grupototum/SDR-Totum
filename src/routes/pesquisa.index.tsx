/**
 * pesquisa.index.tsx — landing da Pesquisa.
 * Card+lista+busca do histórico de ordens + ação "Usar no Builder".
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  FileText,
  Copy,
  Workflow,
  X,
  ArrowUpDown,
} from "lucide-react";
import { api, type ResearchOrder } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import { generateResearchPrompt } from "@/lib/research-prompt";
import { toast } from "sonner";

const VIEW_KEY = "totum:research-history-view";

const STATUS_LABEL: Record<ResearchOrder["status"], string> = {
  rascunho: "Rascunho",
  pronta: "Pronta",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

function geoSummary(order: ResearchOrder): string {
  return order.data.geography
    .filter((g) => g.cities.length > 0)
    .map((g) => `${g.uf} (${g.cities.length})`)
    .join(", ");
}

function PromptModal({ order, onClose }: { order: ResearchOrder; onClose: () => void }) {
  const prompt = order.prompt || generateResearchPrompt(order.data);
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

export const Route = createFileRoute("/pesquisa/")({
  head: () => ({
    meta: [{ title: "Pesquisa — SDR Totum" }],
  }),
  component: PesquisaIndexPage,
});

function PesquisaIndexPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "card">(() => {
    if (typeof window === "undefined") return "list";
    return (window.localStorage.getItem(VIEW_KEY) as "list" | "card") || "list";
  });
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name_asc">("date_desc");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["research-orders"],
    queryFn: () => api.listResearchOrders(),
  });

  const setMode = (m: "list" | "card") => {
    setView(m);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, m);
  };

  const ufOptions = useMemo(() => {
    const ufs = new Set<string>();
    orders.forEach((o) => o.data.geography.forEach((g) => g.uf && ufs.add(g.uf)));
    return Array.from(ufs).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = (hay: string) => tokens.every((t) => hay.includes(t));
    const list = orders.filter((o) => {
      const ufs = o.data.geography.map((g) => g.uf).join(" ");
      const hay = `${o.name} ${o.data.niche} ${ufs}`.toLowerCase();
      if (q && !matches(hay)) return false;
      if (ufFilter && !o.data.geography.some((g) => g.uf === ufFilter)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortBy === "date_asc" ? da - db : db - da;
    });
  }, [orders, search, ufFilter, sortBy]);

  const preview = orders.find((o) => o.id === previewId) ?? null;

  function usarNoBuilder(order: ResearchOrder) {
    // Navega pro builder com o nicho/nome da ordem como referência.
    // O flow em si é independente — só é uma ação de navegação conveniente.
    navigate({ to: "/builder" });
    toast.info(`Abrir o Builder e crie um flow para o nicho: ${order.data.niche}`);
  }

  return (
    <main className="min-h-screen" style={{ background: "#0e0918" }}>
      {preview && <PromptModal order={preview} onClose={() => setPreviewId(null)} />}

      <header
        className="sticky top-0 z-10 flex h-14 items-center justify-between px-6"
        style={{
          background: "rgba(14,9,24,0.9)",
          backdropFilter: "blur(16px)",
          boxShadow: "inset 0 -1px 0 0 #1f192a",
        }}
      >
        <div className="flex items-center gap-2">
          <Search className="size-4 text-[#da2128]" />
          <span className="text-sm text-white">Pesquisa</span>
        </div>
        <TotumButton variant="primary" size="sm" onClick={() => navigate({ to: "/pesquisa/nova" })}>
          <Plus className="size-3.5" /> Nova pesquisa
        </TotumButton>
      </header>

      <section className="p-6">
        <div className="mx-auto max-w-5xl">
          {/* Toolbar */}
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex flex-1 items-center gap-2 rounded-xl px-3"
              style={{ background: "#1b1728", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
            >
              <Search className="size-3.5 shrink-0 text-[color:var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, nicho ou UF…"
                className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-[color:var(--color-text-muted)] outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-[color:var(--color-text-muted)] hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <select
              value={ufFilter}
              onChange={(e) => setUfFilter(e.target.value)}
              className="rounded-xl bg-[#1b1728] px-3 py-2.5 text-xs text-white outline-none"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
              title="Filtrar por UF"
            >
              <option value="">Todas UF</option>
              {ufOptions.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl bg-[#1b1728] px-3 py-2.5 text-xs text-white outline-none"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
              title="Ordenar"
            >
              <option value="date_desc">Mais recentes</option>
              <option value="date_asc">Mais antigas</option>
              <option value="name_asc">Nome (A–Z)</option>
            </select>
            <div className="flex gap-1 rounded-full p-1" style={{ background: "#1b1728" }}>
              {(["list", "card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="rounded-full p-1.5"
                  style={{
                    background: view === m ? "#da2128" : "transparent",
                    color: view === m ? "#fff" : "#9ca3af",
                  }}
                  title={m === "list" ? "Lista" : "Cards"}
                >
                  {m === "list" ? (
                    <List className="size-3.5" />
                  ) : (
                    <LayoutGrid className="size-3.5" />
                  )}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[color:var(--color-text-muted)]">
              {filtered.length} ordem{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Carregando…</p>}
          {!isLoading && filtered.length === 0 && (
            <p
              className="rounded-2xl p-10 text-center text-sm text-[color:var(--color-text-muted)]"
              style={{ background: "#1b1728" }}
            >
              {search ? (
                "Nenhuma ordem encontrada."
              ) : (
                <>
                  Nenhuma ordem ainda.{" "}
                  <Link to="/pesquisa/nova" className="text-[#ef9a9a] hover:underline">
                    Criar primeira pesquisa
                  </Link>
                </>
              )}
            </p>
          )}

          {/* Lista */}
          {view === "list" && filtered.length > 0 && (
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
                  {filtered.map((o) => (
                    <tr key={o.id} style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
                      <td className="max-w-[200px] truncate px-4 py-3 text-white">{o.name}</td>
                      <td className="px-4 py-3 text-[color:var(--color-text-body)]">
                        {o.data.niche}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                        {geoSummary(o)}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                        {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px]"
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
                            onClick={() =>
                              navigate({ to: "/pesquisa/nova", search: { dup: o.id } })
                            }
                            className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                            title="Duplicar"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            onClick={() => usarNoBuilder(o)}
                            className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-[#e3433e]"
                            title="Usar no Builder"
                          >
                            <Workflow className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards */}
          {view === "card" && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((o) => (
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
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate({ to: "/pesquisa/nova", search: { dup: o.id } })}
                    >
                      <Copy className="size-3.5" />
                    </TotumButton>
                    <TotumButton
                      variant="outline"
                      size="sm"
                      onClick={() => usarNoBuilder(o)}
                      title="Usar no Builder"
                      style={{ color: "#e3433e", borderColor: "#da2128" }}
                    >
                      <Workflow className="size-3.5" />
                    </TotumButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
