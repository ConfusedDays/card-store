"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, KeyRound, LoaderCircle, QrCode, ShieldCheck } from "lucide-react";
import type { OrderResult } from "@/lib/types";
import { statusText } from "@/components/storefront";

type CheckoutOrder = {
  orderNo: string; amountCents: number; currency: "CNY"; paymentMethod: string;
  status: OrderResult["status"]; variantLabel: string; productName: string; maskedEmail: string;
};

const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);

export function CheckoutClient({ order, mockMode }: { order: CheckoutOrder; mockMode: boolean }) {
  const [result, setResult] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(!mockMode);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mockMode) return;
    const email = sessionStorage.getItem(`order-email:${order.orderNo}`);
    if (!email) {
      const missingEmailTimer = window.setTimeout(() => {
        setPolling(false);
        setError("当前浏览器没有本订单的验证信息，请使用订单查询查看支付结果。");
      }, 0);
      return () => window.clearTimeout(missingEmailTimer);
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    async function refreshOrder() {
      attempts += 1;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(order.orderNo)}?email=${encodeURIComponent(email ?? "")}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "查询支付结果失败");
        if (cancelled) return;
        setResult(data);
        setError("");
        if (data.status !== "pending" && data.status !== "paid") {
          setPolling(false);
          return;
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "查询支付结果失败");
      }
      if (!cancelled && attempts < 60) timer = window.setTimeout(refreshOrder, 2000);
      else if (!cancelled) {
        setPolling(false);
        setError("支付结果确认超时，请稍后前往订单查询页面查看。");
      }
    }
    void refreshOrder();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [mockMode, order.orderNo]);

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

  const currentStatus = result?.status ?? order.status;
  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <Link href="/"><ArrowLeft size={18} /> 返回商店</Link>
        <span className="brand"><span className="brand-mark"><KeyRound size={18} /></span>数字授权中心</span>
        <div className="checkout-header-actions">
          <span><ShieldCheck size={17} /> 安全结账</span>
        </div>
      </header>
      <div className="checkout-layout">
        <section className="payment-area">
          <span className="section-index">{mockMode ? "DEVELOPMENT CHECKOUT" : "ALIPAY CHECKOUT"}</span>
          <h1>{result?.status === "delivered" ? "卡密已交付" : "确认支付结果"}</h1>
          {!result?.licenseKey ? (
            mockMode ? (
              <>
                <div className="qr-frame"><QrCode size={150} strokeWidth={1.25} /><span>开发环境二维码</span></div>
                <p className="payment-hint">开发环境使用模拟支付，不会产生真实扣款。</p>
                {error && <p className="form-error">{error}</p>}
                <button className="primary-button mock-pay" onClick={confirmPayment} disabled={loading || order.status === "delivered"}>
                  {loading ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}
                  {loading ? "正在确认..." : order.status === "delivered" ? "订单已发货" : "模拟支付成功"}
                </button>
              </>
            ) : (
              <>
                <div className="qr-frame">
                  {polling ? <LoaderCircle className="spin" size={76} strokeWidth={1.4} /> : <ShieldCheck size={76} strokeWidth={1.4} />}
                  <span>{currentStatus === "paid_no_stock" ? "已支付，等待补货" : polling ? "正在确认支付宝支付结果" : statusText(currentStatus)}</span>
                </div>
                <p className="payment-hint">只有支付宝服务器验签通知成功后才会自动发卡，请勿重复付款。</p>
                {error && <p className="form-error">{error}</p>}
                {!polling && !result?.licenseKey && <Link className="primary-button mock-pay" href="/orders">前往订单查询</Link>}
              </>
            )
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
            <div><dt>订单状态</dt><dd>{statusText(currentStatus)}</dd></div>
            <div><dt>支付方式</dt><dd>{order.paymentMethod === "wechat" ? "微信支付" : "支付宝"}</dd></div>
          </dl>
          <div className="summary-total"><span>应付</span><strong>{money(order.amountCents)}</strong></div>
        </aside>
      </div>
    </main>
  );
}
