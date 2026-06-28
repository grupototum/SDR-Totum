import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useRipple, useShimmer } from "./hooks";

/* ─────────── NavBar ─────────── */
export interface LiquidNavItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}
export function LiquidNav({
  items,
  trailing,
  className,
}: {
  items: LiquidNavItem[];
  trailing?: ReactNode;
  className?: string;
}) {
  const ref = useShimmer<HTMLElement>();
  const ripple = useRipple();
  return (
    <nav
      ref={ref}
      className={cn(
        "glass-pill iris-ring lg-shimmer flex items-center gap-1 px-2 py-2",
        className,
      )}
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={(e) => {
            ripple(e);
            it.onClick?.();
          }}
          className={cn(
            "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors overflow-hidden",
            it.active
              ? "bg-white/20 text-[color:var(--lg-fg)]"
              : "text-[color:var(--lg-muted-fg)] hover:text-[color:var(--lg-fg)] hover:bg-white/10",
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
      {trailing && <div className="ml-2 pl-2 border-l border-white/15">{trailing}</div>}
    </nav>
  );
}

/* ─────────── ToggleButton ─────────── */
export interface LiquidToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  className?: string;
}
export function LiquidToggle({ checked, onChange, label, className }: LiquidToggleProps) {
  return (
    <label className={cn("inline-flex items-center gap-3 cursor-pointer select-none", className)}>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onChange(!checked)}
        className={cn(
          "relative h-7 w-12 rounded-full glass iris-ring transition-all",
          checked && "bg-white/25",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-all duration-300 ease-out",
            "bg-[image:var(--gradient-iris)] shadow-[0_4px_14px_rgba(218,33,40,0.6)]",
            checked && "translate-x-5",
          )}
        />
      </span>
      {label && <span className="text-sm text-[color:var(--lg-fg)]">{label}</span>}
    </label>
  );
}

/* ─────────── FeatureCard ─────────── */
export interface LiquidFeatureCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
}
export const LiquidFeatureCard = forwardRef<HTMLDivElement, LiquidFeatureCardProps>(
  function LiquidFeatureCard({ icon, title, description, footer, className, ...rest }, fwd) {
    const ref = useShimmer<HTMLDivElement>();
    return (
      <div
        {...rest}
        ref={(node) => {
          ref.current = node;
          if (typeof fwd === "function") fwd(node);
          else if (fwd) fwd.current = node;
        }}
        className={cn(
          "glass iris-ring lg-shimmer lg-hover p-6 flex flex-col gap-4",
          className,
        )}
      >
        {icon && (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[image:var(--gradient-iris)] text-white shadow-[var(--shadow-btn-primary)]">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg leading-tight text-[color:var(--lg-fg)]">{title}</h3>
          {description && (
            <p className="mt-1.5 text-sm text-[color:var(--lg-muted-fg)] leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </div>
    );
  },
);

/* ─────────── TabsMenu ─────────── */
export interface LiquidTab {
  id: string;
  label: ReactNode;
  content: ReactNode;
}
export function LiquidTabs({
  tabs,
  defaultTab,
  className,
}: {
  tabs: LiquidTab[];
  defaultTab?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const ripple = useRipple();
  return (
    <div className={cn("w-full", className)}>
      <div className="glass-pill iris-ring inline-flex p-1.5 gap-1">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={(e) => {
                ripple(e);
                setActive(t.id);
              }}
              className={cn(
                "relative overflow-hidden rounded-full px-4 py-1.5 text-sm transition-all",
                isActive
                  ? "bg-white/25 text-[color:var(--lg-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                  : "text-[color:var(--lg-muted-fg)] hover:text-[color:var(--lg-fg)] hover:bg-white/10",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        {tabs.map((t) => (
          <div key={t.id} hidden={t.id !== active}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Button ─────────── */
export interface LiquidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}
export const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(function LiquidButton(
  { variant = "ghost", className, onClick, children, ...rest },
  ref,
) {
  const ripple = useRipple();
  return (
    <button
      ref={ref}
      {...rest}
      onClick={(e) => {
        ripple(e);
        onClick?.(e);
      }}
      className={cn(
        "relative overflow-hidden inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all lg-hover",
        variant === "primary"
          ? "text-white bg-[image:var(--gradient-iris)] shadow-[var(--shadow-btn-primary)]"
          : "glass iris-ring text-[color:var(--lg-fg)] hover:bg-white/20",
        className,
      )}
    >
      {children}
    </button>
  );
});
