import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Activity, Play, Trash2, Download, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [{ title: "Diagnostics — SDR Totum" }],
  }),
  component: DiagnosticsPage,
});

type LogEntry = {
  id: string;
  ts: number;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  ok?: boolean;
  requestBody?: string;
  responseBody?: string;
  error?: string;
};

const STORAGE_KEY = "sdr.diagnostics.logs.v1";
const MAX_LOGS = 200;
const TRACKED = ["/api/engine", "/api/n8n", "/api/flows", "/api/conversations", "/api/reports"];

function shouldTrack(url: string) {
  try {
    const u = url.startsWith("http") ? new URL(url).pathname + new URL(url).search : url;
    return TRACKED.some((p) => u.startsWith(p));
  } catch {
    return TRACKED.some((p) => url.includes(p));
  }
}

function truncate(s: string, n = 4000) {
  return s.length > n ? s.slice(0, n) + `\n…(${s.length - n} bytes truncados)` : s;
}

let installed = false;
const subscribers = new Set<(e: LogEntry) => void>();

function installFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!shouldTrack(url)) return orig(input, init);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const start = performance.now();
    let requestBody: string | undefined;
    try {
      const body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
      if (typeof body === "string") requestBody = truncate(body);
    } catch {
      /* ignore */
    }
    try {
      const res = await orig(input, init);
      const durationMs = Math.round(performance.now() - start);
      let responseBody = "";
      try {
        responseBody = truncate(await res.clone().text());
      } catch {
        /* ignore */
      }
      const entry: LogEntry = {
        id, ts: Date.now(), method, url, status: res.status, ok: res.ok,
        durationMs, requestBody, responseBody,
      };
      subscribers.forEach((cb) => cb(entry));
      return res;
    } catch (err) {
      const entry: LogEntry = {
        id, ts: Date.now(), method, url,
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
        requestBody,
      };
      subscribers.forEach((cb) => cb(entry));
      throw err;
    }
  };
}

function statusColor(status?: number, ok?: boolean, error?: string) {
  if (error) return "#da2128";
  if (!status) return "#9ca3af";
  if (ok) return "#35a670";
  if (status >= 500) return "#da2128";
  if (status >= 400) return "#f59e0b";
  return "#077ac7";
}

function DiagnosticsPage() {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [probing, setProbing] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  useEffect(() => {
    installFetchInterceptor();
    const onEntry = (e: LogEntry) => {
      const next = [e, ...logsRef.current].slice(0, MAX_LOGS);
      setLogs(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    };
    subscribers.add(onEntry);
    return () => {
      subscribers.delete(onEntry);
    };
  }, []);

  const runProbes = useCallback(async () => {
    setProbing(true);
    const targets = [
      ["GET", "/api/engine-v3/health"],
      ["GET", "/api/engine-v3/api/flows"],
      ["GET", "/api/engine-v3/api/sim/status"],
      ["GET", "/api/n8n/workflows"],
    ] as const;
    await Promise.allSettled(
      targets.map(([m, u]) => fetch(u, { method: m }).catch(() => undefined)),
    );
    setProbing(false);
  }, []);

  const clear = () => {
    setLogs([]);
    setSelected(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sdr-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = logs.filter(
    (l) =>
      !filter ||
      l.url.toLowerCase().includes(filter.toLowerCase()) ||
      String(l.status ?? "").includes(filter) ||
      l.method.toLowerCase().includes(filter.toLowerCase()),
  );
  const detail = filtered.find((l) => l.id === selected) ?? filtered[0];

  const copyDetail = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-6 py-4 glass">
        <div className="flex items-center gap-3">
          <Activity className="size-5 text-[color:var(--color-text-muted)]" />
          <div>
            <h1 className="text-base text-white">Diagnostics</h1>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Captura respostas de /api/flows, engine e n8n. Útil para diagnosticar 503 / 401 / 502.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por url, método, status…"
            className="glass rounded-full px-3 py-1.5 text-xs text-white outline-none w-64"
          />
          <button
            onClick={runProbes}
            disabled={probing}
            className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            <Play className="size-3.5" /> {probing ? "Executando…" : "Rodar sondas"}
          </button>
          <button
            onClick={exportLogs}
            disabled={!logs.length}
            className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            <Download className="size-3.5" /> Exportar
          </button>
          <button
            onClick={clear}
            disabled={!logs.length}
            className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Limpar
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[420px] shrink-0 overflow-y-auto border-r border-border">
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-xs text-[color:var(--color-text-muted)]">
              Sem registros ainda. Clique em <strong>Rodar sondas</strong> ou navegue pela
              plataforma — qualquer chamada a /api/engine, /api/flows, /api/n8n,
              /api/conversations e /api/reports será capturada automaticamente.
            </div>
          )}
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelected(l.id)}
              className={`w-full border-b border-border px-4 py-3 text-left transition-colors ${
                detail?.id === l.id
                  ? "bg-[color:var(--lg-card-hover)]"
                  : "hover:bg-[color:var(--lg-card)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-[color:var(--color-text-muted)]">
                  {l.method}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-mono"
                  style={{ background: statusColor(l.status, l.ok, l.error), color: "#fff" }}
                >
                  {l.error ? "ERR" : (l.status ?? "—")}
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-[11px] text-white">{l.url}</div>
              <div className="mt-1 flex justify-between text-[10px] text-[color:var(--color-text-muted)]">
                <span>{new Date(l.ts).toLocaleTimeString("pt-BR")}</span>
                <span>{l.durationMs ?? "—"}ms</span>
              </div>
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {!detail ? (
            <div className="text-sm text-[color:var(--color-text-muted)]">
              Selecione um registro à esquerda.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-white">
                    {detail.method} {detail.url}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    {new Date(detail.ts).toLocaleString("pt-BR")} · {detail.durationMs ?? "—"}ms ·{" "}
                    status {detail.error ? "ERR" : (detail.status ?? "—")}
                  </div>
                </div>
                <button
                  onClick={copyDetail}
                  className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-white hover:opacity-90"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copiado" : "Copiar JSON"}
                </button>
              </div>

              {detail.error && (
                <Section title="Erro">
                  <pre className="whitespace-pre-wrap break-words text-xs text-[#da2128]">
                    {detail.error}
                  </pre>
                </Section>
              )}

              {detail.requestBody && (
                <Section title="Request body">
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-[color:var(--color-text-body)]">
                    {detail.requestBody}
                  </pre>
                </Section>
              )}

              <Section title="Response body">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-[color:var(--color-text-body)]">
                  {detail.responseBody || "(vazio)"}
                </pre>
              </Section>

              {detail.status === 503 && (
                <Section title="Hint">
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    503 com <code>engine not configured</code> indica que <code>ENGINE_URL</code>{" "}
                    e/ou <code>SDR_API_KEY</code> não foram setados no servidor. Após salvar as
                    envs, é necessário republicar o frontend.
                  </p>
                </Section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {title}
      </div>
      {children}
    </div>
  );
}
