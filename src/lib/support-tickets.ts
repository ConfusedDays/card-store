import { db } from "@/lib/db";

export const supportTicketStatuses = ["open", "processing", "resolved", "closed"] as const;
export type SupportTicketStatus = (typeof supportTicketStatuses)[number];

export type CustomerTicket = {
  id: number;
  ticketNo: string;
  orderNo: string | null;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminNote: string | null;
  createdAt: number;
  updatedAt: number;
  productName: string | null;
  variantLabel: string | null;
  amountCents: number | null;
  orderStatus: string | null;
};

export type AdminTicket = CustomerTicket & {
  email: string;
  paymentMethod: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  orderCreatedAt: string | null;
  orderDeletedAt: string | null;
  hasDelivery: boolean;
};

function ticketNumber() {
  return `T${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function createSupportTicket(input: { email: string; orderNo?: string; subject: string; message: string }) {
  const email = input.email.trim().toLowerCase();
  const orderNo = input.orderNo?.trim() || null;
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (orderNo) {
    const order = db.prepare("SELECT order_no FROM orders WHERE order_no = ? AND lower(email) = lower(?) AND deleted_at IS NULL")
      .get(orderNo, email) as { order_no: string } | undefined;
    if (!order) throw new Error("未找到属于当前账号的订单");
  }
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO support_tickets (ticket_no, email, order_no, subject, message, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
  `).run(ticketNumber(), email, orderNo, subject, message, now, now);
  const ticket = db.prepare("SELECT ticket_no AS ticketNo, status FROM support_tickets WHERE id = ?")
    .get(result.lastInsertRowid) as { ticketNo: string; status: SupportTicketStatus };
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("support_ticket.created", "support_ticket", ticket.ticketNo, JSON.stringify({ email, orderNo, subject }));
  return { id: Number(result.lastInsertRowid), ticketNo: ticket.ticketNo, status: ticket.status };
}

export function getCustomerTickets(emailInput: string): CustomerTicket[] {
  const email = emailInput.trim().toLowerCase();
  return db.prepare(`
    SELECT t.id, t.ticket_no AS ticketNo, t.order_no AS orderNo, t.subject, t.message,
      t.status, t.admin_note AS adminNote, t.created_at AS createdAt, t.updated_at AS updatedAt,
      p.name AS productName, v.label AS variantLabel, o.amount_cents AS amountCents, o.status AS orderStatus
    FROM support_tickets t
    LEFT JOIN orders o ON o.order_no = t.order_no
    LEFT JOIN variants v ON v.id = o.variant_id
    LEFT JOIN products p ON p.id = v.product_id
    WHERE lower(t.email) = lower(?)
    ORDER BY t.updated_at DESC, t.id DESC
    LIMIT 100
  `).all(email) as CustomerTicket[];
}

const adminTicketSelect = `
  SELECT t.id, t.ticket_no AS ticketNo, t.order_no AS orderNo, t.email, t.subject, t.message,
    t.status, t.admin_note AS adminNote, t.created_at AS createdAt, t.updated_at AS updatedAt,
    p.name AS productName, v.label AS variantLabel, o.amount_cents AS amountCents,
    o.status AS orderStatus, o.payment_method AS paymentMethod, o.payment_ref AS paymentRef,
    o.paid_at AS paidAt, o.created_at AS orderCreatedAt, o.deleted_at AS orderDeletedAt,
    CASE WHEN d.order_no IS NULL THEN 0 ELSE 1 END AS hasDelivery
  FROM support_tickets t
  LEFT JOIN orders o ON o.order_no = t.order_no
  LEFT JOIN variants v ON v.id = o.variant_id
  LEFT JOIN products p ON p.id = v.product_id
  LEFT JOIN deliveries d ON d.order_no = t.order_no
`;

export function getAdminTickets(status?: string): AdminTicket[] {
  const validStatus = supportTicketStatuses.includes(status as SupportTicketStatus) ? status : undefined;
  const rows = db.prepare(`${adminTicketSelect} ${validStatus ? "WHERE t.status = ?" : ""} ORDER BY t.updated_at DESC, t.id DESC LIMIT 200`)
    .all(...(validStatus ? [validStatus] : [])) as (Omit<AdminTicket, "hasDelivery"> & { hasDelivery: number })[];
  return rows.map((row) => ({ ...row, hasDelivery: Boolean(row.hasDelivery) }));
}

export function updateSupportTicket(input: { ticketNo: string; status: SupportTicketStatus; adminNote?: string }) {
  const adminNote = input.adminNote?.trim() || null;
  const now = Date.now();
  const result = db.prepare(`
    UPDATE support_tickets
    SET status = ?, admin_note = ?, updated_at = ?, resolved_at = ?
    WHERE ticket_no = ?
  `).run(input.status, adminNote, now, ["resolved", "closed"].includes(input.status) ? now : null, input.ticketNo.trim());
  if (!result.changes) throw new Error("工单不存在");
  db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
    .run("support_ticket.updated", "support_ticket", input.ticketNo.trim(), JSON.stringify({ status: input.status }));
  return { ticketNo: input.ticketNo.trim(), status: input.status };
}
