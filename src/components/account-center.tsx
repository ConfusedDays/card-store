"use client";

import { useEffect, useState } from "react";
import { Clock3, LogOut, Mail, MessageSquareText, ReceiptText, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DropdownSelect } from "@/components/ui/dropdown-menu";

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
};

type CustomerTicket = {
  id: number;
  ticketNo: string;
  orderNo: string | null;
  subject: string;
  message: string;
  status: "open" | "processing" | "resolved" | "closed";
  adminNote: string | null;
  createdAt: number;
  updatedAt: number;
  productName: string | null;
  variantLabel: string | null;
  amountCents: number | null;
  orderStatus: string | null;
};

type Dashboard = {
  email: string;
  totals: { totalSpendCents: number; orderCount: number; deliveredCount: number; ticketCount: number };
  orders: CustomerOrder[];
  tickets: CustomerTicket[];
};

const statusLabels: Record<CustomerOrder["status"], string> = {
  pending: "待支付",
  paid: "已支付",
  delivered: "已发货",
  paid_no_stock: "等待补货",
  cancelled: "已取消",
};

const ticketStatusLabels: Record<CustomerTicket["status"], string> = {
  open: "待处理",
  processing: "处理中",
  resolved: "已解决",
  closed: "已关闭",
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
  const [ticketOrderNo, setTicketOrderNo] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState("");

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

  function openTicket(orderNo = "") {
    setTicketOrderNo(orderNo);
    setTicketSubject("");
    setTicketMessage("");
    setTicketError("");
    window.setTimeout(() => document.getElementById("account-tickets")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  async function submitTicket(event: React.FormEvent) {
    event.preventDefault();
    setTicketError("");
    setTicketSubmitting(true);
    try {
      const response = await fetch("/api/user/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNo: ticketOrderNo || undefined, subject: ticketSubject, message: ticketMessage }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "提交工单失败");
      setTicketSubject("");
      setTicketMessage("");
      setMessage(`工单 ${data.ticketNo} 已提交，我们会尽快处理`);
      await loadDashboard();
    } catch (reason) {
      setTicketError(reason instanceof Error ? reason.message : "提交工单失败");
    } finally {
      setTicketSubmitting(false);
    }
  }

  return (
    <div className="site-shell account-shell-page">
      <SiteHeader active="account" />
      <main className="account-page">
        {loading ? <div className="account-loading">正在加载用户中心…</div> : dashboard ? (
          <DashboardView dashboard={dashboard} onLogout={logout} onOpenTicket={openTicket} ticketOrderNo={ticketOrderNo} ticketSubject={ticketSubject} ticketMessage={ticketMessage} setTicketOrderNo={setTicketOrderNo} setTicketSubject={setTicketSubject} setTicketMessage={setTicketMessage} onSubmitTicket={submitTicket} ticketSubmitting={ticketSubmitting} ticketError={ticketError} />
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
        <h1 id="account-title">订单、消费与工单，都在这里。</h1>
        <p>使用下单邮箱接收验证码，登录后查看全部订单、消费记录和售后进度。</p>
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
  dashboard: Dashboard; onLogout: () => void; onOpenTicket: (orderNo?: string) => void; ticketOrderNo: string; ticketSubject: string; ticketMessage: string;
  setTicketOrderNo: (value: string) => void; setTicketSubject: (value: string) => void; setTicketMessage: (value: string) => void;
  onSubmitTicket: (event: React.FormEvent) => void; ticketSubmitting: boolean; ticketError: string;
}) {
  return (
    <>
      <header className="account-heading"><div><span className="section-index">CUSTOMER ACCOUNT</span><h1>欢迎回来。</h1><p><Mail size={14} /> {props.dashboard.email}</p></div><button type="button" className="account-logout" onClick={props.onLogout}><LogOut size={15} />退出登录</button></header>
      <section className="account-metrics" aria-label="消费概览">
        <Metric icon={<WalletCards />} label="累计消费" value={money(props.dashboard.totals.totalSpendCents)} />
        <Metric icon={<ReceiptText />} label="订单总数" value={`${props.dashboard.totals.orderCount} 笔`} />
        <Metric icon={<ShieldCheck />} label="已交付" value={`${props.dashboard.totals.deliveredCount} 笔`} />
        <Metric icon={<MessageSquareText />} label="我的工单" value={`${props.dashboard.totals.ticketCount} 笔`} />
      </section>
      <section className="account-panel" aria-labelledby="account-orders-title">
        <div className="account-panel-heading"><div><span className="section-index">ORDER HISTORY</span><h2 id="account-orders-title">订单历史</h2></div><Link href="/orders" className="account-panel-link">查询订单 <span aria-hidden="true">↗</span></Link></div>
        {props.dashboard.orders.length ? <div className="account-orders">{props.dashboard.orders.map((order) => <OrderRow key={order.orderNo} order={order} onOpenTicket={props.onOpenTicket} />)}</div> : <div className="account-empty"><ReceiptText size={22} /><p>还没有订单，去挑选一件数字商品吧。</p><Link className="primary-button" href="/">浏览商品</Link></div>}
      </section>
      <section className="account-panel account-tickets-panel" id="account-tickets" aria-labelledby="account-tickets-title">
        <div className="account-panel-heading"><div><span className="section-index">SUPPORT TICKETS</span><h2 id="account-tickets-title">售后工单</h2></div><span className="account-panel-hint">提交后可在这里查看处理状态</span></div>
        <form className="account-ticket-form" onSubmit={props.onSubmitTicket}>
          <label className="account-field"><span>关联订单</span><DropdownSelect className="account-ticket-order-select" value={props.ticketOrderNo} onValueChange={props.setTicketOrderNo} ariaLabel="选择要关联的订单" options={[{ value: "", label: "不关联订单" }, ...props.dashboard.orders.map((order) => ({ value: order.orderNo, label: `${order.orderNo} · ${order.productName} · ${money(order.amountCents)}` }))]} /></label>
          <label className="account-field"><span>工单主题</span><input value={props.ticketSubject} onChange={(event) => props.setTicketSubject(event.target.value)} placeholder="例如：支付后没有收到卡密" maxLength={80} required /></label>
          <label className="account-field account-ticket-message"><span>问题描述</span><textarea value={props.ticketMessage} onChange={(event) => props.setTicketMessage(event.target.value)} placeholder="请描述订单号、遇到的问题和希望的处理方式" maxLength={3000} rows={4} required /></label>
          {props.ticketError && <p className="form-error" role="alert">{props.ticketError}</p>}
          <button type="submit" className="primary-button account-ticket-submit" disabled={props.ticketSubmitting}><MessageSquareText size={16} />{props.ticketSubmitting ? "提交中…" : "提交工单"}</button>
        </form>
        {props.dashboard.tickets.length ? <div className="account-ticket-list">{props.dashboard.tickets.map((ticket) => <article className="account-ticket-row" key={ticket.ticketNo}><div className="account-ticket-heading"><strong>{ticket.subject}</strong><span className={`account-ticket-status account-ticket-${ticket.status}`}>{ticketStatusLabels[ticket.status]}</span></div><div className="account-ticket-meta"><code>{ticket.ticketNo}</code><span>{ticket.orderNo ? `订单 ${ticket.orderNo}` : "未关联订单"}</span><time dateTime={new Date(ticket.createdAt).toISOString()}>{dateLabel(new Date(ticket.createdAt).toISOString())}</time></div><p>{ticket.message}</p>{ticket.adminNote && <div className="account-ticket-note"><strong>客服回复</strong><span>{ticket.adminNote}</span></div>}</article>)}</div> : <div className="account-empty account-ticket-empty"><MessageSquareText size={22} /><p>还没有工单，需要帮助时可以从这里提交。</p></div>}
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="account-metric"><span className="account-metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong></div>;
}

function OrderRow({ order, onOpenTicket }: { order: CustomerOrder; onOpenTicket: (orderNo?: string) => void }) {
  return <article className="account-order-row"><div className="account-order-icon"><ReceiptText size={18} /></div><div className="account-order-main"><strong>{order.productName}</strong><span>{order.variantLabel} · {order.orderNo}</span></div><div className="account-order-date"><Clock3 size={13} />{dateLabel(order.createdAt)}</div><div className="account-order-amount"><strong>{money(order.amountCents)}</strong><span className={`account-status account-status-${order.status}`}>{statusLabels[order.status]}</span></div><div className="account-order-actions"><button type="button" className="account-invoice-button" onClick={() => onOpenTicket(order.orderNo)}><MessageSquareText size={14} />提交工单</button></div></article>;
}
