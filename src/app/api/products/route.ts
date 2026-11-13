import { errorResponse, json, numberValue, optionalText, readJson, requiredText } from "@/lib/api";
import { queueErpExportSync } from "@/lib/google-sheets";
import { coerceProduct, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const supabase = getSupabase();
    let query = supabase.from("products").select("*").order("name");
    if (search) {
      const pattern = `%${search.replace(/[%_,.()"]/g, " ").trim()}%`;
      query = query.or(`name.ilike."${pattern}",sku.ilike."${pattern}",barcode.ilike."${pattern}",category.ilike."${pattern}"`);
    }
    const { data, error } = await query;
    await throwIfSupabaseError(error);
    return json((data ?? []).map((row) => coerceProduct(row as Record<string, unknown>)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const payload = {
      name: requiredText(body.name, "product name"),
      sku: requiredText(body.sku, "SKU"),
      barcode: optionalText(body.barcode, "barcode") || null,
      category: optionalText(body.category, "category", "General"),
      unit: optionalText(body.unit, "unit", "pcs"),
      price: numberValue(body.price, "selling price", 0),
      cost: numberValue(body.cost, "cost price", 0),
      stock: numberValue(body.stock, "opening stock", 0),
      low_stock: numberValue(body.lowStock, "low stock threshold", 5),
      tax_rate: numberValue(body.taxRate, "tax rate", 18),
    };
    const { data, error } = await getSupabase().from("products").insert(payload).select("*").single();
    await throwIfSupabaseError(error);
    queueErpExportSync();
    return json(coerceProduct(data as Record<string, unknown>), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
