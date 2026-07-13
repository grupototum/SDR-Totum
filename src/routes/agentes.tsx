/**
 * agentes.tsx — página de agentes SDR validados e funcionando (estilo
 * Manychat: fundo off-white, blocos brancos operacionais, status visuais).
 *
 * ✏️ Lista de agentes: editar em src/data/agents.ts (AGENTS).
 *    Só aparecem aqui agentes com `validated: true`.
 * 🔌 Dados reais: ver instruções no topo de src/data/agents.ts.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Workflow, ArrowUpRight, CircleCheck } from "lucide-react";
import { AGENTS, type AgentStatus } from "@/data/agents";

export const Route = createFileRoute("/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes — SDR Totum" },
      { name: "description", content: "Agentes SDR validados e em operação." },
    ],
  }),
  component: AgentsPage,
});

const STATUS_UI: Record<AgentStatus, { color: string; bg: string }> = {
  ativo: { color: "#067647", bg: "#ecfdf3" },
  validado: { color: "#175cd3", bg: "#eff8ff" },
  funcionando: { color: "#067647", bg: "#ecfdf3" },
};

function AgentsPage() {
  const validated = AGENTS.filter((a) => a.validated);

  return (
    <main className="totum-light min-h-screen" style={{ background: "#f6f7f9" }}>
      {/* Topbar fina */}
      <header
        className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 bg-white px-4 sm:px-6"
        style={{ boxShadow: "inset 0 -1px 0 0 #e5e7eb" }}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Bot className="size-4 shrink-0 text-[#6b7280]" />
          <span className="text-[#6b7280]">Operação</span>
          <span className="text-[#d0d5dd]">/</span>
          <span className="truncate font-medium text-[#111827]">Agentes</span>
        </div>
        <span className="shrink-0 text-[11px] text-[#6b7280]">
          {validated.length} validado{validated.length !== 1 ? "s" : ""} · editar em{" "}
          <code className="rounded bg-[#f2f4f7] px-1">src/data/agents.ts</code>
        </span>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {validated.length === 0 && (
          <p
            className="rounded-xl bg-white p-10 text-center text-sm text-[#6b7280]"
            style={{ boxShadow: "0 1px 3px rgba(16,24,40,0.08)" }}
          >
            Nenhum agente validado. Marque <code>validated: true</code> em src/data/agents.ts.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {validated.map((agent) => {
            const ui = STATUS_UI[agent.status];
            return (
              <div
                key={agent.id}
                className="flex flex-col gap-3 rounded-xl bg-white p-5"
                style={{ boxShadow: "0 1px 3px rgba(16,24,40,0.08)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "#fef3f2", color: "#da2128" }}
                  >
                    <Bot className="size-4" />
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ color: ui.color, background: ui.bg }}
                  >
                    <CircleCheck className="size-3" /> {agent.status}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-[#111827]">{agent.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6b7280]">
                    {agent.role}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[#475467]">
                    {agent.channel}
                  </span>
                  {agent.partOfFlow && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ color: "#6941c6", background: "#f9f5ff" }}
                    >
                      <Workflow className="size-3" /> parte de flow
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-1">
                  {agent.external ? (
                    <a
                      href={agent.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#475467] hover:bg-[#f2f4f7] hover:text-[#111827]"
                      style={{ boxShadow: "inset 0 0 0 1px #e5e7eb" }}
                    >
                      Abrir <ArrowUpRight className="size-3" />
                    </a>
                  ) : (
                    <Link
                      to={agent.href}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#475467] hover:bg-[#f2f4f7] hover:text-[#111827]"
                      style={{ boxShadow: "inset 0 0 0 1px #e5e7eb" }}
                    >
                      Abrir <ArrowUpRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
