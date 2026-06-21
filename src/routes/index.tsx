import { createFileRoute, Link } from "@tanstack/react-router";
import { TotumButton } from "@/components/ui/totum-button";
import { ArrowRight, FileUp, Plus, Search, Workflow } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SDR Totum — Automação de conversas que parecem humanas" },
      {
        name: "description",
        content:
          "Crie flows visuais de SDR no WhatsApp com humanização, IA proativa e relatórios. SDR Totum: conversas que parecem humanas.",
      },
      { property: "og:title", content: "SDR Totum — Flow Builder" },
      { property: "og:description", content: "Automação de conversas que parecem humanas." },
    ],
  }),
  component: Home,
});

const recentFlows = [
  { id: "f1", name: "Outbound frio · SaaS B2B", date: "atualizado há 2h", status: "published" },
  { id: "f2", name: "Reativação 90d", date: "atualizado há 1d", status: "draft" },
  { id: "f3", name: "Pesquisa de nicho", date: "atualizado há 3d", status: "testing" },
];

const statusMap = {
  published: { label: "publicado", bg: "#35a670" },
  draft: { label: "rascunho", bg: "#1f192a" },
  testing: { label: "em teste", bg: "#077ac7" },
} as const;

function Home() {
  return (
    <main className="min-h-screen px-6 py-20" style={{ background: "#0e0918" }}>
      <section className="mx-auto max-w-5xl text-center">
        <h1
          className="text-white"
          style={{ fontSize: 72, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          SDR Totum
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl"
          style={{ fontSize: 20, fontWeight: 300, color: "#d1cece" }}
        >
          Automação de conversas que parecem humanas.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <TotumButton asChild variant="primary" size="lg">
            <Link to="/builder">
              <Plus className="size-4" /> Novo Flow
            </Link>
          </TotumButton>
          <TotumButton
            variant="secondary"
            size="lg"
            onClick={() => toast.info("Importação de script em breve")}
          >
            <FileUp className="size-4" /> Importar Script
          </TotumButton>
          <TotumButton asChild variant="outline" size="lg">
            <Link to="/pesquisa">
              <Search className="size-4" /> Nova Pesquisa
            </Link>
          </TotumButton>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl">Flows recentes</h2>
          <Link
            to="/builder"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--color-text-muted)] hover:text-white"
          >
            Ver tudo <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {recentFlows.map((f) => {
            const s = statusMap[f.status as keyof typeof statusMap];
            return (
              <article
                key={f.id}
                className="flex flex-col gap-4 transition-all hover:bg-[#272333]"
                style={{
                  background: "#1b1728",
                  borderRadius: 24,
                  padding: 32,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex size-10 items-center justify-center rounded-full text-white"
                    style={{ backgroundImage: "var(--gradient-secondary)" }}
                  >
                    <Workflow className="size-4" />
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
                    style={{ background: s.bg, color: "#fff" }}
                  >
                    {s.label}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg">{f.name}</h3>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{f.date}</p>
                </div>
                <TotumButton asChild variant="ghost" size="sm" className="self-start">
                  <Link to="/builder">
                    Abrir <ArrowRight className="size-3.5" />
                  </Link>
                </TotumButton>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
