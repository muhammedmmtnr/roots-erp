"use client";

import {
  Activity, ArrowDown, ArrowDownToLine, ArrowLeftRight, ArrowRight, BarChart3, Barcode,
  Bell, Boxes, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, ClipboardList, CreditCard, FileBarChart, FileText,
  Home, Leaf, LoaderCircle, Menu, Package, Pencil, Plus, Printer, Search, Settings,
  ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Store, Tag, Trash2,
  Truck, Users, WalletCards, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Contact, DashboardData, Product, ReportsData, Transaction } from "@/lib/types";

type Module =
  | "Dashboard" | "POS (Billing)" | "Sales" | "Purchase" | "Stock / Inventory"
  | "Products" | "Wholesale" | "Retail" | "Customers" | "Suppliers" | "Barcode"
  | "GST & Tax" | "Reports" | "Accounts" | "Settings";

type ProductForm = {
  name: string; sku: string; barcode: string; category: string; unit: string;
  price: string; cost: string; stock: string; lowStock: string; taxRate: string;
};
type ContactForm = { name: string; type: Contact["type"]; phone: string; email: string; gstin: string; address: string };
type CartLine = { productId: string; quantity: string; unitPrice: string };
type InvoiceDetail = {
  transaction: Transaction;
  items: { product_name: string; quantity: number; unit_price: number; tax_rate: number; line_total: number }[];
};
const navigation: { label: Module; icon: LucideIcon; group?: string }[] = [
  { label: "Dashboard", icon: Home },
  { label: "POS (Billing)", icon: ShoppingCart },
  { label: "Sales", icon: Activity },
  { label: "Purchase", icon: Truck },
  { label: "Stock / Inventory", icon: Boxes },
  { label: "Products", icon: Package },
  { label: "Wholesale", icon: BriefcaseBusiness },
  { label: "Retail", icon: Store },
  { label: "Customers", icon: Users },
  { label: "Suppliers", icon: Truck },
  { label: "Barcode", icon: Barcode },
  { label: "GST & Tax", icon: FileText },
  { label: "Reports", icon: FileBarChart },
  { label: "Accounts", icon: WalletCards },
  { label: "Settings", icon: Settings },
];

