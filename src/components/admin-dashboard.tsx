"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Boxes, CircleDollarSign, Copy, Download, KeyRound, LoaderCircle, LogIn, MailCheck, PackagePlus, ReceiptText, RefreshCw, Search, Send, ShieldCheck, Tags, Trash2, TriangleAlert, Upload, X, Menu as MenuIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { MenuContainer, MenuItem } from "@/components/ui/fluid-menu";
import { ProductManager } from "@/components/product-manager";
import type { AdminProduct } from "@/lib/product-admin";

type Overview = {
  totals: { orders: number; revenueCents: number; stockIssues: number };
  products: AdminProduct[];
  inventory: { variantId: string; productName: string; label: string; available: number; sold: number }[];
  recentOrders: {
    orderNo: string;
    email: string;
    amountCents: number;
    status: string;
    createdAt: string;
    variantLabel: string;
    emailStatus: "pending" | "sending" | "sent" | "failed" | null;
    emailAttempts: number | null;
    emailSentAt: string | null;
    emailLastError: string | null;
  }[];
};

type InventoryKey = { id: number; variantId: string; productName: string; variantLabel: string; last4: string; key: string; status: "available" | "reserved" | "sold" | "disabled"; orderNo: string | null; createdAt: string; soldAt: string | null };

const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);

