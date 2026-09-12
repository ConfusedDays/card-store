function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendTicketNotification(input: { ticketNo: string; email: string; orderNo?: string; subject: string; message: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  if (!apiKey || !from || !supportEmail) return { status: "disabled" as const };
  const orderLine = input.orderNo ? `关联订单：${input.orderNo}` : "未关联订单";
  const text = `收到新的售后工单\n\n工单号：${input.ticketNo}\n客户邮箱：${input.email}\n${orderLine}\n主题：${input.subject}\n\n${input.message}`;
  const html = `<!doctype html><html lang="zh-CN"><body style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#17201e"><h1 style="font-size:20px">新的售后工单</h1><p><strong>工单号：</strong>${escapeHtml(input.ticketNo)}<br><strong>客户邮箱：</strong>${escapeHtml(input.email)}<br><strong>${escapeHtml(orderLine)}</strong><br><strong>主题：</strong>${escapeHtml(input.subject)}</p><div style="white-space:pre-wrap;border:1px solid #d9e5df;border-radius:10px;padding:14px">${escapeHtml(input.message)}</div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [supportEmail], subject: `售后工单 ${input.ticketNo}：${input.subject}`, html, text }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || `工单通知发送失败（${response.status}）`);
  return { status: "sent" as const };
}
