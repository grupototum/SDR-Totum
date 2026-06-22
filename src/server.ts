import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Same-origin proxy para o motor SDR.
 * O cliente chama `/api/engine/<path>` (same-origin); aqui — e SÓ aqui, no
 * servidor — injetamos o Bearer com a `SDR_API_KEY` lida de `process.env`.
 * A chave NUNCA vai pro bundle do browser (não é VITE_*) e NUNCA é logada.
 *
 * Nota de arquitetura: o TanStack Start desta versão não expõe
 * `createServerFileRoute`, então a rota-proxy vive aqui no entry `fetch` real
 * (que já intercepta todas as requisições) em vez de um arquivo de rota.
 */
async function proxyEngine(request: Request): Promise<Response> {
  const ENGINE_URL = process.env.ENGINE_URL;
  const SDR_API_KEY = process.env.SDR_API_KEY;
  const jsonHeaders = { "content-type": "application/json" };

  if (!ENGINE_URL || !SDR_API_KEY) {
    return new Response(JSON.stringify({ error: "engine not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/engine\/?/, "");
  const target = `${ENGINE_URL.replace(/\/$/, "")}/${path}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${SDR_API_KEY}`,
    },
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  try {
    const resp = await fetch(target, init);
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { "content-type": resp.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // Não logar nada que contenha a chave/Authorization.
    return new Response(JSON.stringify({ error: "upstream unavailable" }), {
      status: 502,
      headers: jsonHeaders,
    });
  }
}

/**
 * Same-origin proxy para o N8N (mesma regra de segurança da engine).
 * O cliente chama `/api/n8n/<path>` (same-origin); aqui — e SÓ aqui, no
 * servidor — injetamos o header `X-N8N-API-KEY` com a `N8N_API_KEY` lida de
 * `process.env`. A chave NUNCA vai pro bundle do browser (não é VITE_*) e
 * NUNCA é logada. Auth do n8n usa header `X-N8N-API-KEY` (não Bearer).
 *
 * Repassa GET/POST/PUT/PATCH/DELETE preservando querystring + body.
 * Erro de rede no upstream → 502.
 */
async function proxyN8n(request: Request): Promise<Response> {
  const N8N_API_URL = process.env.N8N_API_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY;
  const jsonHeaders = { "content-type": "application/json" };

  if (!N8N_API_URL || !N8N_API_KEY) {
    return new Response(JSON.stringify({ error: "n8n not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/n8n\/?/, "");
  const target = `${N8N_API_URL.replace(/\/$/, "")}/${path}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "X-N8N-API-KEY": N8N_API_KEY,
    },
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  try {
    const resp = await fetch(target, init);
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { "content-type": resp.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // Nunca logar nada que contenha a key/X-N8N-API-KEY.
    return new Response(JSON.stringify({ error: "upstream unavailable" }), {
      status: 502,
      headers: jsonHeaders,
    });
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Rota-proxy same-origin do motor: injeta o Bearer no servidor.
    const { pathname } = new URL(request.url);
    if (pathname === "/api/engine" || pathname.startsWith("/api/engine/")) {
      return proxyEngine(request);
    }
    // Rota-proxy same-origin do N8N: injeta o X-N8N-API-KEY no servidor.
    if (pathname === "/api/n8n" || pathname.startsWith("/api/n8n/")) {
      return proxyN8n(request);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
