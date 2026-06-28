import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api";
import type { ReportSchema } from "@/api";
import { BarChart3, CheckCircle, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Relatórios — SDR Totum" }],
  }),
  component: ReportsPage,
});

function scoreColor(s: number) {
  if (s >= 8) return "#35a670";
  if (s >= 5) return "#f59e0b";
  return "#d91616";
}

function ResultIcon({ r }: { r: ReportSchema["resultado"] }) {
  if (r === "reuniao_marcada") return <CheckCircle className="size-4 text-[#35a670]" />;
  if (r === "rejeitado") return <XCircle className="size-4 text-[#d91616]" />;
  return <Clock className="size-4 text-[#077ac7]" />;
}

function ReportDetail({ report }: { report: ReportSchema }) {
  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg text-white">{report.empresa}</h2>
          <p className="text-sm text-[color:var(--color-text-muted)]">{report.proxima_acao}</p>
        </div>
        <div className="flex items-center gap-3">
          <ResultIcon r={report.resultado} />
          <span className="text-sm text-white capitalize">
            {report.resultado.replace(/_/g, " ")}
          </span>
          <div
            className="rounded-full px-3 py-1 text-sm font-medium"
            style={{ background: scoreColor(report.score), color: "#fff" }}
          >
            {report.score}/10
          </div>
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl p-4" style={{ background: "#1f192a" }}>
        {[
          ["Temperatura", report.temperatura],
          ["Agendou", report.agendou ? "Sim" : "Não"],
          ["Abriu pela observação", report.abriu_pela_observacao ? "Sim" : "Não"],
          ["Gatilho prévia", report.gatilho_preview ? "Sim" : "Não"],
          ["Onde travou", report.onde_travou || "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] text-[color:var(--color-text-muted)]">{k}</div>
            <div className="text-sm text-white">{v}</div>
          </div>
        ))}
      </div>

      {/* Resumo */}
      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Resumo
        </div>
        <p className="text-sm text-[color:var(--color-text-body)]">{report.resumo}</p>
      </div>

      {/* Objeções */}
      {report.objecoes.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Objeções
          </div>
          <div className="flex flex-wrap gap-2">
            {report.objecoes.map((o, i) => (
              <span
                key={i}
                className="rounded-full px-2 py-0.5 text-xs"
                style={{ background: "#432d33", color: "#ef9a9a" }}
              >
                {o}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.listReports(),
  });

  const { data: detail } = useQuery({
    queryKey: ["report", selectedId],
    queryFn: () => api.getReport(selectedId!),
    enabled: !!selectedId,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col overflow-hidden border-r border-border">
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-base text-white flex items-center gap-2">
            <BarChart3 className="size-4" /> Relatórios
          </h1>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
            {list.length} relatório(s)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="px-5 py-6 text-xs text-[color:var(--color-text-muted)]">
              Carregando…
            </div>
          )}
          {list.map((r) => (
            <button
              key={r.conversationId}
              onClick={() => setSelectedId(r.conversationId)}
              className={`w-full text-left px-5 py-3 transition-colors border-b border-border ${selectedId === r.conversationId ? "bg-[color:var(--lg-card-hover)]" : "hover:bg-[color:var(--lg-card)]"}`}
            >
              <div className="flex items-center gap-2">
                <ResultIcon r={r.resultado} />
                <span className="text-sm text-white truncate">{r.empresa}</span>
                <span
                  className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: scoreColor(r.score), color: "#fff" }}
                >
                  {r.score}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-[color:var(--color-text-muted)]">
                {r.resultado.replace(/_/g, " ")} ·{" "}
                {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto">
        {detail ? (
          <ReportDetail report={detail} />
        ) : (
          <div className="flex h-full items-center justify-center text-[color:var(--color-text-muted)] text-sm">
            Selecione um relatório
          </div>
        )}
      </div>
    </div>
  );
}
