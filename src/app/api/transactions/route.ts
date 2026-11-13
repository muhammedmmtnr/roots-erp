import { randomUUID } from "node:crypto";
import { errorResponse, json, numberValue, optionalText, readJson } from "@/lib/api";
import { queueErpExportSync } from "@/lib/google-sheets";
import { coerceTransaction, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

type TransactionType = "retail" | "wholesale" | "purchase";
type LineInput = { productId?: unknown; quantity?: unknown; unitPrice?: unknown };

const transactionTypes: TransactionType[] = ["retail", "wholesale", "purchase"];

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get("type");
    let query = getSupabase()
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(250);
    if (type && transactionTypes.includes(type as TransactionType)) {
      query = query.eq("type", type);
    }
    const { data, error } = await query;
    await throwIfSupabaseError(error);
    return json((data ?? []).map((row) => coerceTransaction(row as Record<string, unknown>)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const type = body.type;
    if (typeof type !== "string" || !transactionTypes.includes(type as TransactionType)) {
      throw new Error("Invalid transaction type");
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
      throw new Error("Invalid transaction items");
    }

    const items = (body.items as LineInput[]).map((rawLine) => {
      const productId = Number(rawLine.productId);
      if (!Number.isSafeInteger(productId) || productId < 1) throw new Error("Invalid product");
      const quantity = numberValue(rawLine.quantity, "quantity");
      if (quantity <= 0) throw new Error("Invalid quantity");
      const item: { product_id: number; quantity: number; unit_price?: number } = {
        product_id: productId,
        quantity,
      };
      if (rawLine.unitPrice !== undefined) {
        item.unit_price = numberValue(rawLine.unitPrice, "unit price");
      }
      return item;
    });

    const contactId = body.contactId === undefined || body.contactId === null || body.contactId === ""
      ? null
      : Number(body.contactId);
    if (contactId !== null && (!Number.isSafeInteger(contactId) || contactId < 1)) {
      throw new Error("Invalid contact");
    }

    const number = `RH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const { data, error } = await getSupabase().rpc("create_erp_transaction", {
      p_number: number,
      p_type: type,
      p_contact_id: contactId,
      p_contact_name: optionalText(body.contactName, "contact name"),
      p_payment_method: optionalText(body.paymentMethod, "payment method", "Cash"),
      p_items: items,
    });
    await throwIfSupabaseError(error);
    queueErpExportSync();
    return json(coerceTransaction(data as Record<string, unknown>), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
