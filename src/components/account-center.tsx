"use client";

import { useEffect, useState } from "react";
import { Clock3, FileText, LogOut, Mail, ReceiptText, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type CustomerOrder = {
  orderNo: string;
  productName: string;
  variantLabel: string;
  amountCents: number;
  currency: "CNY";
  status: "pending" | "paid" | "delivered" | "paid_no_stock" | "cancelled";
  paymentMethod: string;
  createdAt: string;
  paidAt: string | null;
  invoiceId: number | null;
  invoiceStatus: "pending" | "issued" | "rejected" | null;
};

type Dashboard = {
  email: string;
  totals: { totalSpendCents: number; orderCount: number; deliveredCount: number; invoiceCount: number };
  orders: CustomerOrder[];
};

const statusLabels: Record<CustomerOrder["status"], string> = {
  pending: "待支付",
  paid: "已支付",
  delivered: "已发货",
  paid_no_stock: "等待补货",
  cancelled: "已取消",
};

function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(cents / 100);
}

function dateLabel(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function AccountCenter() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invoiceOrderNo, setInvoiceOrderNo] = useState<string | null>(null);
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceTaxNo, setInvoiceTaxNo] = useState("");
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<Dashboard>;
      })
      .then((data) => { if (!cancelled && data) { setDashboard(data); setEmail(data.email); } })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (sendingCode || cooldown > 0) return;
    setError("");
    setMessage("");
    setSendingCode(true);
    try {
      const response = await fetch("/api/auth/request-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "验证码发送失败");
      if (data.devCode) setCode(data.devCode);
      setCooldown(60);
      setMessage(data.devCode ? `开发环境验证码：${data.devCode}` : "验证码已发送，请检查邮箱");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "验证码发送失败");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "登录失败");
      await loadDashboard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setVerifying(false);
    }
  }

  async function loadDashboard() {
    const response = await fetch("/api/user/me", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "用户信息加载失败");
    setDashboard(data);
    setEmail(data.email);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setDashboard(null);
    setCode("");
    setMessage("已退出用户中心");
  }

  function openInvoice(order: CustomerOrder) {
    if (invoiceOrderNo === order.orderNo) {
      setInvoiceOrderNo(null);
      return;
    }
    setInvoiceOrderNo(order.orderNo);
    setInvoiceTitle("");
    setInvoiceTaxNo("");
    setInvoiceError("");
  }

  async function submitInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (!invoiceOrderNo) return;
    setInvoiceError("");
    setInvoiceSubmitting(true);
    try {
      const response = await fetch("/api/user/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNo: invoiceOrderNo, title: invoiceTitle, taxNo: invoiceTaxNo }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "提交开票申请失败");
      setInvoiceOrderNo(null);
      setMessage("开票申请已提交，我们会按订单邮箱联系您");
      await loadDashboard();
    } catch (reason) {
      setInvoiceError(reason instanceof Error ? reason.message : "提交开票申请失败");
    } finally {
      setInvoiceSubmitting(false);
    }
  }

  return (
    <div className="site-shell account-shell-page">
      <SiteHeader active="account" />
      <main className="account-page">
        {loading ? <div className="account-loading">正在加载用户中心…</div> : dashboard ? (
          <DashboardView dashboard={dashboard} onLogout={logout} onInvoice={openInvoice} invoiceOrderNo={invoiceOrderNo} invoiceTitle={invoiceTitle} invoiceTaxNo={invoiceTaxNo} setInvoiceTitle={setInvoiceTitle} setInvoiceTaxNo={setInvoiceTaxNo} onSubmitInvoice={submitInvoice} invoiceSubmitting={invoiceSubmitting} invoiceError={invoiceError} />
        ) : (
          <LoginView email={email} code={code} cooldown={cooldown} sendingCode={sendingCode} verifying={verifying} message={message} error={error} setEmail={setEmail} setCode={setCode} onRequestCode={requestCode} onVerifyCode={verifyCode} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function LoginView(props: {
  email: string; code: string; cooldown: number; sendingCode: boolean; verifying: boolean; message: string; error: string;
  setEmail: (value: string) => void; setCode: (value: string) => void;
  onRequestCode: (event: React.FormEvent) => void; onVerifyCode: (event: React.FormEvent) => void;
}) {
  return (
    <section className="account-login" aria-labelledby="account-title">
      <div className="account-login-copy">
        <span className="section-index">CUSTOMER ACCOUNT</span>
        <h1 id="account-title">订单、消费与开票，都在这里。</h1>
        <p>使用下单邮箱接收验证码，登录后查看全部订单和累计消费。</p>
        <div className="account-trust"><ShieldCheck size={17} /> 不需要密码，验证码 10 分钟内有效</div>
      </div>
      <form className="account-login-card" onSubmit={props.onVerifyCode}>
        <div className="account-card-icon"><UserRound size={21} /></div>
        <h2>邮箱登录</h2>
        <p>验证码会发送到你的下单邮箱。</p>
        <label className="account-field"><span>邮箱地址</span><input type="email" value={props.email} onChange={(event) => props.setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></label>
        <div className="account-code-field"><label className="account-field"><span>邮箱验证码</span><input inputMode="numeric" maxLength={6} value={props.code} onChange={(event) => props.setCode(event.target.value.replace(/\D/g, ""))} placeholder="6 位验证码" autoComplete="one-time-code" required /></label><button type="button" className="account-code-button" disabled={props.sendingCode || props.cooldown > 0 || !props.email} onClick={props.onRequestCode}>{props.cooldown > 0 ? `${props.cooldown}s 后重发` : props.sendingCode ? "发送中…" : "获取验证码"}</button></div>
        {props.error && <p className="form-error" role="alert">{props.error}</p>}
        {props.message && <p className="account-message" role="status">{props.message}</p>}
        <button className="primary-button account-submit" type="submit" disabled={props.verifying || props.code.length !== 6}><Mail size={17} /> {props.verifying ? "登录中…" : "登录用户中心"}</button>
      </form>
    </section>
  );
}

function DashboardView(props: {
  dashboard: Dashboard; onLogout: () => void; onInvoice: (order: CustomerOrder) => void; invoiceOrderNo: string | null; invoiceTitle: string; invoiceTaxNo: string;
  setInvoiceTitle: (value: string) => void; setInvoiceTaxNo: (value: string) => void; onSubmitInvoice: (event: React.FormEvent) => void; invoiceSubmitting: boolean; invoiceError: string;
}) {
  return (
    <>
      <header className="account-heading"><div><span className="section-index">CUSTOMER ACCOUNT</span><h1>欢迎回来。</h1><p><Mail size={14} /> {props.dashboard.email}</p></div><button type="button" className="account-logout" onClick={props.onLogout}><LogOut size={15} />退出登录</button></header>
      <section className="account-metrics" aria-label="消费概览">
        <Metric icon={<WalletCards />} label="累计消费" value={money(props.dashboard.totals.totalSpendCents)} />
        <Metric icon={<ReceiptText />} label="订单总数" value={`${props.dashboard.totals.orderCount} 笔`} />
        <Metric icon={<ShieldCheck />} label="已交付" value={`${props.dashboard.totals.deliveredCount} 笔`} />
        <Metric icon={<FileText />} label="开票申请" value={`${props.dashboard.totals.invoiceCount} 笔`} />
      </section>
      <section className="account-panel" aria-labelledby="account-orders-title">
        <div className="account-panel-heading"><div><span className="section-index">ORDER HISTORY</span><h2 id="account-orders-title">订单历史</h2></div><Link href="/orders" className="account-panel-link">查询订单 <span aria-hidden="true">↗</span></Link></div>
        {props.dashboard.orders.length ? <div className="account-orders">{props.dashboard.orders.map((order) => <OrderRow key={order.orderNo} order={order} {...props} />)}</div> : <div className="account-empty"><ReceiptText size={22} /><p>还没有订单，去挑选一件数字商品吧。</p><Link className="primary-button" href="/">浏览商品</Link></div>}
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="account-metric"><span className="account-metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong></div>;
}

function OrderRow(props: DashboardViewProps & { order: CustomerOrder }) {
  const { order } = props;
  const canInvoice = ["paid", "delivered", "paid_no_stock"].includes(order.status);
  const invoiceLabel = order.invoiceStatus === "pending" ? "开票处理中" : order.invoiceStatus === "issued" ? "发票已开具" : order.invoiceStatus === "rejected" ? "开票被驳回" : "申请开票";
  return <article className="account-order-row"><div className="account-order-icon"><ReceiptText size={18} /></div><div className="account-order-main"><strong>{order.productName}</strong><span>{order.variantLabel} · {order.orderNo}</span></div><div className="account-order-date"><Clock3 size={13} />{dateLabel(order.createdAt)}</div><div className="account-order-amount"><strong>{money(order.amountCents)}</strong><span className={`account-status account-status-${order.status}`}>{statusLabels[order.status]}</span></div><div className="account-order-actions">{canInvoice && !order.invoiceId ? <button type="button" className="account-invoice-button" onClick={() => props.onInvoice(order)}><FileText size={14} />{invoiceLabel}</button> : order.invoiceId ? <span className={`account-invoice-status account-invoice-${order.invoiceStatus}`}>{invoiceLabel}</span> : <span className="account-muted">付款后可开票</span>}</div>{props.invoiceOrderNo === order.orderNo && <form className="account-invoice-form" onSubmit={props.onSubmitInvoice}><div><strong>申请电子普通发票</strong><span>发票将按订单邮箱联系处理</span></div><label className="account-field"><span>发票抬头</span><input value={props.invoiceTitle} onChange={(event) => props.setInvoiceTitle(event.target.value)} placeholder="个人姓名或公司名称" required maxLength={120} /></label><label className="account-field"><span>税号（选填）</span><input value={props.invoiceTaxNo} onChange={(event) => props.setInvoiceTaxNo(event.target.value)} placeholder="公司税号" maxLength={40} /></label>{props.invoiceError && <p className="form-error" role="alert">{props.invoiceError}</p>}<div className="account-invoice-actions"><button type="button" className="secondary-button" onClick={() => props.onInvoice(order)}>取消</button><button type="submit" className="primary-button" disabled={props.invoiceSubmitting}>{props.invoiceSubmitting ? "提交中…" : "提交申请"}</button></div></form>}</article>;
}

type DashboardViewProps = {
  onInvoice: (order: CustomerOrder) => void; invoiceOrderNo: string | null; invoiceTitle: string; invoiceTaxNo: string;
  setInvoiceTitle: (value: string) => void; setInvoiceTaxNo: (value: string) => void; onSubmitInvoice: (event: React.FormEvent) => void; invoiceSubmitting: boolean; invoiceError: string;
};
