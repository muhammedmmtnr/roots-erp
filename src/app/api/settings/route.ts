import { errorResponse, json, optionalText, readJson } from "@/lib/api";
import { queueErpExportSync } from "@/lib/google-sheets";
import { getSupabase, throwIfSupabaseError } from "@/lib/supabase";

const allowedSettings = ["business_name", "business_location", "currency", "gstin"];

async function loadSettings() {
  const { data, error } = await getSupabase().from("settings").select("key, value");
  await throwIfSupabaseError(error);
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

export async function GET() {
  try {
    return json(await loadSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson(request);
    const rows = allowedSettings
      .filter((key) => body[key] !== undefined)
      .map((key) => ({ key, value: optionalText(body[key], key) }));
    if (rows.length) {
      const { error } = await getSupabase().from("settings").upsert(rows, { onConflict: "key" });
      await throwIfSupabaseError(error);
      queueErpExportSync();
    }
    return json(await loadSettings());
  } catch (error) {
    return errorResponse(error);
  }
}
