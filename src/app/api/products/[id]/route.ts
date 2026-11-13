import { errorResponse, json, numberValue, optionalText, readJson, requiredText } from "@/lib/api";
import { queueErpExportSync } from "@/lib/google-sheets";
import { coerceProduct, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Not found");
    const body = await readJson(request);
    const supabase = getSupabase();
    const existingResult = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    await throwIfSupabaseError(existingResult.error);
    if (!existingResult.data) throw new Error("Not found");
    const existing = coerceProduct(existingResult.data as Record<string, unknown>);

    const payload = {
      name: body.name === undefined ? existing.name : requiredText(body.name, "product name"),
      sku: body.sku === undefined ? existing.sku : requiredText(body.sku, "SKU"),
      barcode: body.barcode === undefined ? existing.barcode : optionalText(body.barcode, "barcode") || null,
      category: optionalText(body.category, "category", String(existing.category)),
      unit: optionalText(body.unit, "unit", String(existing.unit)),
      price: body.price === undefined ? existing.price : numberValue(body.price, "selling price"),
      cost: body.cost === undefined ? existing.cost : numberValue(body.cost, "cost price"),
      stock: body.stock === undefined ? existing.stock : numberValue(body.stock, "stock"),
      low_stock: body.lowStock === undefined ? existing.low_stock : numberValue(body.lowStock, "low stock threshold"),
      tax_rate: body.taxRate === undefined ? existing.tax_rate : numberValue(body.taxRate, "tax rate"),
    };

    const { data, error } = await supabase.from("products").update(payload).eq("id", id).select("*").single();
    await throwIfSupabaseError(error);
    queueErpExportSync();
    return json(coerceProduct(data as Record<string, unknown>));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Not found");
    const { data, error } = await getSupabase().from("products").delete().eq("id", id).select("id").maybeSingle();
    await throwIfSupabaseError(error);
    if (!data) throw new Error("Not found");
    queueErpExportSync();
    return json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
