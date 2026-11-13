import { errorResponse, json, optionalText, readJson, requiredText } from "@/lib/api";
import { queueErpExportSync } from "@/lib/google-sheets";
import { coerceContact, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

const contactTypes = ["customer", "supplier", "both"];

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const type = searchParams.get("type");
    let query = getSupabase().from("contacts").select("*").order("name");

    if (type === "customer" || type === "supplier") {
      query = query.in("type", [type, "both"]);
    }
    if (search) {
      const pattern = `%${search.replace(/[%_,.()"]/g, " ").trim()}%`;
      query = query.or(`name.ilike."${pattern}",phone.ilike."${pattern}",email.ilike."${pattern}",gstin.ilike."${pattern}"`);
    }

    const { data, error } = await query;
    await throwIfSupabaseError(error);
    return json((data ?? []).map((row) => coerceContact(row as Record<string, unknown>)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const type = body.type ?? "customer";
    if (typeof type !== "string" || !contactTypes.includes(type)) throw new Error("Invalid contact type");
    const payload = {
      name: requiredText(body.name, "contact name"),
      type,
      phone: optionalText(body.phone, "phone"),
      email: optionalText(body.email, "email"),
      gstin: optionalText(body.gstin, "GSTIN"),
      address: optionalText(body.address, "address"),
    };
    const { data, error } = await getSupabase().from("contacts").insert(payload).select("*").single();
    await throwIfSupabaseError(error);
    queueErpExportSync();
    return json(coerceContact(data as Record<string, unknown>), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