export function AdminDashboard() {
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem("card-store-admin-token") ?? "");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variantId, setVariantId] = useState("");
  const [keys, setKeys] = useState("");
  const [message, setMessage] = useState("");
  const [inventoryKeys, setInventoryKeys] = useState<InventoryKey[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState("all");
  const [selectedKeyIds, setSelectedKeyIds] = useState<number[]>([]);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [resendingOrderNo, setResendingOrderNo] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [navDragging, setNavDragging] = useState(false);
  const navPressTimer = useRef<number | null>(null);
  const navDraggingRef = useRef(false);
  const navTargetRef = useRef("overview");
  const suppressNavClickRef = useRef(false);

  useEffect(() => {
    if (!overview) return;
    const sectionIds = ["overview", "products", "inventory", "backups", "orders"];
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
      void loadInventory(authToken);
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

  async function loadInventory(authToken = token) {
    try {
      const params = new URLSearchParams();
      if (variantId) params.set("variantId", variantId);
      if (inventoryStatus !== "all") params.set("status", inventoryStatus);
      if (inventorySearch.trim()) params.set("search", inventorySearch.trim());
      const response = await fetch(`/api/admin/inventory?${params}`, { headers: { authorization: `Bearer ${authToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "加载卡密失败");
      setInventoryKeys(data.keys);
      setSelectedKeyIds([]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "加载卡密失败"); }
  }

  async function mutateInventory(action: "available" | "disabled" | "delete") {
    if (!selectedKeyIds.length) return;
    if (action === "delete" && !window.confirm(`确认删除选中的 ${selectedKeyIds.length} 条未售卡密？此操作无法撤销。`)) return;
    setInventoryBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/inventory", { method: action === "delete" ? "DELETE" : "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(action === "delete" ? { ids: selectedKeyIds } : { ids: selectedKeyIds, status: action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "操作失败");
      setMessage(action === "delete" ? `已删除 ${data.deleted} 条卡密` : `已更新 ${data.updated} 条卡密`);
      await Promise.all([loadInventory(), loadOverview()]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败"); }
    finally { setInventoryBusy(false); }
  }

  async function resendDeliveryEmail(orderNo: string, email: string) {
    if (!window.confirm(`确认重新向 ${email} 发送订单 ${orderNo} 的卡密邮件？`)) return;
    setResendingOrderNo(orderNo);
    setOrderMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderNo)}/resend-email`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "邮件重新发送失败");
      setOrderMessage(`订单 ${orderNo} 的卡密邮件已重新发送`);
      await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "邮件重新发送失败");
    } finally {
      setResendingOrderNo("");
    }
  }

  async function downloadBackup(event: React.FormEvent) {
    event.preventDefault();
    setBackupBusy(true);
    setBackupMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ passphrase: backupPassphrase }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "创建备份失败");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `reii-backup-${new Date().toISOString().slice(0, 10)}.reiibak`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBackupMessage("加密备份已下载，请妥善保存文件和密码");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建备份失败");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup(event: React.FormEvent) {
    event.preventDefault();
    if (!restoreFile) {
      setError("请选择 .reiibak 备份文件");
      return;
    }
    if (!window.confirm("恢复会用备份内容替换当前商品、库存和订单数据。确认继续吗？")) return;
    setRestoreBusy(true);
    setBackupMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("backup", restoreFile);
      form.set("passphrase", restorePassphrase);
      form.set("confirmation", restoreConfirmation);
      const response = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "恢复备份失败");
      setBackupMessage(`数据恢复完成；服务器已保留恢复前副本 ${data.emergencyBackup}`);
      setRestoreFile(null);
      setRestorePassphrase("");
      setRestoreConfirmation("");
      await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复备份失败");
    } finally {
      setRestoreBusy(false);
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
        <Link className="brand" href="/"><span className="brand-mark brand-photo"><Image src="/reii-bear.jpg" alt="" width={34} height={34} /></span><span>Reii小店</span></Link>
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
            <MenuItem label="备份恢复" isActive={activeSection === "backups"} onClick={() => goToAdminSection("backups")} icon={<ArchiveRestore size={24} strokeWidth={1.5} />} />
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
          <a className={activeSection === "backups" ? "active" : ""} href="#backups" data-admin-section="backups" onClick={(event) => { event.preventDefault(); goToAdminSection("backups"); }}><ArchiveRestore size={18} />备份恢复</a>
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
          <div className="inventory-manager table-shell">
            <div className="inventory-manager-toolbar">
              <div><h3><KeyRound size={18} />卡密管理</h3><p>已售与预留卡密只读，避免影响已交付订单。</p></div>
              <div className="inventory-filters"><label><Search size={15} /><input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="尾号或订单号" /></label><select value={inventoryStatus} onChange={(event) => setInventoryStatus(event.target.value)}><option value="all">全部状态</option><option value="available">可售</option><option value="disabled">已停用</option><option value="sold">已售</option><option value="reserved">预留</option></select><button type="button" className="icon-action" onClick={() => void loadInventory()} title="查询"><RefreshCw size={17} /></button></div>
            </div>
            <div className="inventory-bulk-actions"><span>已选 {selectedKeyIds.length} 条</span><button type="button" disabled={!selectedKeyIds.length || inventoryBusy} onClick={() => void mutateInventory("available")}>启用</button><button type="button" disabled={!selectedKeyIds.length || inventoryBusy} onClick={() => void mutateInventory("disabled")}>停用</button><button type="button" className="danger-button" disabled={!selectedKeyIds.length || inventoryBusy} onClick={() => void mutateInventory("delete")}><Trash2 size={15} />删除</button></div>
            <div className="inventory-key-table"><table><thead><tr><th><input type="checkbox" checked={inventoryKeys.filter((key) => key.status === "available" || key.status === "disabled").length > 0 && inventoryKeys.filter((key) => key.status === "available" || key.status === "disabled").every((key) => selectedKeyIds.includes(key.id))} onChange={(event) => setSelectedKeyIds(event.target.checked ? inventoryKeys.filter((key) => key.status === "available" || key.status === "disabled").map((key) => key.id) : [])} /></th><th>商品 / 规格</th><th>完整卡密</th><th>状态</th><th>订单号</th><th>导入时间</th></tr></thead><tbody>{inventoryKeys.length ? inventoryKeys.map((key, index) => { const editable = key.status === "available" || key.status === "disabled"; return <tr key={key.id} className="inventory-key-row" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}><td>{editable && <input type="checkbox" checked={selectedKeyIds.includes(key.id)} onChange={(event) => setSelectedKeyIds((current) => event.target.checked ? [...current, key.id] : current.filter((id) => id !== key.id))} />}</td><td>{key.productName}<small>{key.variantLabel}</small></td><td><div className="key-value"><code>{key.key}</code><button type="button" className="copy-key-button" onClick={() => navigator.clipboard.writeText(key.key)} title="复制卡密"><Copy size={14} /></button></div></td><td><span className={`status-badge status-${key.status}`}>{key.status === "available" ? "可售" : key.status === "disabled" ? "已停用" : key.status === "sold" ? "已售" : "预留"}</span></td><td>{key.orderNo ? <code>{key.orderNo}</code> : "—"}</td><td>{new Date(key.createdAt.replace(" ", "T") + "Z").toLocaleString("zh-CN")}</td></tr>; }) : <tr><td colSpan={6} className="empty-cell">没有符合条件的卡密</td></tr>}</tbody></table></div>
          </div>
        </section>

        <section className="admin-section" id="backups">
          <div className="section-heading"><div><span className="section-index">DATA SAFETY</span><h2>备份与恢复</h2></div></div>
          {backupMessage && <p className="success-message backup-message"><ShieldCheck size={16} />{backupMessage}</p>}
          <div className="backup-layout">
            <form className="backup-panel" onSubmit={downloadBackup}>
              <span className="backup-panel-icon"><Download size={20} /></span>
              <div><h3>下载加密备份</h3><p>包含商品、卡密库存、订单、发卡记录和商品图片。</p></div>
              <label>设置备份密码<input type="password" minLength={10} maxLength={200} value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} placeholder="至少 10 个字符" autoComplete="new-password" required /></label>
              <button className="primary-button" disabled={backupBusy}>{backupBusy ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}{backupBusy ? "正在加密..." : "创建并下载"}</button>
            </form>
            <form className="backup-panel restore-panel" onSubmit={restoreBackup}>
              <span className="backup-panel-icon"><Upload size={20} /></span>
              <div><h3>恢复加密备份</h3><p>恢复前服务器会自动保留当前数据副本，最多保留 5 份。</p></div>
              <label>备份文件<input className="backup-file-input" type="file" accept=".reiibak,application/octet-stream" onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)} required /></label>
              <label>备份密码<input type="password" minLength={10} maxLength={200} value={restorePassphrase} onChange={(event) => setRestorePassphrase(event.target.value)} placeholder="创建备份时设置的密码" autoComplete="off" required /></label>
              <label>输入“恢复数据”确认<input type="text" value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} placeholder="恢复数据" autoComplete="off" required /></label>
              <button className="danger-button" disabled={restoreBusy || restoreConfirmation !== "恢复数据"}>{restoreBusy ? <LoaderCircle className="spin" size={18} /> : <ArchiveRestore size={18} />}{restoreBusy ? "正在恢复..." : "恢复此备份"}</button>
            </form>
          </div>
        </section>

        <section className="admin-section" id="orders">
          <div className="section-heading"><div><span className="section-index">ORDERS</span><h2>最近订单</h2></div></div>
          {orderMessage && <p className="success-message order-message"><MailCheck size={16} />{orderMessage}</p>}
          <div className="table-shell orders-table"><table><thead><tr><th>订单号</th><th>客户</th><th>规格</th><th>金额</th><th>订单状态</th><th>邮件状态</th><th>时间</th><th>操作</th></tr></thead><tbody>
            {overview.recentOrders.length ? overview.recentOrders.map((order) => {
              const emailStatus = order.emailStatus ?? (order.status === "delivered" ? "pending" : "inactive");
              const emailLabel = { pending: "待发送", sending: "发送中", sent: "已送达", failed: "发送失败", inactive: "未触发" }[emailStatus];
              return <tr key={order.orderNo}>
                <td><code>{order.orderNo}</code></td>
                <td>{order.email}</td>
                <td>{order.variantLabel}</td>
                <td>{money(order.amountCents)}</td>
                <td><span className={`status-badge status-${order.status}`}>{order.status}</span></td>
                <td><span className={`email-status email-status-${emailStatus}`} title={order.emailLastError ?? undefined}>{emailLabel}{order.emailAttempts ? ` · ${order.emailAttempts}次` : ""}</span></td>
                <td>{new Date(order.createdAt.replace(" ", "T") + "Z").toLocaleString("zh-CN")}</td>
                <td className="order-action-cell">{order.status === "delivered" && <button className="resend-email-button" type="button" disabled={resendingOrderNo === order.orderNo} onClick={() => void resendDeliveryEmail(order.orderNo, order.email)} title="重新发送卡密邮件">{resendingOrderNo === order.orderNo ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}<span>{resendingOrderNo === order.orderNo ? "发送中" : "重新发送"}</span></button>}</td>
              </tr>;
            }) : <tr><td colSpan={8} className="empty-cell">暂无订单</td></tr>}
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
