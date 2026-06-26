/**
 * ActivateConfirmDialog — confirmação de ativação em PRODUÇÃO (autosend).
 * Reutilizado pela landing (FlowsList) e pela toolbar do builder node-graph.
 * Mostra o aviso de produção + checklist de saúde do flow + atalho pro Simulador.
 */
import { AlertTriangle, Rocket, FlaskConical, CheckCircle2, XCircle } from "lucide-react";
import { TotumButton } from "@/components/ui/totum-button";

export interface HealthCheck {
  label: string;
  ok: boolean;
}

export function ActivateConfirmDialog({
  flowName,
  onConfirm,
  onCancel,
  onGoToSim,
  confirming = false,
  health,
}: {
  flowName: string;
  onConfirm: () => void;
  onCancel: () => void;
  onGoToSim?: () => void;
  confirming?: boolean;
  health?: HealthCheck[];
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(14,9,24,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-5 rounded-3xl p-6"
        style={{ background: "#1b1728", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#f59e0b]" />
            <h2 className="text-base text-white">Ativar flow em produção</h2>
          </div>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Você está prestes a ativar <span className="text-white font-medium">"{flowName}"</span>{" "}
            no ambiente de <strong className="text-[#f59e0b]">PRODUÇÃO com autosend</strong>.
            Mensagens serão enviadas automaticamente a leads reais.
          </p>
        </div>

        {health && health.length > 0 && (
          <div
            className="flex flex-col gap-1.5 rounded-xl px-4 py-3 text-xs"
            style={{ background: "#0e0918" }}
          >
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Saúde do flow
            </span>
            {health.map((h) => (
              <div key={h.label} className="flex items-center gap-1.5">
                {h.ok ? (
                  <CheckCircle2 className="size-3.5 text-[#35a670]" />
                ) : (
                  <XCircle className="size-3.5 text-[#f59e0b]" />
                )}
                <span style={{ color: h.ok ? "#d1cece" : "#f59e0b" }}>{h.label}</span>
              </div>
            ))}
          </div>
        )}

        {onGoToSim && (
          <div
            className="flex flex-col gap-3 rounded-xl px-4 py-3 text-xs"
            style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}
          >
            <p>Recomendado: verifique a saúde do flow no Simulador antes de ativar.</p>
            <button
              onClick={onGoToSim}
              className="flex items-center gap-1.5 font-medium hover:underline self-start"
            >
              <FlaskConical className="size-3.5" /> Abrir Simulador com este flow
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <TotumButton
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="flex-1"
            disabled={confirming}
          >
            Cancelar
          </TotumButton>
          <TotumButton
            variant="primary"
            size="sm"
            onClick={onConfirm}
            className="flex-1"
            disabled={confirming}
            style={{ background: "#e3433e" }}
          >
            <Rocket className="size-3.5" /> {confirming ? "Ativando…" : "Ativar em PRODUÇÃO"}
          </TotumButton>
        </div>
      </div>
    </div>
  );
}
