export type ContactMessage = { name: string; email: string; orderNo?: string; message: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

export async function sendContactNotification(input: ContactMessage) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  if (!apiKey || !from || !supportEmail) return { status: "disabled" as const };
  const order = input.orderNo ? `订单号：${input.orderNo}\n` : "";
  const text = `收到一条新的售后咨询\n\n姓名：${input.name}\n邮箱：${input.email}\n${order}\n问题：\n${input.message}`;
  const html = `<!doctype html><html lang="zh-CN"><body style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#17201e"><h1 style="font-size:20px">新的售后咨询</h1><p><strong>姓名：</strong>${escapeHtml(input.name)}<br><strong>邮箱：</strong>${escapeHtml(input.email)}${input.orderNo ? `<br><strong>订单号：</strong>${escapeHtml(input.orderNo)}` : ""}</p><p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(input.message)}</p></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [supportEmail], reply_to: input.email, subject: `${input.orderNo ? `[${input.orderNo}] ` : ""}新的售后咨询 - ${input.name}`, html, text }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || `Resend HTTP ${response.status}`);
  return { status: "sent" as const };
}
