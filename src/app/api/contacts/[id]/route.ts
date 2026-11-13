import { errorResponse, json, optionalText, readJson, requiredText } from "@/lib/api";
import { queueErpExportSync } from "@/lib/google-sheets";
import { coerceContact, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };
const contactTypes = ["customer", "supplier", "both"];

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Not found");
    const supabase = getSupabase();
    const existingResult = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    await throwIfSupabaseError(existingResult.error);
    if (!existingResult.data) throw new Error("Not found");
    const existing = coerceContact(existingResult.data as Record<string, unknown>);
    const body = await readJson(request);
    const type = body.type ?? existing.type;
    if (typeof type !== "string" || !contactTypes.includes(type)) throw new Error("Invalid contact type");

    const payload = {
      name: body.name === undefined ? String(existing.name) : requiredText(body.name, "contact name"),
      type,
      phone: optionalText(body.phone, "phone", String(existing.phone ?? "")),
      email: optionalText(body.email, "email", String(existing.email ?? "")),
      gstin: optionalText(body.gstin, "GSTIN", String(existing.gstin ?? "")),
      address: optionalText(body.address, "address", String(existing.address ?? "")),
    };

    const { data, error } = await supabase.from("contacts").update(payload).eq("id", id).select("*").single();
    await throwIfSupabaseError(error);
    queueErpExportSync();
    return json(coerceContact(data as Record<string, unknown>));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Not found");
    const { data, error } = await getSupabase().from("contacts").delete().eq("id", id).select("id").maybeSingle();
    await throwIfSupabaseError(error);
    if (!data) throw new Error("Not found");
    queueErpExportSync();
    return json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
