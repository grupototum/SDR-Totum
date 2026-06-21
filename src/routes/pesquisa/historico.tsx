import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Copy as Duplicate,
  Eye,
  LayoutGrid,
  List,
  Plus,
  Trash2,
} from "lucide-react";

import { TotumButton } from "@/components/ui/totum-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useResearchOrders } from "@/hooks/use-research-orders";
import { deleteOrder } from "@/lib/research/storage";
import type { OrderStatus, ResearchOrder } from "@/lib/research/types";

export const Route = createFileRoute("/pesquisa/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de pesquisas — SDR Totum" },
      {
        name: "description",
        content: "Ordens de pesquisa de lote salvas no SDR Totum.",
      },
    ],
  }),
  component: Historico,
});

type ViewMode = "list" | "card";
const VIEW_KEY = "totum.research-history.view";

const STATUS_STYLE: Record<OrderStatus, { label: string; bg: string }> = {
  rascunho: { label: "rascunho", bg: "#1f192a" },
  salva: { label: "salva", bg: "#077ac7" },
  concluida: { label: "concluída", bg: "#35a670" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-block rounded-full px-2 py-1 text-[10px] uppercase tracking-wider text-white"
      style={{ background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Historico() {
  const orders = useResearchOrders();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY) as ViewMode | null;
    if (saved === "list" || saved === "card") setView(saved);
  }, []);

  const setMode = (m: ViewMode) => {
    setView(m);
    window.localStorage.setItem(VIEW_KEY, m);
  };

  const duplicate = (id: string) => navigate({ to: "/pesquisa", search: { from: id } });

  const remove = (id: string) => {
    deleteOrder(id);
    toast.success("Ordem removida");
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1 text-sm text-[color:var(--color-text-muted)] hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> Início
            </Link>
            <h1 className="text-3xl">Histórico de pesquisas</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
              {orders.length} ordem(ns) salva(s).
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div
              className="flex items-center gap-1 rounded-full p-1"
              style={{ background: "#1f192a", boxShadow: "var(--shadow-inset-border)" }}
            >
              <ViewToggleButton
                active={view === "list"}
                onClick={() => setMode("list")}
                label="Lista"
              >
                <List className="size-4" />
              </ViewToggleButton>
              <ViewToggleButton
                active={view === "card"}
                onClick={() => setMode("card")}
                label="Card"
              >
                <LayoutGrid className="size-4" />
              </ViewToggleButton>
            </div>
            <TotumButton asChild>
              <Link to="/pesquisa">
                <Plus className="size-4" /> Nova Pesquisa
              </Link>
            </TotumButton>
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState />
        ) : view === "list" ? (
          <ListView orders={orders} onDuplicate={duplicate} onRemove={remove} />
        ) : (
          <CardView orders={orders} onDuplicate={duplicate} onRemove={remove} />
        )}
      </div>
    </main>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex size-8 items-center justify-center rounded-full transition-all"
      style={{
        background: active ? "#da2128" : "transparent",
        color: active ? "#fff" : "#9ca3af",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-4 py-20 text-center"
      style={{ background: "#1b1728", borderRadius: 24, boxShadow: "var(--shadow-card)" }}
    >
      <p className="text-lg text-white">Nenhuma pesquisa salva ainda</p>
      <p className="max-w-sm text-sm text-[color:var(--color-text-muted)]">
        Monte uma ordem de pesquisa de lote e salve para vê-la aqui.
      </p>
      <TotumButton asChild>
        <Link to="/pesquisa">
          <Plus className="size-4" /> Criar primeira pesquisa
        </Link>
      </TotumButton>
    </div>
  );
}

/* ── Ver prompt dialog ───────────────────────────────────────── */

function ViewPromptDialog({ order }: { order: ResearchOrder }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(order.prompt);
      toast.success("Prompt copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <TotumButton variant="ghost" size="sm">
          <Eye className="size-3.5" /> Ver prompt
        </TotumButton>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{order.name}</DialogTitle>
        </DialogHeader>
        <pre
          className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl p-5 text-xs leading-relaxed text-[#d1cece]"
          style={{
            background: "#0e0918",
            boxShadow: "var(--shadow-inset-border)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          {order.prompt}
        </pre>
        <div className="flex justify-end">
          <TotumButton onClick={copy}>
            <Copy className="size-4" /> Copiar prompt
          </TotumButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── List view ───────────────────────────────────────────────── */

interface ViewProps {
  orders: ResearchOrder[];
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

function ListView({ orders, onDuplicate, onRemove }: ViewProps) {
  return (
    <div
      className="overflow-hidden"
      style={{ background: "#1b1728", borderRadius: 24, boxShadow: "var(--shadow-card)" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Nicho</TableHead>
            <TableHead>Geografia</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-normal text-white">{o.name}</TableCell>
              <TableCell className="text-[color:var(--color-text-muted)]">{o.data.nicho}</TableCell>
              <TableCell className="text-[color:var(--color-text-muted)]">
                {o.data.estados.join("/")} · {o.data.cidades.length} cidade(s)
              </TableCell>
              <TableCell className="text-[color:var(--color-text-muted)]">
                {fmtDate(o.createdAt)}
              </TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <ViewPromptDialog order={o} />
                  <TotumButton variant="ghost" size="sm" onClick={() => onDuplicate(o.id)}>
                    <Duplicate className="size-3.5" /> Duplicar
                  </TotumButton>
                  <TotumButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(o.id)}
                    aria-label="Remover"
                  >
                    <Trash2 className="size-3.5" />
                  </TotumButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ── Card view ───────────────────────────────────────────────── */

function CardView({ orders, onDuplicate, onRemove }: ViewProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {orders.map((o) => (
        <article
          key={o.id}
          className="flex flex-col gap-4 p-6"
          style={{ background: "#1b1728", borderRadius: 24, boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base leading-snug text-white">{o.name}</h3>
            <StatusBadge status={o.status} />
          </div>
          <dl className="flex flex-col gap-1 text-xs text-[color:var(--color-text-muted)]">
            <div className="flex justify-between">
              <dt>Nicho</dt>
              <dd className="text-white">{o.data.nicho}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Geografia</dt>
              <dd className="text-white">
                {o.data.estados.join("/")} · {o.data.cidades.length} cidade(s)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Campos</dt>
              <dd className="text-white">{o.data.camposSaida.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Criada em</dt>
              <dd className="text-white">{fmtDate(o.createdAt)}</dd>
            </div>
          </dl>
          <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-[rgba(255,255,255,0.08)] pt-4">
            <ViewPromptDialog order={o} />
            <TotumButton variant="ghost" size="sm" onClick={() => onDuplicate(o.id)}>
              <Duplicate className="size-3.5" /> Duplicar
            </TotumButton>
            <TotumButton
              variant="ghost"
              size="sm"
              onClick={() => onRemove(o.id)}
              className="ml-auto"
              aria-label="Remover"
            >
              <Trash2 className="size-3.5" />
            </TotumButton>
          </div>
        </article>
      ))}
    </div>
  );
}
