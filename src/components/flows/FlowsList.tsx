/**
 * FlowsList.tsx — landing do /builder. Lista os fluxos construídos
 * (GET /api/flows) em modo CARD e LISTA (toggle persistido em localStorage),
 * com busca por nome/nicho. Cada item: nome, status, nº estágios, última
 * edição, ações (abrir / duplicar / ativar).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Copy,
  Rocket,
  CheckCircle2,
  Workflow,
} from "lucide-react";
import { api, type FlowSummary } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import { Input } from "@/components/ui/input";

const VIEW_KEY = "totum:builder-flows-view";

export function FlowsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "card">(() => {
    if (typeof window === "undefined") return "card";
    return (window.localStorage.getItem(VIEW_KEY) as "list" | "card") || "card";
  });
  const [q, setQ] = useState("");

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
  });

  const setMode = (m: "list" | "card") => {
    setView(m);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, m);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return flows;
    return flows.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        (f.niche ?? "").toLowerCase().includes(term) ||
        f.id.toLowerCase().includes(term),
    );
  }, [flows, q]);

  const publish = useMutation({
    mutationFn: (id: string) => api.publishFlow(id),
    onSuccess: () => {
      toast.success("Flow ativado — agora é o roteiro do motor");
      qc.invalidateQueries({ queryKey: ["flows"] });
    },
    onError: (e) => toast.error(`Erro ao ativar: ${(e as Error).message}`),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const flow = await api.getFlow(id);
      const env = { ...flow, name: `${flow.name ?? "flow"} (cópia)` };
      return api.createFlow(env);
    },
    onSuccess: (res) => {
      toast.success("Duplicado — abrindo cópia");
      qc.invalidateQueries({ queryKey: ["flows"] });
      navigate({ to: "/builder/edit", search: { flow: res.id } });
    },
    onError: (e) => toast.error(`Erro ao duplicar: ${(e as Error).message}`),
  });

  return (
    <main className="min-h-screen" style={{ background: "#0e0918" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4"
        style={{
          background: "rgba(14,9,24,0.9)",
          backdropFilter: "blur(16px)",
          boxShadow: "inset 0 -1px 0 0 #1f192a",
        }}
      >
        <h1 className="flex items-center gap-2 text-sm text-white">
          <Workflow className="size-4 text-[#da2128]" /> Builder · Fluxos
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar fluxo…"
              className="h-9 w-64 pl-9"
            />
          </div>
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
          <TotumButton asChild variant="primary" size="sm">
            <Link to="/builder/edit">
              <Plus className="size-3.5" /> Novo flow
            </Link>
          </TotumButton>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        {isLoading && (
          <p className="text-sm text-[color:var(--color-text-muted)]">Carregando fluxos…</p>
        )}

        {!isLoading && filtered.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
          >
            <Workflow className="mx-auto mb-3 size-8 text-[color:var(--color-text-muted)]" />
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {q
                ? "Nenhum fluxo bate com a busca."
                : "Nenhum fluxo salvo ainda. Crie o primeiro com o botão acima."}
            </p>
          </div>
        )}

        {view === "card" && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f) => (
              <FlowCard
                key={f.id}
                flow={f}
                onPublish={() => publish.mutate(f.id)}
                onDuplicate={() => duplicate.mutate(f.id)}
                publishing={publish.isPending}
              />
            ))}
          </div>
        )}

        {view === "list" && filtered.length > 0 && (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  <th className="px-4 py-3 font-normal">Nome</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Nicho</th>
                  <th className="px-4 py-3 font-normal">Versão</th>
                  <th className="px-4 py-3 font-normal">Atualizado</th>
                  <th className="px-4 py-3 font-normal">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}>
                    <td className="px-4 py-3">
                      <Link
                        to="/builder/edit"
                        search={{ flow: f.id }}
                        className="text-white hover:underline"
                      >
                        {f.name}
                      </Link>
                      <div className="text-[10px] text-[color:var(--color-text-muted)]">{f.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={Boolean(f.active)} />
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                      {f.niche || "—"}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                      v{f.version}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                      {f.updatedAt
                        ? new Date(f.updatedAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link
                          to="/builder/edit"
                          search={{ flow: f.id }}
                          className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                          title="Abrir"
                        >
                          <Workflow className="size-3.5" />
                        </Link>
                        <button
                          onClick={() => duplicate.mutate(f.id)}
                          className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                          title="Duplicar"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          onClick={() => publish.mutate(f.id)}
                          disabled={publish.isPending || f.active}
                          className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-[#e3433e] disabled:opacity-30"
                          title={f.active ? "Já ativo" : "Ativar"}
                        >
                          <Rocket className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
      style={{
        background: active ? "rgba(53,166,112,0.15)" : "#1f192a",
        color: active ? "#35a670" : "#9ca3af",
      }}
    >
      {active && <CheckCircle2 className="size-3" />}
      {active ? "Ativo" : "Rascunho"}
    </span>
  );
}

function FlowCard({
  flow,
  onPublish,
  onDuplicate,
  publishing,
}: {
  flow: FlowSummary;
  onPublish: () => void;
  onDuplicate: () => void;
  publishing: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-3xl p-5"
      style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/builder/edit"
          search={{ flow: flow.id }}
          className="text-sm text-white hover:underline"
        >
          {flow.name}
        </Link>
        <StatusBadge active={Boolean(flow.active)} />
      </div>
      <div className="space-y-1 text-xs text-[color:var(--color-text-muted)]">
        <div>Nicho: {flow.niche || "—"}</div>
        <div>Versão: v{flow.version}</div>
        <div>
          Atualizado:{" "}
          {flow.updatedAt ? new Date(flow.updatedAt).toLocaleDateString("pt-BR") : "—"}
        </div>
      </div>
      <div className="mt-auto flex gap-2">
        <TotumButton asChild variant="ghost" size="sm" className="flex-1">
          <Link to="/builder/edit" search={{ flow: flow.id }}>
            <Workflow className="size-3.5" /> Abrir
          </Link>
        </TotumButton>
        <TotumButton variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </TotumButton>
        <TotumButton
          variant="outline"
          size="sm"
          onClick={onPublish}
          disabled={publishing || flow.active}
          title={flow.active ? "Já ativo" : "Ativar"}
        >
          <Rocket className="size-3.5" />
        </TotumButton>
      </div>
    </div>
  );
}
