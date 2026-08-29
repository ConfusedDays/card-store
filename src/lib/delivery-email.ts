import { db } from "@/lib/db";
import { decryptLicenseKey } from "@/lib/crypto";

type DeliveryEmail = {
  orderNo: string;
  email: string;
  amountCents: number;
  currency: string;
  productName: string;
  variantLabel: string;
  keyCiphertext: string;
};

export type DeliveryEmailResult =
  | { status: "disabled" | "busy" | "sent" }
  | { status: "failed"; error: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);
}

function money(amountCents: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(amountCents / 100);
}

function getDeliveryEmail(orderNo: string) {
  return db.prepare(`
    SELECT o.order_no AS orderNo, o.email, o.amount_cents AS amountCents, o.currency,
      p.name AS productName, v.label AS variantLabel, d.key_ciphertext AS keyCiphertext
    FROM orders o
    JOIN variants v ON v.id = o.variant_id
    JOIN products p ON p.id = v.product_id
    JOIN deliveries d ON d.order_no = o.order_no
    WHERE o.order_no = ? AND o.status = 'delivered'
  `).get(orderNo) as DeliveryEmail | undefined;
}

export async function trySendDeliveryEmail(
  orderNo: string,
  options: { force?: boolean } = {},
): Promise<DeliveryEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) return { status: "disabled" };

  const delivery = getDeliveryEmail(orderNo);
  if (!delivery) return { status: "busy" };

  db.prepare("INSERT OR IGNORE INTO delivery_emails (order_no) VALUES (?)").run(orderNo);
  const claimed = db.prepare(`
    UPDATE delivery_emails
    SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE order_no = ? AND (
      status IN ('pending', 'failed')
      OR (status = 'sending' AND updated_at <= datetime('now', '-10 minutes'))
      OR (? = 1 AND status = 'sent')
    )
  `).run(orderNo, options.force ? 1 : 0);
  if (claimed.changes !== 1) {
    const current = db.prepare("SELECT status FROM delivery_emails WHERE order_no = ?").get(orderNo) as { status: string };
    return { status: current.status === "sent" ? "sent" : "busy" };
  }

  const emailAttempt = db.prepare("SELECT attempts FROM delivery_emails WHERE order_no = ?")
    .get(orderNo) as { attempts: number };

  const licenseKey = decryptLicenseKey(delivery.keyCiphertext);
  const safeOrderNo = escapeHtml(delivery.orderNo);
  const safeProduct = escapeHtml(delivery.productName);
  const safeVariant = escapeHtml(delivery.variantLabel);
  const safeKey = escapeHtml(licenseKey);
  const total = money(delivery.amountCents, delivery.currency);
  const subject = `您的卡密已送达 - ${delivery.orderNo}`;
  const text = [
    "支付成功，您的卡密已自动发放。",
    `订单号：${delivery.orderNo}`,
    `商品：${delivery.productName} / ${delivery.variantLabel}`,
    `金额：${total}`,
    `卡密：${licenseKey}`,
    "请妥善保管卡密。如需再次查看，可前往 reiishop.cn 使用订单号和下单邮箱查询。",
  ].join("\n");
  const html = `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#0b0d12;color:#e9eef8;font-family:Arial,'Microsoft YaHei',sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="background:#141823;border:1px solid #273044;border-radius:16px;padding:28px"><div style="color:#62d8ff;font-size:13px;letter-spacing:.12em">REII SHOP</div><h1 style="font-size:24px;margin:12px 0 8px">支付成功，卡密已送达</h1><p style="color:#9ca9bd;margin:0 0 24px">订单号：${safeOrderNo}</p><div style="background:#0b0d12;border:1px solid #2c3850;border-radius:12px;padding:18px;margin-bottom:18px"><div style="color:#8996aa;font-size:13px;margin-bottom:8px">您的卡密</div><div style="font-family:Consolas,monospace;font-size:18px;line-height:1.6;word-break:break-all;color:#ffffff">${safeKey}</div></div><table style="width:100%;color:#c9d2df;font-size:14px;border-collapse:collapse"><tr><td style="padding:6px 0;color:#8996aa">商品</td><td style="text-align:right">${safeProduct}</td></tr><tr><td style="padding:6px 0;color:#8996aa">规格</td><td style="text-align:right">${safeVariant}</td></tr><tr><td style="padding:6px 0;color:#8996aa">金额</td><td style="text-align:right">${escapeHtml(total)}</td></tr></table><p style="color:#8996aa;font-size:13px;line-height:1.7;margin:22px 0 0">请妥善保管卡密。如需再次查看，可前往 reiishop.cn 使用订单号和下单邮箱查询。</p></div></div></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": options.force
          ? `delivery_resend_${orderNo}_${emailAttempt.attempts}`
          : `delivery_${orderNo}`,
      },
      body: JSON.stringify({ from, to: [delivery.email], subject, html, text }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !payload.id) throw new Error(payload.message || `Resend HTTP ${response.status}`);
    db.prepare(`
      UPDATE delivery_emails SET status = 'sent', message_id = ?, sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP, last_error = NULL WHERE order_no = ?
    `).run(payload.id, orderNo);
    db.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?)")
      .run(options.force ? "delivery.email_resent" : "delivery.email_sent", "order", orderNo, JSON.stringify({ messageId: payload.id }));
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown email error";
    db.prepare(`
      UPDATE delivery_emails SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_no = ?
    `).run(message, orderNo);
    console.error("Delivery email failed", { orderNo, error: message });
    return { status: "failed", error: message };
  }
}
