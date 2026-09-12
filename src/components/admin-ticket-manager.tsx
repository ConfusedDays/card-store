"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageSquareText, RefreshCw, Save, Search } from "lucide-react";
import { AnimatedButtonIcon } from "@/components/ui/animated-state-icons";
import { DropdownSelect } from "@/components/ui/dropdown-menu";

type TicketStatus = "open" | "processing" | "resolved" | "closed";
type AdminTicket = {
  id: number;
  ticketNo: string;
  email: string;
  orderNo: string | null;
  subject: string;
  message: string;
  status: TicketStatus;
  adminNote: string | null;
  createdAt: number;
  updatedAt: number;
  productName: string | null;
  variantLabel: string | null;
  amountCents: number | null;
  orderStatus: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  orderCreatedAt: string | null;
  orderDeletedAt: string | null;
  hasDelivery: boolean;
};

const statusLabels: Record<TicketStatus, string> = { open: "待处理", processing: "处理中", resolved: "已解决", closed: "已关闭" };
const orderStatusLabels: Record<string, string> = { pending: "待支付", paid: "已支付", delivered: "已发货", paid_no_stock: "等待补货", cancelled: "已取消" };
const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);
const dateLabel = (value: number | string | null) => {
  if (value === null) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export function AdminTicketManager({ token }: { token: string }) {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [selectedTicketNo, setSelectedTicketNo] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<TicketStatus>("open");
  const [noteDraft, setNoteDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const response = await fetch(`/api/admin/tickets${query}`, { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "加载工单失败");
      setTickets(data.tickets);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载工单失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTickets(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets]);

  function selectTicket(ticket: AdminTicket) {
    setSelectedTicketNo((current) => current === ticket.ticketNo ? null : ticket.ticketNo);
    setStatusDraft(ticket.status);
    setNoteDraft(ticket.adminNote ?? "");
    setNotice("");
  }

  async function saveTicket() {
    if (!selectedTicketNo) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/tickets", { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ ticketNo: selectedTicketNo, status: statusDraft, adminNote: noteDraft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "更新工单失败");
      setNotice(`工单 ${data.ticketNo} 已更新为“${statusLabels[data.status as TicketStatus]}”`);
      await loadTickets();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新工单失败");
    } finally {
      setSaving(false);
    }
  }

  return <section className="admin-section admin-ticket-section" id="tickets">
    <div className="section-heading"><div><span className="section-index">SUPPORT</span><h2>工单处理</h2></div><div className="admin-ticket-toolbar"><label className="admin-ticket-filter"><Search size={14} /><DropdownSelect className="admin-ticket-filter-select" value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | TicketStatus)} ariaLabel="筛选工单状态" options={[{ value: "all", label: "全部状态" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /></label><button className="icon-action" type="button" onClick={() => void loadTickets()} aria-label="刷新工单" title="刷新工单" disabled={loading}><AnimatedButtonIcon loading={loading} idle={<RefreshCw size={17} />} /></button></div></div>
    {notice && <p className="success-message admin-ticket-notice" role="status"><CheckCircle2 size={16} />{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="table-shell admin-tickets-table"><table><thead><tr><th>工单号</th><th>客户</th><th>问题</th><th>关联订单 / 订单详情</th><th>工单状态</th><th>提交时间</th><th>操作</th></tr></thead><tbody>{tickets.length ? tickets.map((ticket) => <tr key={ticket.ticketNo} className={selectedTicketNo === ticket.ticketNo ? "is-selected" : ""}><td><code>{ticket.ticketNo}</code></td><td><span className="admin-ticket-email">{ticket.email}</span></td><td><strong>{ticket.subject}</strong><p className="admin-ticket-message-preview">{ticket.message}</p></td><td>{ticket.orderNo ? <div className="admin-ticket-order"><strong>{ticket.productName ?? "商品已删除"}</strong><span>{ticket.variantLabel ?? "—"} · {money(ticket.amountCents ?? 0)}</span><details><summary>查看订单详情</summary><dl><div><dt>订单号</dt><dd><code>{ticket.orderNo}</code></dd></div><div><dt>订单状态</dt><dd>{orderStatusLabels[ticket.orderStatus ?? ""] ?? ticket.orderStatus ?? "—"}</dd></div><div><dt>支付方式</dt><dd>{ticket.paymentMethod ?? "—"}</dd></div><div><dt>支付流水</dt><dd><code>{ticket.paymentRef ?? "—"}</code></dd></div><div><dt>付款时间</dt><dd>{dateLabel(ticket.paidAt)}</dd></div><div><dt>发卡状态</dt><dd>{ticket.hasDelivery ? "已发卡" : "未发卡"}</dd></div>{ticket.orderDeletedAt && <div><dt>订单回收</dt><dd>{dateLabel(ticket.orderDeletedAt)}</dd></div>}</dl></details></div> : <span className="account-muted">未关联订单</span>}</td><td><span className={`account-ticket-status account-ticket-${ticket.status}`}>{statusLabels[ticket.status]}</span></td><td>{dateLabel(ticket.createdAt)}</td><td><button type="button" className="secondary-command admin-ticket-edit-button" onClick={() => selectTicket(ticket)}><MessageSquareText size={14} />{selectedTicketNo === ticket.ticketNo ? "收起" : "处理"}</button>{selectedTicketNo === ticket.ticketNo && <div className="admin-ticket-editor"><label>更新状态<DropdownSelect className="admin-ticket-status-select" value={statusDraft} onValueChange={(value) => setStatusDraft(value as TicketStatus)} ariaLabel="更新工单状态" options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} /></label><label>处理备注<textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} maxLength={3000} placeholder="填写给用户看的处理结果或备注" /></label><button type="button" className="primary-button" onClick={() => void saveTicket()} disabled={saving}><AnimatedButtonIcon loading={saving} idle={<Save size={14} />} />{saving ? "保存中…" : "保存处理结果"}</button></div>}</td></tr>) : <tr><td colSpan={7} className="empty-cell">{loading ? "正在加载工单…" : "暂无工单"}</td></tr>}</tbody></table></div>
  </section>;
}
