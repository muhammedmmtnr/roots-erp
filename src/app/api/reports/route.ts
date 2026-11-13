import { errorResponse, json } from "@/lib/api";
import { asNumber, coerceProduct, coerceTransaction, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

function monthKey(value: string) {
  return new Date(value).toISOString().slice(0, 7);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const [productsResult, transactionsResult] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    await throwIfSupabaseError(productsResult.error);
    await throwIfSupabaseError(transactionsResult.error);

    const products = (productsResult.data ?? []).map((row) => coerceProduct(row as Record<string, unknown>));
    const transactions = (transactionsResult.data ?? []).map((row) => coerceTransaction(row as Record<string, unknown>));
    const thisMonth = new Date().toISOString().slice(0, 7);
    const oldestMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1)
      .toISOString()
      .slice(0, 7);

    const monthlyMap = new Map<string, { month: string; sales: number; purchases: number; tax: number; invoices: number }>();
    let taxableSales = 0;
    let totalTax = 0;

    for (const transaction of transactions) {
      const created = String(transaction.created_at ?? "");
      const month = monthKey(created);
      if (month >= oldestMonth) {
        const bucket = monthlyMap.get(month) ?? { month, sales: 0, purchases: 0, tax: 0, invoices: 0 };
        if (transaction.type === "purchase") {
          bucket.purchases += asNumber(transaction.total);
        } else {
          bucket.sales += asNumber(transaction.subtotal);
          bucket.tax += asNumber(transaction.tax);
          bucket.invoices += 1;
        }
        monthlyMap.set(month, bucket);
      }
      if (month === thisMonth && transaction.type !== "purchase") {
        taxableSales += asNumber(transaction.subtotal);
        totalTax += asNumber(transaction.tax);
      }
    }

    const stock = products
      .map((product) => ({
        ...product,
        stock_value: asNumber(product.stock) * asNumber(product.cost),
      }))
      .sort((a, b) => b.stock_value - a.stock_value);

    return json({
      monthly: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
      gst: {
        taxable_sales: taxableSales,
        total_tax: totalTax,
        cgst: totalTax / 2,
        sgst: totalTax / 2,
      },
      stock,
      transactions: transactions.slice(0, 250).map((transaction) => ({
        number: transaction.number,
        type: transaction.type,
        contact_name: transaction.contact_name,
        subtotal: asNumber(transaction.subtotal),
        tax: asNumber(transaction.tax),
        total: asNumber(transaction.total),
        payment_method: transaction.payment_method,
        created_at: transaction.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
