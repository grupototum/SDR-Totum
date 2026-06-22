import { createFileRoute, Link } from "@tanstack/react-router";
import { TotumButton } from "@/components/ui/totum-button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/api";
import type { StartConversationPayload } from "@/api";
import { toast } from "sonner";
import { ArrowRight, Plus, Workflow, MessageCircle, BarChart3, Rocket, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SDR Totum — Automação de conversas que parecem humanas" },
      {
        name: "description",
        content:
          "Crie flows visuais de SDR no WhatsApp com humanização, IA proativa e relatórios. SDR Totum: conversas que parecem humanas.",
      },
    ],
  }),
  component: Home,
});

// ── Disparo modal ──────────────────────────────────────────────────────────────
function StartConversationModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<StartConversationPayload>({
    flowId: "odonto_sdr_v1",
    target: "5545",
    variables: {
      NOME_EMPRESA: "",
      NOME_DONO: "",
      ESPECIALIDADE: "Odontologia",
      CIDADE: "Foz do Iguaçu",
      QTD_AVALIACOES: "",
      CONTEUDO_RECENTE: "",
      CONCORRENTE_1: "",
      CONCORRENTE_2: "",
      CONCORRENTE_3: "",
      tipo_clinica: "clinica_media",
    },
  });

  function setVar(k: string, v: string) {
    setForm((f) => ({ ...f, variables: { ...f.variables, [k]: v } }));
  }

  const startMut = useMutation({
    mutationFn: () => api.startConversation(form),
    onSuccess: ({ conversationId }) => {
      toast.success(`Conversa iniciada — ID: ${conversationId}`);
      onClose();
    },
    onError: (e) => toast.error(`Erro: ${(e as Error).message}`),
  });

  const varFields: Array<[string, string]> = [
    ["NOME_EMPRESA", "Nome da empresa"],
    ["NOME_DONO", "Nome do dono"],
    ["ESPECIALIDADE", "Especialidade"],
    ["CIDADE", "Cidade"],
    ["QTD_AVALIACOES", "Qtd. avaliações"],
    ["CONTEUDO_RECENTE", "Conteúdo recente"],
    ["CONCORRENTE_1", "Concorrente 1"],
    ["CONCORRENTE_2", "Concorrente 2"],
    ["CONCORRENTE_3", "Concorrente 3"],
    ["tipo_clinica", "Tipo de clínica"],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(14,9,24,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-6 space-y-5 overflow-y-auto max-h-[90vh]"
        style={{ background: "#1b1728", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-white flex items-center gap-2">
            <Rocket className="size-5 text-[#da2128]" /> Iniciar Conversa
          </h2>
          <button
            onClick={onClose}
            className="text-[color:var(--color-text-muted)] hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {/* flowId */}
          <div>
            <label className="block text-xs text-[color:var(--color-text-muted)] mb-1">
              Flow ID
            </label>
            <input
              value={form.flowId}
              onChange={(e) => setForm((f) => ({ ...f, flowId: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
              style={{ background: "#0e0918" }}
            />
          </div>

          {/* target */}
          <div>
            <label className="block text-xs text-[color:var(--color-text-muted)] mb-1">
              Número (E.164)
            </label>
            <input
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              placeholder="5545999999999"
              className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#da2128]"
              style={{ background: "#0e0918" }}
            />
          </div>

          <div className="border-t pt-3" style={{ borderColor: "#1f192a" }}>
            <div className="text-xs text-[color:var(--color-text-muted)] mb-2 uppercase tracking-wider">
              Variáveis de pesquisa
            </div>
            <div className="grid grid-cols-2 gap-2">
              {varFields.map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[10px] text-[color:var(--color-text-muted)] mb-0.5">
                    {label}
                  </label>
                  <input
                    value={form.variables[key] ?? ""}
                    onChange={(e) => setVar(key, e.target.value)}
                    className="w-full rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-[#da2128]"
                    style={{ background: "#0e0918" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <TotumButton variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancelar
          </TotumButton>
          <TotumButton
            variant="primary"
            size="sm"
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
            className="flex-1"
          >
            {startMut.isPending ? "Iniciando…" : "Iniciar Conversa"}
          </TotumButton>
        </div>
      </div>
    </div>
  );
}

// ── Nav sidebar ────────────────────────────────────────────────────────────────
const navLinks = [
  { to: "/pesquisa" as const, icon: Search, label: "Pesquisa" },
  { to: "/builder" as const, icon: Workflow, label: "Flow Builder" },
  { to: "/conversations" as const, icon: MessageCircle, label: "Conversas" },
  { to: "/reports" as const, icon: BarChart3, label: "Relatórios" },
];

// ── Home ───────────────────────────────────────────────────────────────────────
function Home() {
  const [showDisparo, setShowDisparo] = useState(false);

  return (
    <main className="min-h-screen" style={{ background: "#0e0918" }}>
      {showDisparo && <StartConversationModal onClose={() => setShowDisparo(false)} />}

      {/* Top nav */}
      <nav
        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
        style={{
          background: "rgba(14,9,24,0.9)",
          backdropFilter: "blur(16px)",
          boxShadow: "inset 0 -1px 0 0 #1f192a",
        }}
      >
        <div className="flex items-center gap-1">
          <span className="text-white font-medium mr-6">SDR Totum</span>
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[color:var(--color-text-muted)] hover:text-white hover:bg-[#1f192a] transition-colors"
            >
              <Icon className="size-3.5" /> {label}
            </Link>
          ))}
        </div>
        <TotumButton variant="primary" size="sm" onClick={() => setShowDisparo(true)}>
          <Rocket className="size-3.5" /> Iniciar Conversa
        </TotumButton>
      </nav>

      {/* Dashboard */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <TotumButton asChild variant="primary" size="lg">
            <Link to="/builder">
              <Plus className="size-4" /> Novo Flow
            </Link>
          </TotumButton>
          <TotumButton variant="secondary" size="lg" onClick={() => setShowDisparo(true)}>
            <Rocket className="size-4" /> Iniciar Conversa
          </TotumButton>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Conversas Ativas", value: 12, icon: MessageCircle },
            { label: "Leads Quentes", value: 5, icon: BarChart3 },
            { label: "Flows Criados", value: 8, icon: Workflow },
            { label: "Pesquisas Hoje", value: 3, icon: Search },
          ].map((card) => (
            <div
              key={card.label}
              className="flex flex-col gap-3 p-5"
              style={{
                background: "#1b1728",
                borderRadius: 24,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="flex size-10 items-center justify-center rounded-full text-white"
                style={{ backgroundImage: "var(--gradient-secondary)" }}
              >
                <card.icon className="size-4" />
              </div>
              <div>
                <div
                  className="text-white"
                  style={{ fontSize: 36, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 }}
                >
                  {card.value}
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                  {card.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col gap-4 transition-all hover:bg-[#272333]"
              style={{
                background: "#1b1728",
                borderRadius: 24,
                padding: 32,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="flex size-10 items-center justify-center rounded-full text-white"
                style={{ backgroundImage: "var(--gradient-secondary)" }}
              >
                <Icon className="size-4" />
              </div>
              <div>
                <h3 className="text-lg text-white">{label}</h3>
                <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                  {to === "/pesquisa" && "Monte ordens de pesquisa e gere o prompt do agente"}
                  {to === "/builder" && "Crie e edite flows visuais de automação"}
                  {to === "/conversations" && "Monitore e intervenha em conversas ao vivo"}
                  {to === "/reports" && "Analise resultados e temperaturas de leads"}
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm text-[color:var(--color-text-muted)]">
                Acessar <ArrowRight className="size-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
