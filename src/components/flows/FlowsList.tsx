/**
 * FlowsList.tsx — landing do Builder: card+lista, busca, ações.
 * Toggle de view persistido em localStorage.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LayoutGrid, List, Search, Pencil, Copy, Rocket, CheckCircle2, X } from "lucide-react";
import { api, type FlowSummary } from "@/api";
import { TotumButton } from "@/components/ui/totum-button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const VIEW_KEY = "totum:flows-list-view";

function FlowCard({
  flow,
  onOpen,
  onDuplicate,
  onActivate,
}: {
  flow: FlowSummary;
  onOpen: () => void;
  onDuplicate: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-5 cursor-pointer transition-colors hover:bg-[#201b2d]"
      style={{ background: "#1b1728", boxShadow: "var(--shadow-card)" }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm text-white truncate">{flow.name}</h3>
        {flow.active && (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: "rgba(53,166,112,0.15)", color: "#35a670" }}
          >
            <CheckCircle2 className="size-3" /> ativo
          </span>
        )}
      </div>
      <div className="space-y-1 text-[11px] text-[color:var(--color-text-muted)]">
        <div>
          v{flow.version} · {flow.niche || "—"}
        </div>
        <div>{new Date(flow.updatedAt).toLocaleDateString("pt-BR")}</div>
        <div className="font-mono text-[10px] opacity-60">{flow.id}</div>
      </div>
      <div className="mt-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
        <TotumButton variant="ghost" size="sm" onClick={onOpen} className="flex-1">
          <Pencil className="size-3.5" /> Editar
        </TotumButton>
        <TotumButton variant="ghost" size="sm" onClick={onDuplicate} title="Duplicar">
          <Copy className="size-3.5" />
        </TotumButton>
        <TotumButton
          variant="ghost"
          size="sm"
          onClick={onActivate}
          title="Ativar"
          disabled={flow.active}
          style={flow.active ? undefined : { color: "#e3433e" }}
        >
          <Rocket className="size-3.5" />
        </TotumButton>
      </div>
    </div>
  );
}

export function FlowsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [view, setView] = useState<"list" | "card">(() => {
    if (typeof window === "undefined") return "list";
    return (window.localStorage.getItem(VIEW_KEY) as "list" | "card") || "list";
  });
  const [search, setSearch] = useState("");
  const [pendingActivate, setPendingActivate] = useState<FlowSummary | null>(null);

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      const src = await api.getFlow(id);
      const copy = { ...src, name: `${String(src.name ?? id)} (cópia)`, active: false };
      const { id: newId } = await api.createFlow(copy);
      return newId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Flow duplicado");
      navigate({ to: "/builder/edit", search: { flow: newId } });
    },
    onError: (e) => toast.error(`Erro ao duplicar: ${(e as Error).message}`),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.publishFlow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Flow ativado");
    },
    onError: (e) => toast.error(`Erro ao ativar: ${(e as Error).message}`),
  });

  const setMode = (m: "list" | "card") => {
    setView(m);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, m);
  };

  const filtered = flows.filter(
    (f) =>
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      (f.niche ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const openFlow = (id: string) => navigate({ to: "/builder/edit", search: { flow: id } });

  return (
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
            placeholder="Buscar flows…"
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
              {m === "list" ? <List className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[color:var(--color-text-muted)]">
          {filtered.length} flow{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Carregando…</p>}
      {!isLoading && filtered.length === 0 && (
        <p
          className="rounded-2xl p-10 text-center text-sm text-[color:var(--color-text-muted)]"
          style={{ background: "#1b1728" }}
        >
          {search ? "Nenhum flow encontrado." : "Nenhum flow salvo. Crie o primeiro!"}
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
                <th className="px-4 py-3 font-normal">Versão</th>
                <th className="px-4 py-3 font-normal">Atualizado</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  className="cursor-pointer hover:bg-[#201b2d] transition-colors"
                  style={{ boxShadow: "inset 0 1px 0 0 #1f192a" }}
                  onClick={() => openFlow(f.id)}
                >
                  <td className="max-w-[220px] truncate px-4 py-3 text-white">{f.name}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-body)]">
                    {f.niche || "—"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">v{f.version}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {new Date(f.updatedAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    {f.active ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: "rgba(53,166,112,0.15)", color: "#35a670" }}
                      >
                        <CheckCircle2 className="size-3" /> ativo
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: "#272333", color: "#9ca3af" }}
                      >
                        rascunho
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openFlow(f.id)}
                        className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => duplicateMut.mutate(f.id)}
                        className="rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:text-white"
                        title="Duplicar"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      {!f.active && (
                        <button
                          onClick={() => setPendingActivate(f)}
                          className="rounded-md p-1.5 text-[#e3433e] hover:text-white"
                          title="Ativar"
                        >
                          <Rocket className="size-3.5" />
                        </button>
                      )}
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
          {filtered.map((f) => (
            <FlowCard
              key={f.id}
              flow={f}
              onOpen={() => openFlow(f.id)}
              onDuplicate={() => duplicateMut.mutate(f.id)}
              onActivate={() => setPendingActivate(f)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingActivate} onOpenChange={(o) => !o && setPendingActivate(null)}>
        <AlertDialogContent
          className="border-0"
          style={{ background: "#1b1728", color: "#fff", boxShadow: "var(--shadow-card)" }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Ativar este flow?</AlertDialogTitle>
            <AlertDialogDescription className="text-[color:var(--color-text-muted)]">
              {pendingActivate ? (
                <>
                  Você está prestes a <strong className="text-white">publicar</strong>{" "}
                  <span className="text-white">{pendingActivate.name}</span> (v{pendingActivate.version}).
                  Conversas em produção passarão a usar esta versão imediatamente.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white hover:bg-[hsla(0,0%,100%,0.07)] border-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#da2128] text-white hover:bg-[#e3433e]"
              onClick={() => {
                if (pendingActivate) activateMut.mutate(pendingActivate.id);
                setPendingActivate(null);
              }}
            >
              Sim, ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
