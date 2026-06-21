import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TotumButton } from "@/components/ui/totum-button";

export interface MultiStepItem {
  id: string;
  title: string;
}

export interface MultiStepFormProps {
  steps: MultiStepItem[];
  /** Índice do passo atual (controlado). */
  current: number;
  onStepChange: (index: number) => void;
  /** Validação do passo atual — trava o "Próximo". */
  canProceed: boolean;
  /** Conteúdo do passo atual. */
  children: React.ReactNode;
  /** Ações renderizadas no rodapé do último passo (no lugar de "Próximo"). */
  finishSlot?: React.ReactNode;
  className?: string;
}

/**
 * Stepper animado + validação por passo + footer de navegação.
 * Base reutilizável (Design System Totum, animações framer-motion).
 */
const stepVariants = {
  enter: (d: number) => ({ opacity: 0, x: d >= 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -24 : 24 }),
};

export function MultiStepForm({
  steps,
  current,
  onStepChange,
  canProceed,
  children,
  finishSlot,
  className,
}: MultiStepFormProps) {
  const dirRef = React.useRef(0);
  const isLast = current === steps.length - 1;

  const go = (next: number) => {
    if (next < 0 || next > steps.length - 1) return;
    dirRef.current = next > current ? 1 : -1;
    onStepChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {/* Stepper header */}
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <React.Fragment key={step.id}>
              <li className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => i <= current && go(i)}
                  disabled={i > current}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm transition-all",
                    i <= current ? "cursor-pointer" : "cursor-not-allowed",
                  )}
                  style={{
                    background: active ? "#da2128" : done ? "rgba(218,33,40,0.18)" : "#1f192a",
                    color: active ? "#fff" : done ? "#ef9a9a" : "#9ca3af",
                    boxShadow: active ? "var(--shadow-halo-red)" : "var(--shadow-inset-border)",
                  }}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </button>
                <span
                  className={cn(
                    "hidden whitespace-nowrap text-sm lg:inline",
                    active ? "text-white" : "text-[color:var(--color-text-muted)]",
                  )}
                >
                  {step.title}
                </span>
              </li>
              {i < steps.length - 1 && (
                <li className="h-px min-w-4 flex-1" aria-hidden>
                  <div
                    className="h-px w-full transition-colors"
                    style={{ background: done ? "#da2128" : "rgba(255,255,255,0.1)" }}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Animated content */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dirRef.current}>
          <motion.div
            key={current}
            custom={dirRef.current}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] pt-6">
        <TotumButton variant="ghost" onClick={() => go(current - 1)} disabled={current === 0}>
          <ChevronLeft className="size-4" /> Voltar
        </TotumButton>

        {isLast ? (
          <div className="flex flex-wrap items-center justify-end gap-2">{finishSlot}</div>
        ) : (
          <TotumButton onClick={() => go(current + 1)} disabled={!canProceed}>
            Próximo <ChevronRight className="size-4" />
          </TotumButton>
        )}
      </div>
    </div>
  );
}
