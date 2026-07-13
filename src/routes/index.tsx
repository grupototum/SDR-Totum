/**
 * index.tsx — Dashboard operacional do SDR Totum (estilo Manychat: topbar
 * fina, fundo off-white, cards brancos, status visuais).
 *
 * Exibe os subdomínios/serviços do ecossistema com verificação de status.
 * ✏️ Lista de serviços: editar em src/data/ecosystem.ts (SERVICES).
 * 🔌 Healthcheck real: ver instruções no topo de src/data/ecosystem.ts.
 *
 * O modal de disparo de conversa (funcionalidade existente) foi preservado
 * e fica acessível pelo botão "Iniciar conversa" na topbar.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { TotumButton } from "@/components/ui/totum-button";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { StartConversationPayload } from "@/api";
import { toast } from "sonner";
import {
  Rocket,
  RefreshCw,
  ExternalLink,
  Bot,
  Workflow,
  LayoutDashboard,
  CircleCheck,
  CircleAlert,
  CircleX,
  CircleDashed,
} from "lucide-react";
import { SERVICES, type EcosystemService } from "@/data/ecosystem";
import { AGENTS } from "@/data/agents";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operação — SDR Totum" },
      {
        name: "description",
        content: "Painel operacional do ecossistema SDR Totum: serviços, status e agentes.",
      },
    ],
  }),
  component: Home,
});

// ── Disparo modal (funcionalidade existente — preservada) ────────────────────
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
      style={{ background: "rgba(17,24,39,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh] bg-white"
        style={{ boxShadow: "0 24px 60px rgba(16,24,40,0.25)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-[#111827] flex items-center gap-2">
            <Rocket className="size-5 text-[#da2128]" /> Iniciar Conversa
          </h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-[#111827] text-xl">
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#6b7280] mb-1">Flow ID</label>
            <input
              value={form.flowId}
              onChange={(e) => setForm((f) => ({ ...f, flowId: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm text-[#111827] outline-none focus:ring-1 focus:ring-[#da2128]"
              style={{ background: "#f3f4f6" }}
            />
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1">Número (E.164)</label>
            <input
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              placeholder="5545999999999"
              className="w-full rounded-xl px-3 py-2 text-sm text-[#111827] outline-none focus:ring-1 focus:ring-[#da2128]"
              style={{ background: "#f3f4f6" }}
            />
          </div>

          <div className="border-t pt-3" style={{ borderColor: "#e5e7eb" }}>
            <div className="text-xs text-[#6b7280] mb-2 uppercase tracking-wider">
              Variáveis de pesquisa
            </div>
            <div className="grid grid-cols-2 gap-2">
              {varFields.map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[10px] text-[#6b7280] mb-0.5">{label}</label>
                  <input
                    value={form.variables[key] ?? ""}
                    onChange={(e) => setVar(key, e.target.value)}
                    className="w-full rounded-lg px-2 py-1.5 text-xs text-[#111827] outline-none focus:ring-1 focus:ring-[#da2128]"
                    style={{ background: "#f3f4f6" }}
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

// ── Status dos serviços ───────────────────────────────────────────────────────

type ServiceStatus = "online" | "instavel" | "offline" | "pendente";

/**
 * Verifica um serviço conforme o `check` declarado em ecosystem.ts.
 * TODO: substituir por healthcheck agregado real quando existir endpoint.
 */
async function checkService(svc: EcosystemService): Promise<ServiceStatus> {
  try {
    if (svc.check.type === "none") return "pendente";
    if (svc.check.type === "proxy") {
      const res = await fetch(svc.check.path, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return "online";
      return res.status >= 500 ? "offline" : "instavel";
    }
    // "ping": no-cors — resposta opaca; resolve = alcançável, rejeita = fora.
    await fetch(svc.url, { mode: "no-cors", signal: AbortSignal.timeout(8000) });
    return "online";
  } catch {
    return "offline";
  }
}

const STATUS_UI: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  online: { label: "online", color: "#067647", bg: "#ecfdf3" },
  instavel: { label: "instável", color: "#b54708", bg: "#fffaeb" },
  offline: { label: "offline", color: "#b42318", bg: "#fef3f2" },
  pendente: { label: "pendente", color: "#475467", bg: "#f2f4f7" },
};

function StatusChip({ status }: { status: ServiceStatus }) {
  const ui = STATUS_UI[status];
  const Icon =
    status === "online"
      ? CircleCheck
      : status === "instavel"
        ? CircleAlert
        : status === "offline"
          ? CircleX
          : CircleDashed;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: ui.color, background: ui.bg }}
    >
      <Icon className="size-3" /> {ui.label}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  frontend: { color: "#175cd3", bg: "#eff8ff" },
  api: { color: "#6941c6", bg: "#f9f5ff" },
  automação: { color: "#c11574", bg: "#fdf2fa" },
  admin: { color: "#363f72", bg: "#f8f9fc" },
  webhook: { color: "#b54708", bg: "#fffaeb" },
  crm: { color: "#067647", bg: "#ecfdf3" },
  painel: { color: "#175cd3", bg: "#eff8ff" },
  banco: { color: "#363f72", bg: "#f8f9fc" },
};

function CategoryChip({ category }: { category: string }) {
  const ui = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.admin;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px]"
      style={{ color: ui.color, background: ui.bg }}
    >
      {category}
    </span>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

