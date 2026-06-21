import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, History } from "lucide-react";
import { api } from "@/api";
import { ResearchWizard } from "@/components/research/ResearchWizard";

export const Route = createFileRoute("/pesquisa")({
  head: () => ({
    meta: [{ title: "Pesquisa — SDR Totum" }],
  }),
  validateSearch: (search: Record<string, unknown>): { dup?: string } => ({
    dup: typeof search.dup === "string" ? search.dup : undefined,
  }),
  component: PesquisaPage,
});

function PesquisaPage() {
  const { dup } = Route.useSearch();
  const navigate = useNavigate();

  const { data: dupOrder, isLoading } = useQuery({
    queryKey: ["research-order", dup],
    queryFn: () => api.getResearchOrder(dup!),
    enabled: !!dup,
  });

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
          <Search className="size-4 text-[#da2128]" /> Pesquisa
        </h1>
        <Link
          to="/pesquisa/historico"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[color:var(--color-text-muted)] hover:text-white hover:bg-[#1f192a] transition-colors"
        >
          <History className="size-3.5" /> Histórico
        </Link>
      </header>

      <section className="px-6 py-10">
        {dup && isLoading ? (
          <p className="text-center text-sm text-[color:var(--color-text-muted)]">
            Carregando ordem…
          </p>
        ) : (
          <ResearchWizard
            key={dupOrder?.id ?? "new"}
            initial={dupOrder?.data}
            onSaved={() => navigate({ to: "/pesquisa/historico" })}
          />
        )}
      </section>
    </main>
  );
}
