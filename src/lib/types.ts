export type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  low_stock: number;
  tax_rate: number;
};

export type Contact = {
  id: number;
  name: string;
  type: "customer" | "supplier" | "both";
  phone: string;
  email: string;
  gstin: string;
  address: string;
};

export type Transaction = {
  id: number;
  number: string;
  type: "retail" | "wholesale" | "purchase";
  contact_id: number | null;
  contact_name: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  created_at: string;
};

export type DashboardData = {
  today_sales: number;
  today_purchases: number;
  month_tax: number;
  stock_value: number;
  customers: number;
  products: number;
  units_in_stock: number;
  low_stock: number;
  out_of_stock: number;
  monthlySales: { month: string; sales: number; wholesale: number }[];
  recent: Transaction[];
  alerts: Product[];
};

export type ReportsData = {
  monthly: { month: string; sales: number; purchases: number; tax: number; invoices: number }[];
  gst: { taxable_sales: number; total_tax: number; cgst: number; sgst: number };
  stock: (Product & { stock_value: number })[];
  transactions: Transaction[];
};
