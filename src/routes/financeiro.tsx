import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured, type Account, type Transaction } from "@/lib/supabase";
import { ArrowDownLeft, ArrowUpRight, DollarSign, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [{ title: "Financeiro — SDR Totum" }],
  }),
  component: FinanceiroPage,
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
  return fmt(n);
}

type FilterRange = 7 | 30 | 9999;

function cutoffDate(range: FilterRange): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range < 9999) d.setDate(d.getDate() - range);
  else d.setFullYear(d.getFullYear() - 10);
  return d;
}

// ─── hooks ────────────────────────────────────────────────────────────────────

function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("accounts")
      .select("*")
      .order("created_at")
      .then(({ data }) => {
        setAccounts((data as Account[]) ?? []);
        setLoading(false);
      });
  }, []);

  return { accounts, loading };
}

function useTransactions(range: FilterRange) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const cutoff = cutoffDate(range).toISOString().slice(0, 10);
    supabase
      .from("transactions")
      .select("*")
      .gte("date", cutoff)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTxs((data as Transaction[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => {
    setLoading(true);
    load();
    // realtime: recarrega em qualquer insert/update
    const ch = supabase
      .channel("transactions-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, load)
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  return { txs, loading };
}

// ─── BalanceCard ──────────────────────────────────────────────────────────────

function BalanceCard({ accounts, loading }: { accounts: Account[]; loading: boolean }) {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  return (
    <div
      className="glass iris-ring p-8 flex flex-col gap-6"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 520ms cubic-bezier(.2,.8,.2,1), transform 520ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-[color:var(--lg-muted-fg)] mb-2">
            Saldo Total
          </p>
          {loading ? (
            <div className="h-12 w-48 rounded-lg animate-pulse bg-white/10" />
          ) : (
            <p
              className="text-5xl font-light tabular-nums"
              style={{ letterSpacing: "-0.06em", color: "var(--lg-fg)" }}
            >
              {fmt(total)}
            </p>
          )}
        </div>
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
        >
          <DollarSign className="size-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse bg-white/6" />
            ))
          : accounts.map((a, i) => (
              <div
                key={a.id}
                className="rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(8px)",
                  transition: `opacity 500ms ${120 + i * 80}ms cubic-bezier(.2,.8,.2,1), transform 500ms ${120 + i * 80}ms cubic-bezier(.2,.8,.2,1)`,
                }}
              >
                <p className="text-[11px] text-[color:var(--lg-muted-fg)] truncate">{a.name}</p>
                <p
                  className="mt-1 text-lg font-light tabular-nums"
                  style={{ letterSpacing: "-0.04em", color: "#60a5fa" }}
                >
                  {fmtShort(a.balance)}
                </p>
              </div>
            ))}
      </div>
    </div>
  );
}

// ─── CashFlowChart ────────────────────────────────────────────────────────────

