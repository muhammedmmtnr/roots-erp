import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | undefined;

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!serverClient) {
    serverClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serverClient;
}

export async function throwIfSupabaseError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const failure = new Error(error.message) as Error & { code?: string };
  failure.code = error.code;
  throw failure;
}

export function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function coerceProduct<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    id: asNumber(row.id),
    price: asNumber(row.price),
    cost: asNumber(row.cost),
    stock: asNumber(row.stock),
    low_stock: asNumber(row.low_stock),
    tax_rate: asNumber(row.tax_rate),
  };
}

export function coerceContact<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    id: asNumber(row.id),
  };
}

export function coerceTransaction<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    id: asNumber(row.id),
    contact_id: row.contact_id == null ? null : asNumber(row.contact_id),
    subtotal: asNumber(row.subtotal),
    tax: asNumber(row.tax),
    total: asNumber(row.total),
  };
}
