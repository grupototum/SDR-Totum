import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const TENANT_ID = (import.meta.env.VITE_FINANCE_TENANT_ID as string | undefined) ?? "totum";

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn("[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados.");
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON ?? "", {
  global: {
    headers: { "x-tenant-id": TENANT_ID },
  },
});

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
