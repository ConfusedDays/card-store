type InvoiceNotification = { email: string; orderNo: string; title: string; taxNo?: string | null };

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

export async function sendInvoiceRequestNotification(input: InvoiceNotification) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  if (!apiKey || !from || !supportEmail) return { status: "disabled" as const };
  const taxNo = input.taxNo || "未填写";
  const text = `收到新的开票申请\n\n订单号：${input.orderNo}\n客户邮箱：${input.email}\n发票抬头：${input.title}\n税号：${taxNo}`;
  const html = `<!doctype html><html lang="zh-CN"><body style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#17201e"><h1 style="font-size:20px">新的开票申请</h1><p><strong>订单号：</strong>${escapeHtml(input.orderNo)}<br><strong>客户邮箱：</strong>${escapeHtml(input.email)}<br><strong>发票抬头：</strong>${escapeHtml(input.title)}<br><strong>税号：</strong>${escapeHtml(taxNo)}</p></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [supportEmail], reply_to: input.email, subject: `[开票申请] ${input.orderNo}`, html, text }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || `开票通知发送失败（${response.status}）`);
  return { status: "sent" as const };
}
