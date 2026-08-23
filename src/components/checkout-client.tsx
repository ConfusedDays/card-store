"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, KeyRound, LoaderCircle, QrCode, ShieldCheck } from "lucide-react";
import type { OrderResult } from "@/lib/types";
import { statusText } from "@/components/storefront";
import { ThemeToggle } from "@/components/theme-toggle";

type CheckoutOrder = {
  orderNo: string; amountCents: number; currency: "CNY"; paymentMethod: string;
  status: OrderResult["status"]; variantLabel: string; productName: string; maskedEmail: string;
};

const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);

export function CheckoutClient({ order }: { order: CheckoutOrder }) {
  const [result, setResult] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function confirmPayment() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dev/payments/${order.orderNo}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "支付确认失败");
      setResult(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "支付确认失败");
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    if (!result?.licenseKey) return;
    await navigator.clipboard.writeText(result.licenseKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <Link href="/"><ArrowLeft size={18} /> 返回商店</Link>
        <span className="brand"><span className="brand-mark"><KeyRound size={18} /></span>数字授权中心</span>
        <div className="checkout-header-actions">
          <span><ShieldCheck size={17} /> 安全结账</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="checkout-layout">
        <section className="payment-area">
          <span className="section-index">DEVELOPMENT CHECKOUT</span>
          <h1>{result?.status === "delivered" ? "卡密已交付" : "完成支付"}</h1>
          {!result?.licenseKey ? (
            <>
              <div className="qr-frame"><QrCode size={150} strokeWidth={1.25} /><span>开发环境二维码</span></div>
              <p className="payment-hint">正式商户接口开通后，这里将显示{order.paymentMethod === "wechat" ? "微信支付" : "支付宝"}付款码。</p>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button mock-pay" onClick={confirmPayment} disabled={loading || order.status === "delivered"}>
                {loading ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}
                {loading ? "正在确认..." : order.status === "delivered" ? "订单已发货" : "模拟支付成功"}
              </button>
            </>
          ) : (
            <div className="delivery-success">
              <CheckCircle2 size={40} />
              <span>Authorized license delivered</span>
              <code>{result.licenseKey}</code>
              <button onClick={copyKey}><Copy size={17} /> {copied ? "已复制" : "复制卡密"}</button>
              <p>卡密同时可通过订单号和下单邮箱查询。</p>
            </div>
          )}
        </section>
        <aside className="checkout-summary">
          <span className="summary-title">订单摘要</span>
          <div className="summary-product"><div className="mini-license"><KeyRound size={22} /></div><div><strong>{order.productName}</strong><span>{order.variantLabel}</span></div></div>
          <dl>
            <div><dt>订单号</dt><dd>{order.orderNo}</dd></div>
            <div><dt>接收邮箱</dt><dd>{order.maskedEmail}</dd></div>
            <div><dt>订单状态</dt><dd>{result ? statusText(result.status) : statusText(order.status)}</dd></div>
            <div><dt>支付方式</dt><dd>{order.paymentMethod === "wechat" ? "微信支付" : "支付宝"}</dd></div>
          </dl>
          <div className="summary-total"><span>应付</span><strong>{money(order.amountCents)}</strong></div>
        </aside>
      </div>
    </main>
  );
}
