import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TENANT_ID = (import.meta.env.VITE_FINANCE_TENANT_ID as string | undefined) ?? "totum";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados.");
}

/**
 * Stub que devolve respostas vazias em todas as chamadas usadas pelo app
 * (.from().select().order().gte().then(), .channel().on().subscribe(),
 * removeChannel()). Evita o crash "supabaseUrl is required." em rotas
 * que importam o client antes das envs estarem setadas.
 */
function makeStub(): SupabaseClient {
  const thenable = {
    then(resolve: (v: { data: never[]; error: null }) => unknown) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  const queryChain: Record<string, unknown> = {};
  const q = new Proxy(queryChain, {
    get: (_t, prop) => {
      if (prop === "then") return thenable.then;
      return () => q;
    },
  });
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => Promise.resolve("ok"),
  };
  return {
    from: () => q,
    channel: () => channel,
    removeChannel: () => Promise.resolve("ok"),
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON!, {
      global: { headers: { "x-tenant-id": TENANT_ID } },
    })
  : makeStub();

export const TENANT = TENANT_ID;

export type Account = {
  id: string;
  name: string;
  balance: number;
  tenant_id: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  account_id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  date: string;
  tenant_id: string;
  created_at: string;
};
