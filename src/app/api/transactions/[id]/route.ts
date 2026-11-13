import { errorResponse, json } from "@/lib/api";
import { asNumber, coerceTransaction, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Not found");
    const supabase = getSupabase();
    const transactionResult = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
    await throwIfSupabaseError(transactionResult.error);
    if (!transactionResult.data) throw new Error("Not found");

    const itemsResult = await supabase
      .from("transaction_items")
      .select("product_name, quantity, unit_price, tax_rate, line_total")
      .eq("transaction_id", id)
      .order("id");
    await throwIfSupabaseError(itemsResult.error);

    const items = (itemsResult.data ?? []).map((item) => ({
      product_name: String(item.product_name ?? ""),
      quantity: asNumber(item.quantity),
      unit_price: asNumber(item.unit_price),
      tax_rate: asNumber(item.tax_rate),
      line_total: asNumber(item.line_total),
    }));

    return json({
      transaction: coerceTransaction(transactionResult.data as Record<string, unknown>),
      items,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
