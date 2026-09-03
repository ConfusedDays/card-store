"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: values.get("name"), email: values.get("email"), orderNo: values.get("orderNo") || undefined, message: values.get("message") }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "提交失败，请稍后重试");
      form.reset();
      setFeedback("已发送给客服。请留意你的邮箱回复。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "提交失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <form className="contact-form" onSubmit={submit}>
    <div className="contact-form-grid">
      <label><span>称呼</span><input name="name" required maxLength={80} autoComplete="name" placeholder="如何称呼你" /></label>
      <label><span>联系邮箱</span><input name="email" required type="email" autoComplete="email" placeholder="name@example.com" /></label>
    </div>
    <label><span>订单号（选填）</span><input name="orderNo" maxLength={80} placeholder="例如 KXXXXXX" /></label>
    <label><span>问题说明</span><textarea name="message" required minLength={10} maxLength={3000} rows={5} placeholder="请说明订单情况、遇到的问题以及需要的协助；请勿填写完整卡密。" /></label>
    <div className="contact-form-footer"><p role="status" aria-live="polite">{feedback}</p><button className="policy-action" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}{pending ? "发送中" : "发送给客服"}</button></div>
  </form>;
}
