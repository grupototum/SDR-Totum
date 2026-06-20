import { type ChangeEvent, type ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[color:var(--color-text-muted)]">{hint}</span>}
    </label>
  );
}

export const inputStyle = {
  background: "#1f192a",
  color: "#d1cece",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
  border: "none",
} as const;

export function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}
export function TTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 80, ...props.style }} />;
}
export function TSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs transition-all"
      style={{
        background: active ? "#da2128" : "#1f192a",
        color: active ? "#fff" : "#d1cece",
        boxShadow: active ? "var(--shadow-btn-primary)" : "none",
      }}
    >
      {children}
    </button>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#da2128]"
      />
      <span className="w-12 text-right text-xs text-white tabular-nums">{value}</span>
    </div>
  );
}
