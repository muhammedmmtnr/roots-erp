import { errorResponse, json } from "@/lib/api";
import { asNumber, coerceProduct, coerceTransaction, getSupabase, throwIfSupabaseError } from "@/lib/supabase";

function localDateKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(value: string | Date = new Date()) {
  return localDateKey(value).slice(0, 7);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const [productsResult, contactsResult, transactionsResult] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("contacts").select("id, type"),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    await throwIfSupabaseError(productsResult.error);
    await throwIfSupabaseError(contactsResult.error);
    await throwIfSupabaseError(transactionsResult.error);

    const products = (productsResult.data ?? []).map((row) => coerceProduct(row as Record<string, unknown>));
    const contacts = contactsResult.data ?? [];
    const transactions = (transactionsResult.data ?? []).map((row) => coerceTransaction(row as Record<string, unknown>));

    const today = localDateKey();
    const thisMonth = monthKey();
    let todaySales = 0;
    let todayPurchases = 0;
    let monthTax = 0;
    const monthlyMap = new Map<string, { month: string; sales: number; wholesale: number }>();

    for (const transaction of transactions) {
      const created = String(transaction.created_at ?? "");
      const day = localDateKey(created);
      const month = monthKey(created);
      const total = asNumber(transaction.total);
      const tax = asNumber(transaction.tax);

      if (transaction.type === "purchase") {
        if (day === today) todayPurchases += total;
      } else {
        if (day === today) todaySales += total;
        if (month === thisMonth) monthTax += tax;
      }

      if (month >= monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1))) {
        const bucket = monthlyMap.get(month) ?? { month, sales: 0, wholesale: 0 };
        if (transaction.type !== "purchase") {
          bucket.sales += total;
          if (transaction.type === "wholesale") bucket.wholesale += total;
        }
        monthlyMap.set(month, bucket);
      }
    }

    const stockValue = products.reduce((sum, product) => sum + asNumber(product.stock) * asNumber(product.cost), 0);
    const unitsInStock = products.reduce((sum, product) => sum + asNumber(product.stock), 0);
    const lowStock = products.filter((product) => {
      const stock = asNumber(product.stock);
      return stock > 0 && stock <= asNumber(product.low_stock);
    }).length;
    const outOfStock = products.filter((product) => asNumber(product.stock) === 0).length;
    const customers = contacts.filter((contact) => contact.type === "customer" || contact.type === "both").length;
    const alerts = products
      .filter((product) => asNumber(product.stock) <= asNumber(product.low_stock))
      .sort((a, b) => asNumber(a.stock) - asNumber(b.stock))
      .slice(0, 5);

    return json({
      today_sales: todaySales,
      today_purchases: todayPurchases,
      month_tax: monthTax,
      stock_value: stockValue,
      customers,
      products: products.length,
      units_in_stock: unitsInStock,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      monthlySales: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
      recent: transactions.slice(0, 6),
      alerts,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
