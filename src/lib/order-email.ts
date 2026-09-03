import { db } from "@/lib/db";
import type { OrderResult, OrderStatus } from "@/lib/types";

type OrderEmailEvent = "order_created" | "payment_succeeded" | "status_paid_no_stock";
type EmailResult = { status: "disabled" | "busy" | "sent" } | { status: "failed"; error: string };

type OrderEmailData = {
  orderNo: string;
  email: string;
  amountCents: number;
  currency: string;
  paymentMethod: string;
  status: OrderStatus;
  productName: string;
  variantLabel: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

function money(amountCents: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(amountCents / 100);
}

function paymentMethodLabel(method: string) {
  return method === "alipay" ? "支付宝" : method === "wechat" ? "微信支付" : method;
}

function getOrderEmailData(orderNo: string) {
  return db.prepare(`
    SELECT o.order_no AS orderNo, o.email, o.amount_cents AS amountCents, o.currency,
      o.payment_method AS paymentMethod, o.status, p.name AS productName, v.label AS variantLabel
    FROM orders o JOIN variants v ON v.id = o.variant_id JOIN products p ON p.id = v.product_id
    WHERE o.order_no = ?
  `).get(orderNo) as OrderEmailData | undefined;
}

function copyFor(event: OrderEmailEvent, order: OrderEmailData) {
  if (event === "order_created") return {
    subject: `订单已创建，请完成支付 - ${order.orderNo}`,
    title: "订单已创建",
    intro: "我们已为您保留订单。请在支付页面完成付款，付款确认后系统会自动发放卡密。",
    status: "等待支付",
  };
  if (event === "payment_succeeded") return {
    subject: `支付成功，正在准备发货 - ${order.orderNo}`,
    title: "支付已确认",
    intro: "我们已确认您的付款，系统正在为订单分配卡密。卡密发放后会单独发送一封邮件，请留意收件箱和垃圾邮件文件夹。",
    status: "支付成功",
  };
  return {
    subject: `订单状态更新：库存待补充 - ${order.orderNo}`,
    title: "订单正在处理",
    intro: "我们已确认您的付款，但当前库存正在补充中。请勿重复下单；客服会按订单记录为您处理补发或退款。",
    status: "待补货",
  };
}

function makeMessage(event: OrderEmailEvent, order: OrderEmailData) {
  const copy = copyFor(event, order);
  const total = money(order.amountCents, order.currency);
  const detailLines = [
    `订单号：${order.orderNo}`,
    `商品：${order.productName} / ${order.variantLabel}`,
    `金额：${total}`,
    `支付方式：${paymentMethodLabel(order.paymentMethod)}`,
    `状态：${copy.status}`,
  ];
  const text = [copy.title, copy.intro, "", ...detailLines, "", "订单查询：https://reiishop.cn/orders"].join("\n");
  const rows = [["订单号", order.orderNo], ["商品", `${order.productName} / ${order.variantLabel}`], ["金额", total], ["支付方式", paymentMethodLabel(order.paymentMethod)], ["状态", copy.status]]
    .map(([label, value]) => `<tr><td style="padding:7px 0;color:#8996aa">${escapeHtml(label)}</td><td style="padding:7px 0;text-align:right;color:#dfe8e5">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#0b0d12;color:#e9eef8;font-family:Arial,'Microsoft YaHei',sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="background:#141823;border:1px solid #273044;border-radius:16px;padding:28px"><div style="color:#62d8ff;font-size:13px;letter-spacing:.12em">REII SHOP</div><h1 style="font-size:24px;margin:12px 0 8px">${escapeHtml(copy.title)}</h1><p style="color:#b6c4d2;line-height:1.75;margin:0 0 22px">${escapeHtml(copy.intro)}</p><div style="background:#0b0d12;border:1px solid #2c3850;border-radius:12px;padding:18px"><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table></div><a href="https://reiishop.cn/orders" style="display:inline-block;margin-top:22px;color:#062720;background:#74d7c4;border-radius:8px;padding:12px 17px;font-weight:700;text-decoration:none">查询订单</a><p style="color:#8996aa;font-size:13px;line-height:1.7;margin:22px 0 0">如需售后，请在订单查询页面确认状态后提交订单号和问题说明。请勿通过公开渠道发送完整卡密。</p></div></div></body></html>`;
  return { subject: copy.subject, text, html };
}

export async function trySendOrderEmail(orderNo: string, event: OrderEmailEvent): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) return { status: "disabled" };
  const order = getOrderEmailData(orderNo);
  if (!order) return { status: "busy" };

  db.prepare("INSERT OR IGNORE INTO order_email_events (order_no, event_type) VALUES (?, ?)").run(orderNo, event);
  const claimed = db.prepare(`UPDATE order_email_events SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE order_no = ? AND event_type = ? AND (status IN ('pending', 'failed') OR (status = 'sending' AND updated_at <= datetime('now', '-10 minutes')))`)
    .run(orderNo, event);
  if (claimed.changes !== 1) return { status: "sent" };

  const message = makeMessage(event, order);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": `${event}_${orderNo}` },
      body: JSON.stringify({ from, to: [order.email], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !payload.id) throw new Error(payload.message || `Resend HTTP ${response.status}`);
    db.prepare("UPDATE order_email_events SET status = 'sent', message_id = ?, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_no = ? AND event_type = ?").run(payload.id, orderNo, event);
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)").run(`email.${event}_sent`, "order", orderNo, JSON.stringify({ messageId: payload.id }));
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown email error";
    db.prepare("UPDATE order_email_events SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE order_no = ? AND event_type = ?").run(message, orderNo, event);
    console.error("Order email failed", { orderNo, event, error: message });
    return { status: "failed", error: message };
  }
}

export async function trySendPaymentEmails(order: OrderResult) {
  await trySendOrderEmail(order.orderNo, "payment_succeeded");
  if (order.status === "paid_no_stock") await trySendOrderEmail(order.orderNo, "status_paid_no_stock");
}