const initialProduct: ProductForm = {
  name: "", sku: "", barcode: "", category: "General", unit: "pcs",
  price: "", cost: "", stock: "0", lowStock: "5", taxRate: "18",
};
const initialContact: ContactForm = { name: "", type: "customer", phone: "", email: "", gstin: "", address: "" };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function shortDate(value: string) {
  return new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"))
    .toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function monthLabel(value: string) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export default function HomePage() {
  const [active, setActive] = useState<Module>("Dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(initialProduct);
  const [contactModal, setContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(initialContact);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDetail | null>(null);
  const [invoiceType, setInvoiceType] = useState<"retail" | "wholesale" | "purchase">("retail");
  const [invoiceContact, setInvoiceContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cart, setCart] = useState<CartLine[]>([{ productId: "", quantity: "1", unitPrice: "" }]);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const globalSearchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardData, productData, contactData, transactionData, settingData, reportData] = await Promise.all([
        requestJson<DashboardData>("/api/dashboard"),
        requestJson<Product[]>("/api/products"),
        requestJson<Contact[]>("/api/contacts"),
        requestJson<Transaction[]>("/api/transactions"),
        requestJson<Record<string, string>>("/api/settings"),
        requestJson<ReportsData>("/api/reports"),
      ]);
      setDashboard(dashboardData);
      setProducts(productData);
      setContacts(contactData);
      setTransactions(transactionData);
      setSettings(settingData);
      setSettingsDraft(settingData);
      setReports(reportData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load ERP data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setProductModal(false);
        setContactModal(false);
        setInvoiceOpen(false);
        setViewingInvoice(null);
        setShowAlerts(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const fitsSearch = !term || [product.name, product.sku, product.barcode, product.category]
        .some((value) => (value ?? "").toLowerCase().includes(term));
      return fitsSearch;
    });
  }, [products, search, active]);

  const visibleContacts = useMemo(() => contacts.filter((contact) => {
    const typeFits = active === "Customers"
      ? contact.type === "customer" || contact.type === "both"
      : active === "Suppliers" ? contact.type === "supplier" || contact.type === "both" : true;
    const term = search.trim().toLowerCase();
    return typeFits && (!term || [contact.name, contact.phone, contact.email, contact.gstin]
      .some((value) => value.toLowerCase().includes(term)));
  }), [contacts, active, search]);

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    if (active === "Retail" && transaction.type !== "retail") return false;
    if (active === "Wholesale" && transaction.type !== "wholesale") return false;
    if (active === "Purchase" && transaction.type !== "purchase") return false;
    if (active === "Sales" && transaction.type === "purchase") return false;
    const term = search.trim().toLowerCase();
    return !term || [transaction.number, transaction.contact_name, transaction.type]
      .some((value) => value.toLowerCase().includes(term));
  }), [transactions, active, search]);

  const searchedProducts = useMemo(() => globalSearch.trim()
    ? products.filter((product) => `${product.name} ${product.sku} ${product.barcode}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 4)
    : [], [products, globalSearch]);

  const openInvoice = (type: "retail" | "wholesale" | "purchase") => {
    setInvoiceType(type);
    setInvoiceContact("");
    setPaymentMethod("Cash");
    setCart([{ productId: "", quantity: "1", unitPrice: "" }]);
    setInvoiceOpen(true);
  };

  const navigate = (label: Module) => {
    setActive(label);
    setSearch("");
    setSidebarOpen(false);
    setShowAlerts(false);
  };

  const handleProductSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...productForm,
        price: Number(productForm.price), cost: Number(productForm.cost), stock: Number(productForm.stock),
        lowStock: Number(productForm.lowStock), taxRate: Number(productForm.taxRate),
      };
      await requestJson(editingProduct ? `/api/products/${editingProduct.id}` : "/api/products", {
        method: editingProduct ? "PATCH" : "POST", body: JSON.stringify(payload),
      });
      setProductModal(false);
      setNotice(editingProduct ? "Product updated" : "Product added to inventory");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  };

  const startProductEdit = (product?: Product) => {
    setEditingProduct(product ?? null);
    setProductForm(product ? {
      name: product.name, sku: product.sku, barcode: product.barcode ?? "", category: product.category,
      unit: product.unit, price: String(product.price), cost: String(product.cost), stock: String(product.stock),
      lowStock: String(product.low_stock), taxRate: String(product.tax_rate),
    } : initialProduct);
    setProductModal(true);
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try {
      await requestJson(`/api/products/${product.id}`, { method: "DELETE" });
      setNotice("Product deleted");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete product");
    }
  };

  const handleContactSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson(editingContact ? `/api/contacts/${editingContact.id}` : "/api/contacts", {
        method: editingContact ? "PATCH" : "POST", body: JSON.stringify(contactForm),
      });
      setContactModal(false);
      setNotice(editingContact ? "Contact updated" : "Contact added");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save contact");
    } finally {
      setBusy(false);
    }
  };

  const startContactEdit = (contact?: Contact) => {
    setEditingContact(contact ?? null);
    setContactForm(contact ? {
      name: contact.name, type: contact.type, phone: contact.phone, email: contact.email,
      gstin: contact.gstin, address: contact.address,
    } : initialContact);
    setContactModal(true);
  };

  const removeContact = async (contact: Contact) => {
    if (!window.confirm(`Delete ${contact.name}?`)) return;
    try {
      await requestJson(`/api/contacts/${contact.id}`, { method: "DELETE" });
      setNotice("Contact deleted");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete contact");
    }
  };

  const selectedLineSubtotal = (line: CartLine) => {
    const product = products.find((item) => String(item.id) === line.productId);
    const price = line.unitPrice === "" ? (product ? invoiceType === "purchase" ? product.cost : product.price : 0) : Number(line.unitPrice);
    return (Number(line.quantity) || 0) * price;
  };
  const invoiceTotal = cart.reduce((total, line) => {
    const product = products.find((item) => String(item.id) === line.productId);
    return total + selectedLineSubtotal(line) * (1 + (product?.tax_rate ?? 0) / 100);
  }, 0);

  const handleInvoiceSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const items = cart.filter((line) => line.productId).map((line) => ({
        productId: Number(line.productId), quantity: Number(line.quantity),
        ...(line.unitPrice === "" ? {} : { unitPrice: Number(line.unitPrice) }),
      }));
      if (!items.length) throw new Error("Add at least one product to this invoice");
      const selectedContact = contacts.find((contact) => String(contact.id) === invoiceContact);
      await requestJson("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: invoiceType,
          contactId: selectedContact?.id ?? null,
          paymentMethod,
          items,
        }),
      });
      setInvoiceOpen(false);
      setActive(invoiceType === "purchase" ? "Purchase" : invoiceType === "wholesale" ? "Wholesale" : "Sales");
      setNotice(invoiceType === "purchase" ? "Purchase recorded and stock updated" : "Invoice created and stock updated");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create invoice");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await requestJson<Record<string, string>>("/api/settings", {
        method: "PATCH", body: JSON.stringify(settingsDraft),
      });
      setSettings(saved);
      setSettingsDraft(saved);
      setNotice("Business settings saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (filename: string, rows: Record<string, string | number>[]) => {
    if (!rows.length) {
      setNotice("There is no data to export yet");
      return;
    }
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((row) =>
      keys.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))]
      .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = globalSearch.trim().toLowerCase();
    const product = products.find((item) => `${item.name} ${item.sku} ${item.barcode}`.toLowerCase().includes(term));
    if (product || term.includes("product") || term.includes("stock")) {
      setActive("Products");
      setSearch(globalSearch);
    } else if (term.includes("customer") || term.includes("supplier")) {
      setActive(term.includes("supplier") ? "Suppliers" : "Customers");
      setSearch("");
    } else if (term.includes("invoice") || term.includes("sale")) {
      setActive("Sales");
      setSearch(globalSearch);
    } else {
      setActive("Products");
      setSearch(globalSearch);
    }
    setGlobalSearch("");
  };

  const viewInvoice = async (transaction: Transaction) => {
    try {
      setViewingInvoice(await requestJson<InvoiceDetail>(`/api/transactions/${transaction.id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load invoice");
    }
  };

  const lowProducts = products.filter((product) => product.stock > 0 && product.stock <= product.low_stock);
  const settingsName = settings.business_name || "Root Herbal";

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Leaf size={31} strokeWidth={2.2} /><span>root</span></div>
          <strong>{settingsName} ERP</strong>
          <small>Wholesale &amp; Retail Management</small>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${active === label ? "active" : ""}`}
              onClick={() => navigate(label)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {label === "Stock / Inventory" && lowProducts.length > 0 && <span className="nav-count">{lowProducts.length}</span>}
            </button>
          ))}
        </nav>
        <button className="location-select" onClick={() => navigate("Settings")}>
          <Store size={17} /><span>{settings.business_name || "Root Herbal"} - {settings.business_location || "Tanur"}</span><ChevronDown size={16} />
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <form className="global-search" onSubmit={handleGlobalSearch}>
            <Search size={18} />
            <input ref={globalSearchRef} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search products, invoices, customers, barcode..." aria-label="Search" />
            <kbd>Ctrl K</kbd>
            {searchedProducts.length > 0 && (
              <div className="search-results">
                {searchedProducts.map((product) => (
                  <button type="button" key={product.id} onClick={() => {
                    setActive("Products"); setSearch(product.name); setGlobalSearch("");
                  }}>
                    <Package size={16} /><span>{product.name}</span><small>{product.sku}</small>
                  </button>
                ))}
              </div>
            )}
          </form>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Stock alerts" onClick={() => setShowAlerts(!showAlerts)}>
              <Bell size={20} />{lowProducts.length > 0 && <span className="notification-dot" />}
            </button>
            <button className="user-profile" onClick={() => navigate("Settings")}>
              <span className="avatar">MM</span><span className="user-meta"><strong>Muhammed M M</strong><small>Admin</small></span><ChevronDown size={16} />
            </button>
          </div>
          {showAlerts && <div className="alert-popover">
            <div className="popover-heading"><strong>Stock alerts</strong><button className="plain-button" onClick={() => navigate("Stock / Inventory")}>View all <ArrowRight size={14} /></button></div>
            {lowProducts.length ? lowProducts.slice(0, 5).map((product) =>
              <div className="alert-row" key={product.id}><CircleAlert size={16} /><span>{product.name}</span><strong>{product.stock} left</strong></div>)
              : <p className="empty-note">All products are above their low-stock threshold.</p>}
          </div>}
        </header>

        <section className="page-content">
          {error && <div className="error-banner" role="alert"><CircleAlert size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
          {loading && !dashboard ? <div className="loading-state"><LoaderCircle className="spin" size={28} /><span>Loading your ERP workspace…</span></div> : null}
          {!loading || dashboard ? (
            <>
              {active === "Dashboard" && <DashboardPage
                dashboard={dashboard} reports={reports} products={products} transactions={transactions}
                onNavigate={navigate} onNewInvoice={() => openInvoice("retail")}
                onNewPurchase={() => openInvoice("purchase")} onNewWholesale={() => openInvoice("wholesale")}
                onAddProduct={() => startProductEdit()}
                onExport={() => exportCsv("root-herbal-sales.csv", transactions.map((item) => ({
                  invoice: item.number, type: item.type, customer: item.contact_name, amount: item.total, date: item.created_at,
                })))}
              />}
              {["Products", "Stock / Inventory"].includes(active) && <ProductsPage
                products={visibleProducts} allProducts={products} search={search} setSearch={setSearch}
                inventory={active === "Stock / Inventory"} onAdd={() => startProductEdit()}
                onEdit={startProductEdit} onDelete={removeProduct}
                onAdjust={(product) => { setEditingProduct(product); setProductForm({ ...initialProduct, name: product.name, sku: product.sku, barcode: product.barcode ?? "", category: product.category, unit: product.unit, price: String(product.price), cost: String(product.cost), stock: String(product.stock), lowStock: String(product.low_stock), taxRate: String(product.tax_rate) }); setProductModal(true); }}
                onExport={() => exportCsv("root-herbal-inventory.csv", products.map((item) => ({
                  sku: item.sku, name: item.name, category: item.category, stock: item.stock, cost: item.cost, price: item.price,
                })))}
              />}
              {["Customers", "Suppliers"].includes(active) && <ContactsPage
                contacts={visibleContacts} search={search} setSearch={setSearch} type={active === "Customers" ? "customer" : "supplier"}
                onAdd={() => { setContactForm({ ...initialContact, type: active === "Customers" ? "customer" : "supplier" }); setEditingContact(null); setContactModal(true); }}
                onEdit={startContactEdit} onDelete={removeContact}
              />}
              {["Sales", "Purchase", "Wholesale", "Retail"].includes(active) && <TransactionsPage
                active={active} transactions={filteredTransactions}
                onNew={() => openInvoice(active === "Purchase" ? "purchase" : active === "Wholesale" ? "wholesale" : "retail")}
                onExport={() => exportCsv(`${active.toLowerCase().replaceAll(" ", "-")}.csv`, filteredTransactions.map((item) => ({
                  invoice: item.number, type: item.type, customer: item.contact_name, subtotal: item.subtotal, tax: item.tax, total: item.total, date: item.created_at,
                })))}
                onPrint={(transaction) => { void viewInvoice(transaction); }}
                search={search} setSearch={setSearch}
              />}
              {active === "POS (Billing)" && <PosPage products={products} contacts={contacts} onStart={() => openInvoice("retail")} />}
              {active === "Barcode" && <BarcodePage products={products} barcode={barcodeSearch} setBarcode={setBarcodeSearch} onProduct={(product) => { setSearch(product.name); setActive("Products"); }} />}
              {active === "GST & Tax" && <GstPage reports={reports} onExport={() => exportCsv("root-herbal-gst-summary.csv", reports?.monthly ?? [])} />}
              {active === "Reports" && <ReportsPage reports={reports} onExport={() => exportCsv("root-herbal-monthly-report.csv", reports?.monthly ?? [])} />}
              {active === "Accounts" && <AccountsPage transactions={transactions} reports={reports} onExport={() => exportCsv("root-herbal-ledger.csv", transactions.map((item) => ({
                date: item.created_at, reference: item.number, entry: item.type, account: item.contact_name, debit: item.type === "purchase" ? item.total : 0, credit: item.type === "purchase" ? 0 : item.total,
              })))}/>}
              {active === "Settings" && <SettingsPage settings={settingsDraft} setSettings={setSettingsDraft} onSubmit={saveSettings} busy={busy} />}
            </>
          ) : null}
        </section>
      </main>

      {productModal && <Modal title={editingProduct ? "Edit product" : "Add a product"} onClose={() => setProductModal(false)}>
        <form className="form-grid" onSubmit={handleProductSave}>
          <label className="field field-wide">Product name<input required autoFocus value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="e.g. Tulsi Drops" /></label>
          <label className="field">SKU<input required value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} placeholder="RH-TUL-30" /></label>
          <label className="field">Barcode<input value={productForm.barcode} onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })} placeholder="Scan or enter barcode" /></label>
          <label className="field">Category<input value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} /></label>
          <label className="field">Unit<input value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })} placeholder="pcs, box, bottle" /></label>
          <label className="field">Selling price (₹)<input required type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
          <label className="field">Cost price (₹)<input required type="number" min="0" step="0.01" value={productForm.cost} onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })} /></label>
          <label className="field">Opening stock<input required type="number" min="0" step="0.01" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
          <label className="field">Low-stock alert at<input required type="number" min="0" step="0.01" value={productForm.lowStock} onChange={(event) => setProductForm({ ...productForm, lowStock: event.target.value })} /></label>
          <label className="field">GST rate (%)<select value={productForm.taxRate} onChange={(event) => setProductForm({ ...productForm, taxRate: event.target.value })}>{[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
          <div className="form-actions"><button type="button" className="button button-muted" onClick={() => setProductModal(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingProduct ? "Save changes" : "Add product"}</button></div>
        </form>
      </Modal>}

      {contactModal && <Modal title={editingContact ? "Edit contact" : "Add a contact"} onClose={() => setContactModal(false)}>
        <form className="form-grid" onSubmit={handleContactSave}>
          <label className="field field-wide">Name<input required autoFocus value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} /></label>
          <label className="field">Contact type<select value={contactForm.type} onChange={(event) => setContactForm({ ...contactForm, type: event.target.value as Contact["type"] })}><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Customer &amp; supplier</option></select></label>
          <label className="field">Phone<input value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} /></label>
          <label className="field">Email<input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></label>
          <label className="field">GSTIN<input value={contactForm.gstin} onChange={(event) => setContactForm({ ...contactForm, gstin: event.target.value.toUpperCase() })} /></label>
          <label className="field field-wide">Address<input value={contactForm.address} onChange={(event) => setContactForm({ ...contactForm, address: event.target.value })} /></label>
          <div className="form-actions"><button type="button" className="button button-muted" onClick={() => setContactModal(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingContact ? "Save changes" : "Add contact"}</button></div>
        </form>
      </Modal>}

      {invoiceOpen && <Modal title={invoiceType === "purchase" ? "Record a purchase" : invoiceType === "wholesale" ? "New wholesale invoice" : "New retail invoice"} onClose={() => setInvoiceOpen(false)} wide>
        <form onSubmit={handleInvoiceSave} className="invoice-form">
          <div className="invoice-meta-grid">
            <label className="field">{invoiceType === "purchase" ? "Supplier" : "Customer"}<select value={invoiceContact} onChange={(event) => setInvoiceContact(event.target.value)}>
              <option value=""> {invoiceType === "purchase" ? "Choose supplier…" : "Walk-in customer"} </option>
              {contacts.filter((contact) => invoiceType === "purchase"
                ? contact.type === "supplier" || contact.type === "both"
                : contact.type === "customer" || contact.type === "both")
                .map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select></label>
            <label className="field">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option><option>Credit</option></select></label>
          </div>
          <div className="invoice-items-heading"><strong>Items</strong><button type="button" className="button button-outline button-small" onClick={() => setCart([...cart, { productId: "", quantity: "1", unitPrice: "" }])}><Plus size={15} /> Add item</button></div>
          <div className="invoice-lines">
            <div className="invoice-line invoice-line-labels"><span>Product</span><span>Qty</span><span>Unit price (₹)</span><span>Amount</span><span /></div>
            {cart.map((line, index) => {
              const product = products.find((item) => String(item.id) === line.productId);
              const lineTotal = selectedLineSubtotal(line) * (1 + (product?.tax_rate ?? 0) / 100);
              return <div className="invoice-line" key={index}>
                <select required aria-label="Product" value={line.productId} onChange={(event) => {
                  const next = [...cart]; next[index] = { ...line, productId: event.target.value, unitPrice: "" }; setCart(next);
                }}><option value="">Select a product</option>{products.filter((item) => invoiceType === "purchase" || item.stock > 0 || item.id === Number(line.productId)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stock} {item.unit}</option>)}</select>
                <input required aria-label="Quantity" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => { const next = [...cart]; next[index] = { ...line, quantity: event.target.value }; setCart(next); }} />
                <input required aria-label="Unit price" type="number" min="0" step="0.01" placeholder={String(product ? invoiceType === "purchase" ? product.cost : product.price : 0)} value={line.unitPrice} onChange={(event) => { const next = [...cart]; next[index] = { ...line, unitPrice: event.target.value }; setCart(next); }} />
                <strong>{money(lineTotal)}</strong>
                <button type="button" className="icon-button compact-icon" aria-label="Remove item" disabled={cart.length === 1} onClick={() => setCart(cart.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button>
              </div>;
            })}
          </div>
          <div className="invoice-total"><span>Invoice total (incl. GST)</span><strong>{money(invoiceTotal)}</strong></div>
          <div className="form-actions"><button type="button" className="button button-muted" onClick={() => setInvoiceOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy || !products.length}>{busy ? "Saving…" : invoiceType === "purchase" ? "Save purchase" : "Create invoice"}</button></div>
        </form>
      </Modal>}

      {viewingInvoice && <Modal title="Invoice details" onClose={() => setViewingInvoice(null)} wide>
        <div className="invoice-print">
          <div className="invoice-paper-heading"><div><span className="invoice-brand"><Leaf size={19} /> {settings.business_name || "Root Herbal"}</span><small>{settings.business_location || "Tanur"} · GSTIN {settings.gstin || "Not configured"}</small></div><div className="invoice-paper-meta"><strong>{viewingInvoice.transaction.type === "purchase" ? "PURCHASE" : "TAX INVOICE"}</strong><span>{viewingInvoice.transaction.number}</span><span>{shortDate(viewingInvoice.transaction.created_at)}</span></div></div>
          <div className="invoice-party"><small>{viewingInvoice.transaction.type === "purchase" ? "SUPPLIER" : "BILL TO"}</small><strong>{viewingInvoice.transaction.contact_name}</strong></div>
          <div className="table-scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead><tbody>
            {viewingInvoice.items.map((item, index) => <tr key={`${item.product_name}-${index}`}><td>{item.product_name}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{item.tax_rate}%</td><td><strong>{money(item.line_total)}</strong></td></tr>)}
          </tbody></table></div>
          <div className="invoice-paper-totals"><div><span>Subtotal</span><strong>{money(viewingInvoice.transaction.subtotal)}</strong></div><div><span>GST</span><strong>{money(viewingInvoice.transaction.tax)}</strong></div><div className="invoice-paper-total"><span>Total</span><strong>{money(viewingInvoice.transaction.total)}</strong></div><small>Payment: {viewingInvoice.transaction.payment_method}</small></div>
        </div>
        <div className="invoice-print-actions"><button className="button button-muted" onClick={() => setViewingInvoice(null)}>Close</button><button className="button button-primary" onClick={() => window.print()}><Printer size={16} /> Print invoice</button></div>
      </Modal>}

      {notice && <div className="toast"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function DashboardPage({ dashboard, reports, products, transactions, onNavigate, onNewInvoice, onNewPurchase, onNewWholesale, onAddProduct, onExport }: {
  dashboard: DashboardData | null; reports: ReportsData | null; products: Product[]; transactions: Transaction[];
  onNavigate: (module: Module) => void; onNewInvoice: () => void; onNewPurchase: () => void; onNewWholesale: () => void; onAddProduct: () => void; onExport: () => void;
}) {
  const date = new Date();
  const monthGst = reports?.gst;
  const sales = dashboard?.monthlySales ?? [];
  const maxSales = Math.max(...sales.map((item) => item.sales), 1);
  const quickActions: { label: string; icon: LucideIcon; action: () => void }[] = [
    { label: "New Invoice\n(Retail)", icon: ClipboardList, action: onNewInvoice },
    { label: "Wholesale\nInvoice", icon: Package, action: onNewWholesale },
    { label: "Add Stock\n(Purchase)", icon: Plus, action: onNewPurchase },
    { label: "Add Product", icon: Tag, action: onAddProduct },
    { label: "Scan Barcode", icon: Barcode, action: () => onNavigate("Barcode") },
    { label: "View Stock", icon: Boxes, action: () => onNavigate("Stock / Inventory") },
    { label: "GST Reports", icon: FileText, action: () => onNavigate("GST & Tax") },
    { label: "Sales Report", icon: BarChart3, action: onExport },
  ];
  return <div className="dashboard-page">
    <div className="welcome-row">
      <div><h1>Good {date.getHours() < 12 ? "morning" : date.getHours() < 17 ? "afternoon" : "evening"}, Muhammed <span className="wave">👋</span></h1><p>Here&apos;s what&apos;s happening at Root Herbal today.</p></div>
      <div className="date-chip"><CalendarDays size={17} />Today, {date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}<ChevronDown size={16} /></div>
    </div>
    <div className="stats-grid">
      <StatCard title="Today's Sales" value={money(dashboard?.today_sales)} icon={ShoppingBag} tone="green" foot="Retail & wholesale" />
      <StatCard title="Today's Purchase" value={money(dashboard?.today_purchases)} icon={ShoppingCart} tone="blue" foot="Stock received today" />
      <StatCard title="GST Collected (Month)" value={money(dashboard?.month_tax)} icon={BarChart3} tone="green" foot="Output tax" />
      <StatCard title="Total Stock Value" value={money(dashboard?.stock_value)} icon={Package} tone="red" foot="At cost price" />
      <StatCard title="Total Customers" value={(dashboard?.customers ?? 0).toLocaleString("en-IN")} icon={Users} tone="blue" foot={`${dashboard?.products ?? 0} products`} />
    </div>
    <div className="dashboard-middle">
      <section className="panel sales-overview">
        <div className="panel-heading"><div><h2>Sales Overview</h2><p>Monthly sales performance</p></div><div className="legend"><span><i className="legend-dot retail-dot" />Sales</span><span><i className="legend-dot wholesale-dot" />Wholesale</span></div></div>
        <div className="sales-chart">
          {sales.length ? sales.map((item) => <div className="chart-column" key={item.month}>
            <div className="chart-bars"><span className="bar-retail" style={{ height: `${Math.max(4, item.sales / maxSales * 100)}%` }} /><span className="bar-wholesale" style={{ height: `${Math.max(3, item.wholesale / maxSales * 100)}%` }} /></div>
            <small>{monthLabel(item.month)}</small>
          </div>) : <div className="chart-empty">Sales activity will appear here as you create invoices.</div>}
        </div>
        <div className="chart-caption"><span><i className="legend-dot retail-dot" /> Total sales</span><strong>{money(sales.reduce((sum, item) => sum + item.sales, 0))}</strong></div>
      </section>
      <section className="panel quick-panel">
        <div className="panel-heading"><div><h2>Quick Actions</h2><p>Common tasks, one tap away</p></div><Sparkles size={18} className="subtle-icon" /></div>
        <div className="quick-grid">{quickActions.map(({ label, icon: Icon, action }) => <button className="quick-action" key={label} onClick={action}><Icon size={24} /><span>{label.split("\n").map((line) => <span key={line}>{line}</span>)}</span></button>)}</div>
      </section>
      <section className="panel stock-alert-panel">
        <div className="panel-heading"><div><h2>Stock Alert</h2><p>Products at or below reorder level</p></div><button className="text-link" onClick={() => onNavigate("Stock / Inventory")}>View all <ArrowRight size={14} /></button></div>
        {(dashboard?.alerts ?? []).length ? <div className="alert-list">{dashboard?.alerts.slice(0, 4).map((product) =>
          <button className="stock-alert-row" key={product.id} onClick={() => onNavigate("Stock / Inventory")}>
            <span className="product-placeholder"><Leaf size={19} /></span><span className="stock-alert-name"><strong>{product.name}</strong><small>{product.sku}</small></span><span className={product.stock === 0 ? "stock-red" : "stock-orange"}>{product.stock === 0 ? "Out of stock" : `${product.stock} ${product.unit} left`}</span><ChevronRight size={15} />
          </button>)}</div> : <div className="empty-note success-empty"><Check size={17} />All stock levels look healthy.</div>}
      </section>
    </div>
    <div className="dashboard-bottom">
      <section className="panel summary-panel">
        <div className="panel-heading"><div><h2><span className="heading-icon"><BarChart3 size={17} /></span>Business Summary</h2><p>Inventory at a glance</p></div></div>
        <SummaryLine icon={Package} label="Total Products" value={(dashboard?.products ?? products.length).toLocaleString("en-IN")} />
        <SummaryLine icon={Check} label="Units in Stock" value={(dashboard?.units_in_stock ?? 0).toLocaleString("en-IN")} tone="green" />
        <SummaryLine icon={CircleAlert} label="Low Stock" value={String(dashboard?.low_stock ?? 0)} tone="orange" />
        <SummaryLine icon={X} label="Out of Stock" value={String(dashboard?.out_of_stock ?? 0)} tone="red" />
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recent Invoices</h2><p>Latest sales and purchases</p></div><button className="text-link" onClick={() => onNavigate("Sales")}>View all <ArrowRight size={14} /></button></div>
        <TransactionTable transactions={dashboard?.recent ?? transactions.slice(0, 5)} compact />
      </section>
      <section className="panel gst-summary-panel">
        <div className="panel-heading"><div><h2><span className="heading-icon"><FileText size={17} /></span>GST Summary</h2><p>This month</p></div></div>
        <div className="gst-line"><span>Taxable Sales</span><strong>{money(monthGst?.taxable_sales)}</strong></div>
        <div className="gst-line"><span>CGST (50%)</span><strong>{money(monthGst?.cgst)}</strong></div>
        <div className="gst-line"><span>SGST (50%)</span><strong>{money(monthGst?.sgst)}</strong></div>
        <div className="gst-line gst-total"><span>Total GST</span><strong>{money(monthGst?.total_tax)}</strong></div>
        <button className="gst-details-link" onClick={() => onNavigate("GST & Tax")}>View tax reports <ArrowRight size={14} /></button>
      </section>
    </div>
  </div>;
}

function StatCard({ title, value, icon: Icon, tone, foot }: { title: string; value: string; icon: LucideIcon; tone: string; foot: string }) {
  return <section className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={22} /></div><div className="stat-info"><span>{title}</span><strong>{value}</strong><small>{foot}</small></div></section>;
}

function SummaryLine({ icon: Icon, label, value, tone = "" }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return <div className="summary-line"><Icon className={tone} size={17} /><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function ProductsPage({ products, allProducts, search, setSearch, inventory, onAdd, onEdit, onDelete, onAdjust, onExport }: {
  products: Product[]; allProducts: Product[]; search: string; setSearch: (value: string) => void; inventory: boolean;
  onAdd: () => void; onEdit: (product: Product) => void; onDelete: (product: Product) => void; onAdjust: (product: Product) => void; onExport: () => void;
}) {
  const [lowOnly, setLowOnly] = useState(false);
  const displayedProducts = lowOnly
    ? products.filter((item) => item.stock > 0 && item.stock <= item.low_stock)
    : products;
  return <div className="module-page">
    <PageHeading title={inventory ? "Stock & Inventory" : "Products"} description={inventory ? "Monitor stock levels and manage reorder thresholds." : "Manage your products, pricing and tax rates."}
      action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add Product</button>} />
    <div className="mini-stats-row">
      <MiniStat label="Total products" value={allProducts.length} icon={Package} />
      <MiniStat label="In stock" value={allProducts.filter((item) => item.stock > item.low_stock).length} icon={Check} tone="green" />
      <MiniStat label="Low stock" value={allProducts.filter((item) => item.stock > 0 && item.stock <= item.low_stock).length} icon={CircleAlert} tone="orange" />
      <MiniStat label="Out of stock" value={allProducts.filter((item) => item.stock === 0).length} icon={X} tone="red" />
    </div>
    <section className="panel data-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={17} /><input placeholder="Search name, SKU or barcode…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><button className="button button-outline button-small" onClick={onExport}><ArrowDownToLine size={15} /> Export</button><button className={`button button-outline button-small ${lowOnly ? "filter-active" : ""}`} aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}><SlidersHorizontal size={15} /> {lowOnly ? "Showing low stock" : "Low stock"}</button></div></div>
      <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU / Barcode</th><th>Category</th><th>Cost</th><th>Price</th><th>In stock</th><th>GST</th><th>Actions</th></tr></thead>
        <tbody>{displayedProducts.map((product) => <tr key={product.id}>
          <td><div className="table-product"><span className="table-product-icon"><Leaf size={17} /></span><span><strong>{product.name}</strong><small>{product.unit}</small></span></div></td>
          <td><strong className="mono">{product.sku}</strong><small className="table-subtext">{product.barcode || "No barcode"}</small></td>
          <td>{product.category}</td><td>{money(product.cost)}</td><td><strong>{money(product.price)}</strong></td>
          <td><span className={`stock-pill ${product.stock === 0 ? "stock-empty" : product.stock <= product.low_stock ? "stock-low" : "stock-good"}`}>{product.stock} {product.unit}</span><small className="table-subtext">Alert at {product.low_stock}</small></td>
          <td>{product.tax_rate}%</td><td><div className="row-actions"><button className="icon-button compact-icon" title="Adjust stock / edit" onClick={() => onAdjust(product)}><Pencil size={15} /></button><button className="icon-button compact-icon danger-hover" title="Delete product" onClick={() => onDelete(product)}><Trash2 size={15} /></button></div></td>
        </tr>)}
        {!displayedProducts.length && <EmptyTable colSpan={8} title={lowOnly ? "No low-stock products" : "No products found"} description={lowOnly ? "All matching products are above their reorder threshold." : "Try a different search or add your first product."} />}</tbody></table></div>
      <TableFooter count={displayedProducts.length} label="products" />
    </section>
    <p className="muted-footnote">For purchase receipts and sales, use the transaction screens so stock changes are recorded in your inventory history.</p>
  </div>;
}

function ContactsPage({ contacts, search, setSearch, type, onAdd, onEdit, onDelete }: {
  contacts: Contact[]; search: string; setSearch: (value: string) => void; type: "customer" | "supplier";
  onAdd: () => void; onEdit: (contact: Contact) => void; onDelete: (contact: Contact) => void;
}) {
  const title = type === "customer" ? "Customers" : "Suppliers";
  return <div className="module-page">
    <PageHeading title={title} description={`Manage your ${type} directory, contact details and GST information.`}
      action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add {type}</button>} />
    <section className="panel data-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={17} /><input placeholder={`Search ${type}s…`} value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="toolbar-count">{contacts.length} {type}{contacts.length === 1 ? "" : "s"}</span></div>
      <div className="table-scroll"><table><thead><tr><th>Name</th><th>Contact type</th><th>Phone</th><th>Email</th><th>GSTIN</th><th>Address</th><th>Actions</th></tr></thead>
        <tbody>{contacts.map((contact) => <tr key={contact.id}><td><div className="table-contact"><span>{initials(contact.name)}</span><strong>{contact.name}</strong></div></td>
          <td><span className="type-badge">{contact.type === "both" ? "Customer & supplier" : contact.type}</span></td><td>{contact.phone || "—"}</td><td>{contact.email || "—"}</td><td className="mono">{contact.gstin || "—"}</td><td>{contact.address || "—"}</td>
          <td><div className="row-actions"><button className="icon-button compact-icon" title="Edit contact" onClick={() => onEdit(contact)}><Pencil size={15} /></button><button className="icon-button compact-icon danger-hover" title="Delete contact" onClick={() => onDelete(contact)}><Trash2 size={15} /></button></div></td></tr>)}
        {!contacts.length && <EmptyTable colSpan={7} title={`No ${type}s yet`} description={`Add ${type}s to use them on invoices and purchases.`} />}</tbody>
      </table></div><TableFooter count={contacts.length} label={type === "customer" ? "customers" : "suppliers"} />
    </section>
  </div>;
}

function TransactionsPage({ active, transactions, onNew, onExport, onPrint, search, setSearch }: {
  active: Module; transactions: Transaction[]; onNew: () => void; onExport: () => void; onPrint: (transaction: Transaction) => void; search: string; setSearch: (value: string) => void;
}) {
  const purchase = active === "Purchase";
  const title = purchase ? "Purchases" : active === "Wholesale" ? "Wholesale Sales" : active === "Retail" ? "Retail Sales" : "Sales";
  const total = transactions.reduce((sum, item) => sum + item.total, 0);
  return <div className="module-page">
    <PageHeading title={title} description={purchase ? "Record supplier purchases and receive stock into inventory." : "View invoices, payment methods and sales activity."}
      action={<button className="button button-primary" onClick={onNew}><Plus size={17} /> {purchase ? "Record purchase" : "New invoice"}</button>} />
    <div className="mini-stats-row">
      <MiniStat label={purchase ? "Purchase records" : "Invoices"} value={transactions.length} icon={FileText} />
      <MiniStat label={purchase ? "Total purchases" : "Total sales"} value={money(total)} icon={CreditCard} tone="green" />
      <MiniStat label="Tax" value={money(transactions.reduce((sum, item) => sum + item.tax, 0))} icon={FileBarChart} tone="blue" />
      <MiniStat label="Payment types" value={new Set(transactions.map((item) => item.payment_method)).size} icon={WalletCards} tone="orange" />
    </div>
    <section className="panel data-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={17} /><input placeholder="Search invoice or contact…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><button className="button button-outline button-small" onClick={onExport}><ArrowDownToLine size={15} /> Export CSV</button></div></div>
      <div className="table-scroll"><table><thead><tr><th>Invoice no.</th><th>Type</th><th>{purchase ? "Supplier" : "Customer"}</th><th>Subtotal</th><th>Tax</th><th>Total</th><th>Payment</th><th>Date</th><th /></tr></thead>
        <tbody>{transactions.map((transaction) => <tr key={transaction.id}><td><strong className="mono">{transaction.number}</strong></td><td><span className={`type-badge ${transaction.type}`}>{transaction.type}</span></td><td>{transaction.contact_name}</td><td>{money(transaction.subtotal)}</td><td>{money(transaction.tax)}</td><td><strong>{money(transaction.total)}</strong></td><td><span className="payment-tag">{transaction.payment_method}</span></td><td>{shortDate(transaction.created_at)}</td><td><button className="icon-button compact-icon" title="View / print invoice" aria-label={`View invoice ${transaction.number}`} onClick={() => onPrint(transaction)}><FileText size={15} /></button></td></tr>)}
        {!transactions.length && <EmptyTable colSpan={9} title="No transactions found" description="Create an invoice or record a purchase to see it here." />}</tbody></table></div>
      <TableFooter count={transactions.length} label="transactions" />
    </section>
  </div>;
}

function TransactionTable({ transactions, compact = false }: { transactions: Transaction[]; compact?: boolean }) {
  return <div className={`table-scroll ${compact ? "compact-table" : ""}`}><table><thead><tr><th>Invoice no.</th><th>Type</th><th>Customer</th><th>Amount</th><th>Time</th></tr></thead><tbody>
    {transactions.slice(0, compact ? 4 : 20).map((item) => <tr key={item.id}><td><strong className="mono">{item.number}</strong></td><td><span className={`type-badge ${item.type}`}>{item.type}</span></td><td>{item.contact_name}</td><td><strong>{money(item.total)}</strong></td><td>{shortDate(item.created_at)}</td></tr>)}
    {!transactions.length && <EmptyTable colSpan={5} title="No invoices yet" description="Your latest transactions will appear here." />}
  </tbody></table></div>;
}

function PosPage({ products, contacts, onStart }: { products: Product[]; contacts: Contact[]; onStart: () => void }) {
  return <div className="module-page">
    <PageHeading title="POS Billing" description="Create a retail bill, apply GST and update stock in one step." action={<button className="button button-primary" onClick={onStart}><Plus size={17} /> Start billing</button>} />
    <div className="pos-welcome-grid">
      <section className="panel pos-hero"><span className="pos-hero-icon"><ShoppingCart size={26} /></span><h2>Ready for your next sale?</h2><p>Choose products, set quantities and payment method. Inventory will be adjusted when the invoice is saved.</p><button className="button button-primary" onClick={onStart}>Create retail invoice <ArrowRight size={16} /></button></section>
      <section className="panel pos-side-card"><h3>Today at a glance</h3><div className="pos-side-line"><span>Products available</span><strong>{products.filter((product) => product.stock > 0).length}</strong></div><div className="pos-side-line"><span>Registered customers</span><strong>{contacts.filter((contact) => contact.type !== "supplier").length}</strong></div><div className="pos-side-line"><span>Low-stock products</span><strong className="orange">{products.filter((product) => product.stock <= product.low_stock).length}</strong></div></section>
    </div>
    <div className="tip-card"><Sparkles size={18} /><span><strong>Quick tip</strong> — Scan a product barcode in the Barcode screen to check its stock and pricing before billing.</span></div>
  </div>;
}

function BarcodePage({ products, barcode, setBarcode, onProduct }: { products: Product[]; barcode: string; setBarcode: (value: string) => void; onProduct: (product: Product) => void }) {
  const product = products.find((item) => item.barcode === barcode.trim() || item.sku.toLowerCase() === barcode.trim().toLowerCase());
  return <div className="module-page"><PageHeading title="Barcode Scanner" description="Look up a product using a barcode or SKU." />
    <section className="panel barcode-panel"><span className="barcode-icon"><Barcode size={35} /></span><h2>Scan or enter a barcode</h2><p>Use a USB scanner or type a product barcode / SKU below.</p>
      <form className="barcode-search" onSubmit={(event) => { event.preventDefault(); }}><Search size={19} /><input autoFocus value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan barcode or enter SKU…" /><button className="button button-primary" type="submit">Find product</button></form>
      {barcode && <div className={`barcode-result ${product ? "found" : "not-found"}`}>{product ? <>
        <div className="table-product-icon"><Leaf size={22} /></div><div className="barcode-result-info"><strong>{product.name}</strong><span>{product.sku} {product.barcode ? `· ${product.barcode}` : ""}</span></div><div className="barcode-result-price"><strong>{money(product.price)}</strong><span className={product.stock <= product.low_stock ? "orange" : "green"}>{product.stock} {product.unit} in stock</span></div><button className="button button-outline button-small" onClick={() => onProduct(product)}>View product</button>
      </> : <><CircleAlert size={18} /><span>No product found. Check the code or add it to your catalog.</span></>}</div>}
    </section>
    <section className="panel data-panel barcode-product-list"><div className="panel-heading"><div><h2>Products with barcodes</h2><p>{products.filter((item) => item.barcode).length} product barcodes registered</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Barcode</th><th>Price</th><th>Stock</th></tr></thead><tbody>
        {products.filter((item) => item.barcode).map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td className="mono">{item.sku}</td><td className="mono barcode-number">{item.barcode}</td><td>{money(item.price)}</td><td>{item.stock} {item.unit}</td></tr>)}
      </tbody></table></div></section>
  </div>;
}

function GstPage({ reports, onExport }: { reports: ReportsData | null; onExport: () => void }) {
  const gst = reports?.gst;
  return <div className="module-page"><PageHeading title="GST & Tax" description="Review taxable sales and estimated GST collected from recorded invoices." action={<button className="button button-outline" onClick={onExport}><ArrowDownToLine size={16} /> Export report</button>} />
    <div className="stats-grid tax-stats"><StatCard title="Taxable Sales" value={money(gst?.taxable_sales)} icon={ShoppingBag} tone="green" foot="Current month" /><StatCard title="CGST" value={money(gst?.cgst)} icon={FileText} tone="blue" foot="Estimated, 50% of collected tax" /><StatCard title="SGST" value={money(gst?.sgst)} icon={FileText} tone="blue" foot="Estimated, 50% of collected tax" /><StatCard title="Total GST" value={money(gst?.total_tax)} icon={BarChart3} tone="red" foot="Current month" /></div>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Monthly tax summary</h2><p>Calculated from completed sales invoices</p></div><span className="estimated-badge">GST estimate</span></div><div className="table-scroll"><table><thead><tr><th>Month</th><th>Taxable sales</th><th>Purchase value</th><th>CGST</th><th>SGST</th><th>Total tax</th><th>Invoices</th></tr></thead><tbody>
      {(reports?.monthly ?? []).map((item) => <tr key={item.month}><td><strong>{monthLabel(item.month)} {item.month.slice(0, 4)}</strong></td><td>{money(item.sales)}</td><td>{money(item.purchases)}</td><td>{money(item.tax / 2)}</td><td>{money(item.tax / 2)}</td><td><strong>{money(item.tax)}</strong></td><td>{item.invoices}</td></tr>)}
      {!reports?.monthly.length && <EmptyTable colSpan={7} title="No tax activity yet" description="Tax summary will populate as sales invoices are created." />}
    </tbody></table></div></section>
    <div className="tip-card"><CircleAlert size={18} /><span>Tax reports are estimates based on each product&apos;s configured GST rate. Please verify statutory returns with your accountant before filing.</span></div>
  </div>;
}

function ReportsPage({ reports, onExport }: { reports: ReportsData | null; onExport: () => void }) {
  const monthly = reports?.monthly ?? [];
  const highest = monthly.reduce((max, row) => Math.max(max, row.sales), 0);
  return <div className="module-page"><PageHeading title="Reports" description="Sales, purchase, tax and inventory performance at a glance." action={<button className="button button-outline" onClick={onExport}><ArrowDownToLine size={16} /> Export monthly report</button>} />
    <div className="stats-grid report-stats"><StatCard title="Sales (12 months)" value={money(monthly.reduce((sum, item) => sum + item.sales, 0))} icon={ShoppingBag} tone="green" foot="Before tax" /><StatCard title="Purchases (12 months)" value={money(monthly.reduce((sum, item) => sum + item.purchases, 0))} icon={Truck} tone="blue" foot="Including tax" /><StatCard title="Invoices" value={monthly.reduce((sum, item) => sum + item.invoices, 0).toLocaleString("en-IN")} icon={FileText} tone="red" foot="Sales invoices" /><StatCard title="Stock value" value={money(reports?.stock.reduce((sum, item) => sum + item.stock_value, 0))} icon={Boxes} tone="blue" foot="At cost price" /></div>
    <div className="report-grid"><section className="panel"><div className="panel-heading"><div><h2>Monthly sales &amp; purchases</h2><p>Recent 12 months</p></div></div><div className="monthly-chart">{monthly.map((item) => <div className="monthly-row" key={item.month}><span>{monthLabel(item.month)} {item.month.slice(0, 4)}</span><div className="monthly-bar-track"><i style={{ width: `${highest ? item.sales / highest * 100 : 0}%` }} /></div><strong>{money(item.sales)}</strong></div>)}{!monthly.length && <EmptyTable colSpan={3} title="No monthly data" description="Create transactions to generate reports." />}</div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Inventory valuation</h2><p>Products with the highest stock value</p></div></div><div className="report-stock-list">{(reports?.stock ?? []).slice(0, 7).map((item) => <div className="report-stock-row" key={item.id}><div><strong>{item.name}</strong><small>{item.stock} {item.unit} · {item.sku}</small></div><strong>{money(item.stock_value)}</strong></div>)}{!reports?.stock.length && <p className="empty-note">No products in inventory.</p>}</div></section></div>
  </div>;
}

function AccountsPage({ transactions, reports, onExport }: { transactions: Transaction[]; reports: ReportsData | null; onExport: () => void }) {
  const sales = transactions.filter((item) => item.type !== "purchase").reduce((sum, item) => sum + item.total, 0);
  const purchases = transactions.filter((item) => item.type === "purchase").reduce((sum, item) => sum + item.total, 0);
  return <div className="module-page"><PageHeading title="Accounts" description="Simple cashflow overview and transaction ledger." action={<button className="button button-outline" onClick={onExport}><ArrowDownToLine size={16} /> Export ledger</button>} />
    <div className="stats-grid account-stats"><StatCard title="Recorded sales" value={money(sales)} icon={ArrowDown} tone="green" foot="Invoices in latest 250 records" /><StatCard title="Recorded purchases" value={money(purchases)} icon={ArrowDown} tone="red" foot="Purchases in latest 250 records" /><StatCard title="Gross margin estimate" value={money(sales - purchases)} icon={ArrowLeftRight} tone="blue" foot="Sales less purchases" /><StatCard title="GST payable estimate" value={money(reports?.gst.total_tax)} icon={FileText} tone="orange" foot="Current month, output tax" /></div>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Transaction ledger</h2><p>Sales are credits; purchases are debits. This is a basic operational ledger, not a double-entry accounting system.</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Reference</th><th>Entry</th><th>Account / party</th><th>Debit</th><th>Credit</th></tr></thead><tbody>
      {transactions.map((item) => <tr key={item.id}><td>{shortDate(item.created_at)}</td><td className="mono">{item.number}</td><td><span className={`type-badge ${item.type}`}>{item.type}</span></td><td>{item.contact_name}</td><td>{item.type === "purchase" ? money(item.total) : "—"}</td><td>{item.type === "purchase" ? "—" : money(item.total)}</td></tr>)}
      {!transactions.length && <EmptyTable colSpan={6} title="No ledger entries" description="Invoices and purchases will show here as accounting entries." />}
    </tbody></table></div><TableFooter count={transactions.length} label="ledger entries" /></section>
  </div>;
}

function SettingsPage({ settings, setSettings, onSubmit, busy }: { settings: Record<string, string>; setSettings: (value: Record<string, string>) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <div className="module-page"><PageHeading title="Settings" description="Manage the business details shown across your ERP workspace." />
    <form className="panel settings-form" onSubmit={onSubmit}><div className="panel-heading"><div><h2>Business profile</h2><p>Used in store labels, reports and business summaries.</p></div></div>
      <div className="settings-fields"><label className="field">Business name<input required value={settings.business_name ?? ""} onChange={(event) => setSettings({ ...settings, business_name: event.target.value })} /></label><label className="field">Store / location<input value={settings.business_location ?? ""} onChange={(event) => setSettings({ ...settings, business_location: event.target.value })} /></label><label className="field field-wide">Business GSTIN<input value={settings.gstin ?? ""} onChange={(event) => setSettings({ ...settings, gstin: event.target.value.toUpperCase() })} placeholder="Optional" /></label></div>
      <p className="currency-note">Currency is fixed to Indian Rupees (INR) for this India-focused MVP.</p>
      <div className="settings-note"><CircleAlert size={17} /><span>This app has no sign-in protection. Anyone who can access it can view and change ERP data; do not expose it to the public internet.</span></div>
      <button className="button button-primary" disabled={busy}><Check size={16} /> {busy ? "Saving…" : "Save settings"}</button>
    </form>
  </div>;
}

function MiniStat({ label, value, icon: Icon, tone = "" }: { label: string; value: string | number; icon: LucideIcon; tone?: string }) {
  return <div className="mini-stat"><span className={`mini-icon ${tone}`}><Icon size={17} /></span><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function TableFooter({ count, label }: { count: number; label: string }) {
  return <div className="table-footer"><span>Showing <strong>{count}</strong> {label}</span><span className="table-page-count">{count ? "1" : "0"}–{count} of {count}</span><div><button disabled aria-label="Previous page"><ChevronLeft size={16} /></button><button disabled aria-label="Next page"><ChevronRight size={16} /></button></div></div>;
}

function EmptyTable({ colSpan, title, description }: { colSpan: number; title: string; description: string }) {
  return <tr><td colSpan={colSpan}><div className="empty-table"><Package size={25} /><strong>{title}</strong><span>{description}</span></div></td></tr>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>Fields marked with * are required.</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}
