import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, Plus } from "lucide-react";
import { TotumButton } from "@/components/ui/totum-button";
import { OrderHistory } from "@/components/research/OrderHistory";

export const Route = createFileRoute("/pesquisa/")({
  head: () => ({
    meta: [{ title: "Pesquisas — SDR Totum" }],
  }),
  component: PesquisaIndex,
});

function PesquisaIndex() {
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
        <h1 className="flex items-center gap-2 text-sm text-white">
          <Search className="size-4 text-[#da2128]" /> Pesquisa
        </h1>
        <TotumButton asChild variant="primary" size="sm">
          <Link to="/pesquisa/nova">
            <Plus className="size-3.5" /> Nova pesquisa
          </Link>
        </TotumButton>
      </header>

      <section className="px-6 py-8">
        <OrderHistory
          onDuplicate={(id) => navigate({ to: "/pesquisa/nova", search: { dup: id } })}
        />
      </section>
    </main>
  );
}
