"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, CircleDollarSign, KeyRound, LoaderCircle, LogIn, PackagePlus, ReceiptText, RefreshCw, Tags, TriangleAlert, X, Menu as MenuIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { MenuContainer, MenuItem } from "@/components/ui/fluid-menu";
import { ProductManager } from "@/components/product-manager";
import type { AdminProduct } from "@/lib/product-admin";

type Overview = {
  totals: { orders: number; revenueCents: number; stockIssues: number };
  products: AdminProduct[];
  inventory: { variantId: string; productName: string; label: string; available: number; sold: number }[];
  recentOrders: { orderNo: string; email: string; amountCents: number; status: string; createdAt: string; variantLabel: string }[];
};

const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);

export function AdminDashboard() {
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem("card-store-admin-token") ?? "");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variantId, setVariantId] = useState("");
  const [keys, setKeys] = useState("");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [navDragging, setNavDragging] = useState(false);
  const navPressTimer = useRef<number | null>(null);
  const navDraggingRef = useRef(false);
  const navTargetRef = useRef("overview");
  const suppressNavClickRef = useRef(false);

  useEffect(() => {
    if (!overview) return;
    const sectionIds = ["overview", "products", "inventory", "orders"];
    const updateActiveSection = () => {
      if (navDraggingRef.current) return;
      const atPageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24;
      if (atPageBottom) {
        setActiveSection("orders");
        return;
      }
      const marker = window.scrollY + Math.min(220, window.innerHeight * 0.28);
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= marker) current = id;
      }
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [overview]);


  function sectionAtPoint(x: number, y: number) {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-admin-section]")?.dataset.adminSection;
  }

  function startNavDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const section = (event.target as HTMLElement).closest<HTMLElement>("[data-admin-section]")?.dataset.adminSection;
    if (!section) return;

    const nav = event.currentTarget;
    const pointerId = event.pointerId;
    navTargetRef.current = section;
    if (navPressTimer.current) window.clearTimeout(navPressTimer.current);
    navPressTimer.current = window.setTimeout(() => {
      navPressTimer.current = null;
      if (!nav.isConnected) return;
      try {
        nav.setPointerCapture(pointerId);
      } catch {
        return;
      }
      navDraggingRef.current = true;
      setNavDragging(true);
      setActiveSection(navTargetRef.current);
    }, 180);
  }

  function cancelPendingNavDrag() {
    if (navDraggingRef.current || !navPressTimer.current) return;
    window.clearTimeout(navPressTimer.current);
    navPressTimer.current = null;
  }
  function moveNavDrag(event: React.PointerEvent<HTMLElement>) {
    if (!navDraggingRef.current) return;
    event.preventDefault();
    const section = sectionAtPoint(event.clientX, event.clientY);
    if (section && section !== navTargetRef.current) {
      navTargetRef.current = section;
      setActiveSection(section);
    }
  }

  function finishNavDrag(event: React.PointerEvent<HTMLElement>) {
    if (navPressTimer.current) window.clearTimeout(navPressTimer.current);
    navPressTimer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!navDraggingRef.current) return;
    event.preventDefault();
    navDraggingRef.current = false;
    setNavDragging(false);
    suppressNavClickRef.current = true;
    window.setTimeout(() => { suppressNavClickRef.current = false; }, 0);
    goToAdminSection(navTargetRef.current);
  }

  function cancelNavDrag(event: React.PointerEvent<HTMLElement>) {
    if (navPressTimer.current) window.clearTimeout(navPressTimer.current);
    navPressTimer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    navDraggingRef.current = false;
    setNavDragging(false);
  }

  function captureNavClick(event: React.MouseEvent<HTMLElement>) {
    if (!suppressNavClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNavClickRef.current = false;
  }

  function goToAdminSection(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadOverview(authToken = token) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { headers: { authorization: `Bearer ${authToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "加载失败");
      sessionStorage.setItem("card-store-admin-token", authToken);
      setOverview(data);
      setVariantId((current) => current || data.inventory[0]?.variantId || "");
    } catch (reason) {
      setOverview(null);
      setError(reason instanceof Error ? reason.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function importKeys(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    const lines = keys.split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean);
    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ variantId, keys: lines }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "导入失败");
      setMessage(`已导入 ${data.imported} 条，跳过 ${data.skipped} 条`);
      setKeys("");
      await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    }
  }

  if (!overview) {
    return (
      <div className="admin-shell">
        <SiteHeader active="admin" />
        <main className="admin-login">
        <Link href="/"><ArrowLeft size={18} /> 返回商店</Link>
        <form onSubmit={(event) => { event.preventDefault(); void loadOverview(); }}>
          <span className="admin-icon"><KeyRound size={25} /></span>
          <h1>库存后台</h1>
          <p>请输入管理员访问令牌</p>
          <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Admin token" autoFocus required />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}进入后台</button>
          <small>开发环境默认令牌：dev-admin-token</small>
        </form>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <SiteHeader active="admin" />
      <main className="admin-page">
      <aside className="admin-sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><KeyRound size={18} /></span><span>数字授权中心</span></Link>
        <div className="admin-mobile-fluid-menu">
          <MenuContainer label="后台快捷导航">
            <MenuItem
              closeOnSelect={false}
              label="展开或收起导航"
              icon={
                <div className="relative h-6 w-6">
                  <div className="absolute inset-0 origin-center rotate-0 scale-100 opacity-100 transition-all duration-300 [div[data-expanded=true]_&]:rotate-180 [div[data-expanded=true]_&]:scale-0 [div[data-expanded=true]_&]:opacity-0"><MenuIcon size={24} strokeWidth={1.5} /></div>
                  <div className="absolute inset-0 origin-center -rotate-180 scale-0 opacity-0 transition-all duration-300 [div[data-expanded=true]_&]:rotate-0 [div[data-expanded=true]_&]:scale-100 [div[data-expanded=true]_&]:opacity-100"><X size={24} strokeWidth={1.5} /></div>
                </div>
              }
            />
            <MenuItem label="总览" isActive={activeSection === "overview"} onClick={() => goToAdminSection("overview")} icon={<Boxes size={24} strokeWidth={1.5} />} />
            <MenuItem label="商品管理" isActive={activeSection === "products"} onClick={() => goToAdminSection("products")} icon={<Tags size={24} strokeWidth={1.5} />} />
            <MenuItem label="导入库存" isActive={activeSection === "inventory"} onClick={() => goToAdminSection("inventory")} icon={<PackagePlus size={24} strokeWidth={1.5} />} />
            <MenuItem label="最近订单" isActive={activeSection === "orders"} onClick={() => goToAdminSection("orders")} icon={<ReceiptText size={24} strokeWidth={1.5} />} />
          </MenuContainer>
        </div>
        <nav
          data-active-section={activeSection}
          data-dragging={navDragging}
          onPointerDown={startNavDrag}
          onPointerMove={moveNavDrag}
          onPointerLeave={cancelPendingNavDrag}
          onPointerUp={finishNavDrag}
          onPointerCancel={cancelNavDrag}
          onClickCapture={captureNavClick}
          onDragStart={(event) => event.preventDefault()}
        >
          <a className={activeSection === "overview" ? "active" : ""} href="#overview" data-admin-section="overview" onClick={(event) => { event.preventDefault(); goToAdminSection("overview"); }}><Boxes size={18} />总览</a>
          <a className={activeSection === "products" ? "active" : ""} href="#products" data-admin-section="products" onClick={(event) => { event.preventDefault(); goToAdminSection("products"); }}><PackagePlus size={18} />商品管理</a>
          <a className={activeSection === "inventory" ? "active" : ""} href="#inventory" data-admin-section="inventory" onClick={(event) => { event.preventDefault(); goToAdminSection("inventory"); }}><PackagePlus size={18} />导入库存</a>
          <a className={activeSection === "orders" ? "active" : ""} href="#orders" data-admin-section="orders" onClick={(event) => { event.preventDefault(); goToAdminSection("orders"); }}><ReceiptText size={18} />最近订单</a>
        </nav>
        <Link className="back-store" href="/"><ArrowLeft size={17} />返回商店</Link>
      </aside>
      <div className="admin-content">
        <header><div><span className="section-index">OPERATIONS</span><h1>销售与库存</h1></div><div className="admin-header-actions"><button className="icon-action" onClick={() => loadOverview()} title="刷新数据"><RefreshCw size={18} /></button></div></header>
        {error && <p className="form-error">{error}</p>}
        <section className="metric-grid" id="overview">
          <Metric icon={<ReceiptText />} label="累计订单" value={String(overview.totals.orders)} />
          <Metric icon={<CircleDollarSign />} label="已交付销售额" value={money(overview.totals.revenueCents)} />
          <Metric icon={<TriangleAlert />} label="缺货订单" value={String(overview.totals.stockIssues)} warning={overview.totals.stockIssues > 0} />
        </section>

        <ProductManager products={overview.products} token={token} onSaved={() => loadOverview()} />

        <section className="admin-section" id="inventory">
          <div className="section-heading"><div><span className="section-index">INVENTORY</span><h2>卡密库存</h2></div></div>
          <div className="inventory-layout">
            <div className="inventory-table table-shell">
              <table><thead><tr><th>商品</th><th>规格</th><th>可售</th><th>已售</th></tr></thead><tbody>
                {overview.inventory.map((item) => <tr key={item.variantId}><td>{item.productName}</td><td>{item.label}</td><td><strong>{item.available}</strong></td><td>{item.sold}</td></tr>)}
              </tbody></table>
            </div>
            <form className="import-panel" onSubmit={importKeys}>
              <h3><PackagePlus size={19} />批量导入</h3>
              <label>商品规格<select value={variantId} onChange={(event) => setVariantId(event.target.value)}>{overview.inventory.map((item) => <option key={item.variantId} value={item.variantId}>{item.label} · {item.productName}</option>)}</select></label>
              <label>卡密列表<textarea value={keys} onChange={(event) => setKeys(event.target.value)} placeholder={"每行一条卡密\nAAAA-BBBB-CCCC"} required /></label>
              {message && <p className="success-message">{message}</p>}
              <button className="primary-button"><PackagePlus size={18} />导入卡密</button>
            </form>
          </div>
        </section>

        <section className="admin-section" id="orders">
          <div className="section-heading"><div><span className="section-index">ORDERS</span><h2>最近订单</h2></div></div>
          <div className="table-shell"><table><thead><tr><th>订单号</th><th>客户</th><th>规格</th><th>金额</th><th>状态</th><th>时间</th></tr></thead><tbody>
            {overview.recentOrders.length ? overview.recentOrders.map((order) => <tr key={order.orderNo}><td><code>{order.orderNo}</code></td><td>{order.email}</td><td>{order.variantLabel}</td><td>{money(order.amountCents)}</td><td><span className={`status-badge status-${order.status}`}>{order.status}</span></td><td>{new Date(order.createdAt.replace(" ", "T") + "Z").toLocaleString("zh-CN")}</td></tr>) : <tr><td colSpan={6} className="empty-cell">暂无订单</td></tr>}
          </tbody></table></div>
        </section>
      </div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, warning }: { icon: React.ReactNode; label: string; value: string; warning?: boolean }) {
  return <div className={`metric ${warning ? "warning" : ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
