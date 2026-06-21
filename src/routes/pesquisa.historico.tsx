import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { History, Plus } from "lucide-react";
import { TotumButton } from "@/components/ui/totum-button";
import { OrderHistory } from "@/components/research/OrderHistory";

export const Route = createFileRoute("/pesquisa/historico")({
  head: () => ({
    meta: [{ title: "Histórico de Pesquisa — SDR Totum" }],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen" style={{ background: "#0e0918" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
        style={{
          background: "rgba(14,9,24,0.9)",
          backdropFilter: "blur(16px)",
          boxShadow: "inset 0 -1px 0 0 #1f192a",
        }}
      >
        <Link to="/" className="text-white font-medium">
          SDR Totum
        </Link>
        <h1 className="flex items-center gap-2 text-sm text-white">
          <History className="size-4 text-[#da2128]" /> Histórico de Pesquisa
        </h1>
        <TotumButton asChild variant="primary" size="sm">
          <Link to="/pesquisa">
            <Plus className="size-3.5" /> Nova ordem
          </Link>
        </TotumButton>
      </header>

      <section className="px-6 py-10">
        <OrderHistory onDuplicate={(id) => navigate({ to: "/pesquisa", search: { dup: id } })} />
      </section>
    </main>
  );
}
