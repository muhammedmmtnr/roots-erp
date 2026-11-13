import { GoogleAuth } from "google-auth-library";
import { getSupabase, coerceProduct, coerceTransaction, asNumber } from "@/lib/supabase";

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
};

function sheetsConfig() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const tabName = (process.env.GOOGLE_SHEETS_TAB_NAME?.trim() || "ERP Export").replace(/'/g, "");
  if (!rawJson || !spreadsheetId) return null;
  let credentials: ServiceAccountJson;
  try {
    credentials = JSON.parse(rawJson) as ServiceAccountJson;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON");
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key");
  }
  return { credentials, spreadsheetId, tabName };
}

export function isGoogleSheetsConfigured() {
  return Boolean(sheetsConfig());
}

async function sheetsAccessToken(credentials: ServiceAccountJson) {
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Unable to obtain Google Sheets access token");
  return token.token;
}

async function sheetsRequest(path: string, init: RequestInit & { accessToken: string }) {
  const { accessToken, ...requestInit } = init;
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...requestInit,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...requestInit.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets API failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json();
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

/** Rebuilds the configured spreadsheet tab with a live ERP snapshot. No-op when Sheets is not configured. */
export async function syncErpExportToGoogleSheets() {
  const config = sheetsConfig();
  if (!config) return { skipped: true as const };

  const supabase = getSupabase();
  const [productsResult, contactsResult, transactionsResult, settingsResult] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("contacts").select("*").order("name"),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(250),
    supabase.from("settings").select("key, value"),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (contactsResult.error) throw contactsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const products = (productsResult.data ?? []).map((row) => coerceProduct(row as Record<string, unknown>));
  const contacts = contactsResult.data ?? [];
  const transactions = (transactionsResult.data ?? []).map((row) => coerceTransaction(row as Record<string, unknown>));
  const settings = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value]));

  const exportedAt = new Date().toISOString();
  const rows: (string | number)[][] = [
    ["Root Herbal ERP Export", settings.business_name ?? "", settings.business_location ?? "", exportedAt],
    [],
    ["Products"],
    ["ID", "Name", "SKU", "Barcode", "Category", "Unit", "Price", "Cost", "Stock", "Low stock", "Tax %"],
    ...products.map((product) => [
      asNumber(product.id),
      String(product.name ?? ""),
      String(product.sku ?? ""),
      product.barcode == null ? "" : String(product.barcode),
      String(product.category ?? ""),
      String(product.unit ?? ""),
      asNumber(product.price),
      asNumber(product.cost),
      asNumber(product.stock),
      asNumber(product.low_stock),
      asNumber(product.tax_rate),
    ]),
    [],
    ["Contacts"],
    ["ID", "Name", "Type", "Phone", "Email", "GSTIN", "Address"],
    ...contacts.map((contact) => [
      asNumber(contact.id),
      String(contact.name ?? ""),
      String(contact.type ?? ""),
      String(contact.phone ?? ""),
      String(contact.email ?? ""),
      String(contact.gstin ?? ""),
      String(contact.address ?? ""),
    ]),
    [],
    ["Transactions"],
    ["ID", "Number", "Type", "Contact", "Subtotal", "Tax", "Total", "Payment", "Created at"],
    ...transactions.map((transaction) => [
      asNumber(transaction.id),
      String(transaction.number ?? ""),
      String(transaction.type ?? ""),
      String(transaction.contact_name ?? ""),
      asNumber(transaction.subtotal),
      asNumber(transaction.tax),
      asNumber(transaction.total),
      String(transaction.payment_method ?? ""),
      String(transaction.created_at ?? ""),
    ]),
    [],
    ["Monthly sales (from export window)"],
    ["Month", "Sales", "Purchases", "Tax", "Invoices"],
  ];

  const monthly = new Map<string, { sales: number; purchases: number; tax: number; invoices: number }>();
  for (const transaction of transactions) {
    const key = monthKey(String(transaction.created_at ?? ""));
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    const bucket = monthly.get(key) ?? { sales: 0, purchases: 0, tax: 0, invoices: 0 };
    if (transaction.type === "purchase") {
      bucket.purchases += asNumber(transaction.total);
    } else {
      bucket.sales += asNumber(transaction.subtotal);
      bucket.tax += asNumber(transaction.tax);
      bucket.invoices += 1;
    }
    monthly.set(key, bucket);
  }
  for (const [month, bucket] of [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push([month, bucket.sales, bucket.purchases, bucket.tax, bucket.invoices]);
  }

  const accessToken = await sheetsAccessToken(config.credentials);
  const range = `'${config.tabName}'!A1`;
  await sheetsRequest(`${config.spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
    method: "POST",
    accessToken,
    body: "{}",
  });
  await sheetsRequest(
    `${config.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      accessToken,
      body: JSON.stringify({ values: rows }),
    },
  );

  return { skipped: false as const, rows: rows.length };
}

/** Fire-and-forget Sheets sync so API responses stay fast. Errors are logged only. */
export function queueErpExportSync() {
  void syncErpExportToGoogleSheets().catch((error) => {
    console.error("Google Sheets ERP export sync failed:", error);
  });
}