function CashFlowChart({ txs, loading }: { txs: Transaction[]; loading: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);

  const points = useMemo(() => {
    if (!txs.length) return [];
    const byDay = new Map<string, number>();
    for (const tx of [...txs].reverse()) {
      const prev = byDay.get(tx.date) ?? 0;
      byDay.set(tx.date, prev + (tx.type === "credit" ? tx.amount : -tx.amount));
    }
    const sorted = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
    let running = 0;
    return sorted.map(([date, delta]) => {
      running += delta;
      return { date, value: running };
    });
  }, [txs]);

  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    const W = 620, H = 120, pad = 12;
    const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const ys = vals.map((v) => H - pad - ((v - min) / range) * (H - pad * 2));

    let d = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < xs.length; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2;
      d += ` C ${cpx} ${ys[i - 1]}, ${cpx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
    }
    return d;
  }, [points]);

  useEffect(() => {
    if (!pathD || drawn) return;
    const path = svgRef.current?.querySelector<SVGPathElement>(".chart-line");
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.style.transition = "stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)";
    requestAnimationFrame(() => { path.style.strokeDashoffset = "0"; });
    setDrawn(true);
  }, [pathD, drawn]);

  if (loading) {
    return <div className="glass iris-ring h-44 animate-pulse" />;
  }
  if (!points.length) {
    return (
      <div className="glass iris-ring h-44 flex items-center justify-center text-sm text-[color:var(--lg-muted-fg)]">
        Sem dados no período
      </div>
    );
  }

  const trend = points[points.length - 1].value - points[0].value;

  return (
    <div className="glass iris-ring p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-[color:var(--lg-muted-fg)]">
            Fluxo de Caixa
          </p>
          <p
            className="mt-1 text-2xl font-light tabular-nums flex items-center gap-2"
            style={{ letterSpacing: "-0.05em" }}
          >
            {trend >= 0 ? (
              <TrendingUp className="size-5 text-[#34d399]" />
            ) : (
              <TrendingDown className="size-5 text-[color:var(--color-totum-error,#f43f5e)]" />
            )}
            <span style={{ color: trend >= 0 ? "#34d399" : "#f43f5e" }}>
              {trend >= 0 ? "+" : ""}
              {fmtShort(trend)}
            </span>
          </p>
        </div>
        <p className="text-[11px] text-[color:var(--lg-muted-fg)]">
          {points[0].date} → {points[points.length - 1].date}
        </p>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 620 120"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: "80px" }}
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* area fill — static */}
        <path
          d={`${pathD} L 620 120 L 0 120 Z`}
          fill="url(#chartGrad)"
          stroke="none"
        />
        {/* animated line */}
        <path
          className="chart-line"
          d={pathD}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── TransactionsTable ────────────────────────────────────────────────────────

const RANGE_LABELS: Record<FilterRange, string> = {
  7: "7 dias",
  30: "30 dias",
  9999: "Todos",
};

function TransactionsTable({
  txs,
  loading,
  range,
  onRange,
}: {
  txs: Transaction[];
  loading: boolean;
  range: FilterRange;
  onRange: (r: FilterRange) => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); setTimeout(() => setVisible(true), 40); }, [txs]);

  const totCredit = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totDebit  = txs.filter((t) => t.type === "debit").reduce((s, t)  => s + t.amount, 0);

  return (
    <div className="glass iris-ring flex flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 px-6 pt-6 pb-4 border-b border-[color:var(--lg-border)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs tracking-widest uppercase text-[color:var(--lg-muted-fg)]">
              Transações
            </p>
            <p className="mt-0.5 text-sm text-[color:var(--lg-muted-fg)]">
              {txs.length} registros
            </p>
          </div>
          {/* Summary pills */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm" style={{ color: "#34d399" }}>
              <ArrowUpRight className="size-4" />
              <span className="tabular-nums font-light" style={{ letterSpacing: "-0.04em" }}>
                {fmtShort(totCredit)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: "#f87171" }}>
              <ArrowDownLeft className="size-4" />
              <span className="tabular-nums font-light" style={{ letterSpacing: "-0.04em" }}>
                {fmtShort(totDebit)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {([7, 30, 9999] as FilterRange[]).map((r) => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className="rounded-full px-3 py-1 text-xs transition-all"
              style={
                range === r
                  ? {
                      background: "rgba(96,165,250,0.18)",
                      color: "#60a5fa",
                      boxShadow: "inset 0 0 0 1px rgba(96,165,250,0.35)",
                    }
                  : { color: "var(--lg-muted-fg)" }
              }
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-[color:var(--lg-border)]">
              {["Data", "Descrição", "Tipo", "Valor"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[10px] font-medium tracking-widest uppercase text-[color:var(--lg-muted-fg)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <div className="h-4 rounded animate-pulse bg-white/8" style={{ width: j === 1 ? "70%" : "50%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : txs.map((tx, i) => (
                  <tr
                    key={tx.id}
                    className="border-b border-[color:var(--lg-border)] last:border-0 transition-colors hover:bg-white/4"
                    style={{
                      opacity: visible ? 1 : 0,
                      transform: visible ? "translateY(0)" : "translateY(6px)",
                      transition: `opacity 320ms ${i * 25}ms ease, transform 320ms ${i * 25}ms ease`,
                    }}
                  >
                    <td className="px-6 py-3 text-[color:var(--lg-muted-fg)] whitespace-nowrap">
                      {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-6 py-3 text-[color:var(--lg-fg)] max-w-[200px] truncate">
                      {tx.description}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={
                          tx.type === "credit"
                            ? { background: "rgba(52,211,153,0.12)", color: "#34d399" }
                            : { background: "rgba(248,113,113,0.12)", color: "#f87171" }
                        }
                      >
                        {tx.type === "credit" ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownLeft className="size-3" />
                        )}
                        {tx.type === "credit" ? "Crédito" : "Débito"}
                      </span>
                    </td>
                    <td
                      className="px-6 py-3 text-right tabular-nums font-light whitespace-nowrap"
                      style={{
                        letterSpacing: "-0.04em",
                        color: tx.type === "credit" ? "#34d399" : "#f87171",
                      }}
                    >
                      {tx.type === "credit" ? "+" : "−"}
                      {fmt(tx.amount)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function FinanceiroPage() {
  const [range, setRange] = useState<FilterRange>(30);
  const { accounts, loading: loadingAcc } = useAccounts();
  const { txs, loading: loadingTx } = useTransactions(range);

  return (
    <main
      className="min-h-screen px-4 py-10 md:px-8 lg:px-12"
      style={{ fontFeatureSettings: '"tnum" 1' }}
    >
      {/* Page header */}
      <div
        className="mb-10"
        style={{ letterSpacing: "-0.06em" }}
      >
        <h1 className="text-3xl font-light text-[color:var(--lg-fg)]">Financeiro</h1>
        <p className="mt-1 text-sm text-[color:var(--lg-muted-fg)]" style={{ letterSpacing: "-0.01em" }}>
          Visão consolidada · Totum
        </p>
      </div>

      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {/* Balance card */}
        <BalanceCard accounts={accounts} loading={loadingAcc} />

        {/* Chart */}
        <CashFlowChart txs={txs} loading={loadingTx} />

        {/* Transactions */}
        <TransactionsTable
          txs={txs}
          loading={loadingTx}
          range={range}
          onRange={setRange}
        />
      </div>
    </main>
  );
}