function Home() {
  const [showDisparo, setShowDisparo] = useState(false);
  const qc = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["ecosystem-status"],
    queryFn: async () => {
      const entries = await Promise.all(
        SERVICES.map(async (svc) => [svc.id, await checkService(svc)] as const),
      );
      return {
        at: new Date(),
        status: Object.fromEntries(entries) as Record<string, ServiceStatus>,
      };
    },
    refetchInterval: 60_000,
  });

  const statuses = statusQuery.data?.status;
  const onlineCount = statuses ? Object.values(statuses).filter((s) => s === "online").length : 0;
  const validatedAgents = AGENTS.filter((a) => a.validated);
  const lastCheck = statusQuery.data?.at;

  return (
    <main className="totum-light min-h-screen" style={{ background: "#f6f7f9" }}>
      {showDisparo && <StartConversationModal onClose={() => setShowDisparo(false)} />}

      {/* Topbar fina */}
      <header
        className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 bg-white px-4 sm:px-6"
        style={{ boxShadow: "inset 0 -1px 0 0 #e5e7eb" }}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <LayoutDashboard className="size-4 shrink-0 text-[#6b7280]" />
          <span className="text-[#6b7280]">Operação</span>
          <span className="text-[#d0d5dd]">/</span>
          <span className="truncate font-medium text-[#111827]">Visão geral</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["ecosystem-status"] })}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#475467] hover:bg-[#f2f4f7]"
            title="Verificar serviços agora"
          >
            <RefreshCw className={`size-3.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {lastCheck
                ? `Verificado ${lastCheck.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : "Verificando…"}
            </span>
          </button>
          <TotumButton variant="primary" size="sm" onClick={() => setShowDisparo(true)}>
            <Rocket className="size-3.5" /> Iniciar conversa
          </TotumButton>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Resumo operacional */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: "Serviços online",
              value: statuses ? `${onlineCount}/${SERVICES.length}` : "…",
              icon: CircleCheck,
            },
            { label: "Agentes validados", value: String(validatedAgents.length), icon: Bot },
            { label: "Builder de flows", value: "ativo", icon: Workflow },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center gap-3 rounded-xl bg-white p-4"
              style={{ boxShadow: "0 1px 3px rgba(16,24,40,0.08)" }}
            >
              <div
                className="flex size-9 items-center justify-center rounded-lg"
                style={{ background: "#fef3f2", color: "#da2128" }}
              >
                <kpi.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-medium leading-tight text-[#111827]">
                  {kpi.value}
                </p>
                <p className="truncate text-xs text-[#6b7280]">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Serviços do ecossistema */}
        <section
          className="overflow-hidden rounded-xl bg-white"
          style={{ boxShadow: "0 1px 3px rgba(16,24,40,0.08)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 sm:px-5"
            style={{ boxShadow: "inset 0 -1px 0 0 #f2f4f7" }}
          >
            <h2 className="text-sm font-medium text-[#111827]">Serviços do ecossistema</h2>
            <span className="text-[11px] text-[#6b7280]">
              editar em <code className="rounded bg-[#f2f4f7] px-1">src/data/ecosystem.ts</code>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#6b7280]">
                  <th className="px-4 py-2.5 font-normal sm:px-5">Serviço</th>
                  <th className="px-4 py-2.5 font-normal">Categoria</th>
                  <th className="px-4 py-2.5 font-normal">Status</th>
                  <th className="px-4 py-2.5 font-normal">URL</th>
                  <th className="px-4 py-2.5 font-normal text-right sm:px-5">Abrir</th>
                </tr>
              </thead>
              <tbody>
                {SERVICES.map((svc) => (
                  <tr key={svc.id} style={{ boxShadow: "inset 0 1px 0 0 #f2f4f7" }}>
                    <td className="max-w-[240px] px-4 py-3 sm:px-5">
                      <p className="truncate font-medium text-[#111827]">{svc.name}</p>
                      <p className="truncate text-xs text-[#6b7280]">{svc.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryChip category={svc.category} />
                    </td>
                    <td className="px-4 py-3">
                      {statuses ? (
                        <StatusChip status={statuses[svc.id] ?? "pendente"} />
                      ) : (
                        <StatusChip status="pendente" />
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-[#475467]">
                      {svc.url.replace(/^https?:\/\//, "")}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <a
                        href={svc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#475467] hover:bg-[#f2f4f7] hover:text-[#111827]"
                      >
                        abrir <ExternalLink className="size-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Agentes validados (resumo) */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#111827]">Agentes em operação</h2>
            <Link to="/agentes" className="text-xs text-[#da2128] hover:underline">
              ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {validatedAgents.map((agent) => (
              <Link
                key={agent.id}
                to={agent.href}
                className="rounded-xl bg-white p-4 transition-shadow hover:shadow-md"
                style={{ boxShadow: "0 1px 3px rgba(16,24,40,0.08)" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Bot className="size-4 shrink-0 text-[#da2128]" />
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ color: "#067647", background: "#ecfdf3" }}
                  >
                    <CircleCheck className="size-3" /> {agent.status}
                  </span>
                </div>
                <p className="truncate text-sm font-medium text-[#111827]">{agent.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#6b7280]">{agent.role}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
