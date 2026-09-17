"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import type { Product } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TurnstileWidget } from "@/components/turnstile-widget";

const CART_STORAGE_KEY = "reiishop.cart";
const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);

type CartItem = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  durationLabel: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
};

export function CartPage({ products, turnstileSiteKey, wechatEnabled = false, bepusdtEnabled = false }: { products: Product[]; turnstileSiteKey?: string; wechatEnabled?: boolean; bepusdtEnabled?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeVariantId, setActiveVariantId] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wechat" | "alipay" | "bepusdt">(bepusdtEnabled ? "bepusdt" : "alipay");
  const [acceptedDigitalTerms, setAcceptedDigitalTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as unknown : [];
        const known = new Map(products.flatMap((product) => product.variants.map((variant) => [`${product.id}:${variant.id}`, { product, variant }] as const)));
        const restored = Array.isArray(parsed) ? parsed.flatMap((entry): CartItem[] => {
          if (!entry || typeof entry !== "object") return [];
          const value = entry as Partial<CartItem>;
          const match = known.get(`${value.productId}:${value.variantId}`);
          if (!match) return [];
          return [{
            variantId: match.variant.id,
            productId: match.product.id,
            productName: match.product.name,
            variantLabel: match.variant.label,
            durationLabel: match.variant.durationLabel,
            priceCents: match.variant.priceCents,
            imageUrl: match.product.imageUrl,
            quantity: Math.max(1, Math.min(Number(value.quantity) || 1, match.variant.availableCount || 1)),
          }];
        }) : [];
        setItems(restored.reduce<CartItem[]>((result, item) => {
          const current = result.find((entry) => entry.variantId === item.variantId);
          if (current) current.quantity += item.quantity;
          else result.push(item);
          return result;
        }, []));
      } catch {
        setItems([]);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [products]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const selectedItem = useMemo(() => items.find((item) => item.variantId === activeVariantId) ?? items.find((item) => products.some((product) => product.id === item.productId && product.variants.some((variant) => variant.id === item.variantId && variant.availableCount > 0))) ?? items[0], [activeVariantId, items, products]);
  const totalCents = useMemo(() => items.reduce((total, item) => total + item.priceCents * item.quantity, 0), [items]);
  const selectedVariant = selectedItem ? products.find((product) => product.id === selectedItem.productId)?.variants.find((variant) => variant.id === selectedItem.variantId) : undefined;
  const selectedAvailable = Boolean(selectedVariant && selectedVariant.availableCount > 0);

  function updateQuantity(item: CartItem, delta: number) {
    setItems((current) => current.map((entry) => {
      if (entry.variantId !== item.variantId) return entry;
      const live = products.find((product) => product.id === entry.productId)?.variants.find((variant) => variant.id === entry.variantId);
      const maximum = Math.max(1, live?.availableCount ?? entry.quantity);
      return { ...entry, quantity: Math.max(1, Math.min(entry.quantity + delta, maximum)) };
    }));
  }

  function removeItem(variantId: string) {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
    if (activeVariantId === variantId) setActiveVariantId("");
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem || !selectedAvailable) {
      setError("请选择一个有库存的商品规格");
      return;
    }
    if (!acceptedDigitalTerms) {
      setError("请先阅读并确认数字商品交付与退款规则");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: selectedItem.variantId, email, paymentMethod, digitalTermsAccepted: true, turnstileToken: turnstileToken || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "创建订单失败");
      sessionStorage.setItem(`order-email:${data.orderNo}`, email.trim());
      router.push(`/checkout/${encodeURIComponent(data.orderNo)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建订单失败");
      if (turnstileSiteKey) {
        setTurnstileToken("");
        setTurnstileAttempt((attempt) => attempt + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site-shell cart-shell-page">
      <SiteHeader active="catalog" />
      <main className="cart-page">
        <Link className="cart-page-back" href="/"><ArrowLeft size={15} /> 返回商品</Link>
        <header className="cart-page-heading"><div><span className="section-index">CART CHECKOUT</span><h1>确认购物车</h1><p>输入接收邮箱，选择一个规格后继续安全付款。</p></div><span className="cart-page-count">{items.reduce((total, item) => total + item.quantity, 0)} 件商品</span></header>
        {!hydrated ? <div className="cart-page-loading">正在读取购物车…</div> : !items.length ? (
          <div className="cart-page-empty"><ShoppingBag size={30} /><h2>购物车还是空的</h2><p>先从商品页选择规格加入购物车。</p><Link className="primary-button" href="/">浏览商品 <ArrowRight size={16} /></Link></div>
        ) : (
          <div className="cart-page-layout">
            <section className="cart-page-items" aria-labelledby="cart-items-title">
              <div className="cart-page-section-heading"><div><span>ITEMS</span><h2 id="cart-items-title">已选规格</h2></div><span>{items.length} 个规格</span></div>
              <div className="cart-page-list">
                {items.map((item) => {
                  const liveVariant = products.find((product) => product.id === item.productId)?.variants.find((variant) => variant.id === item.variantId);
                  const unavailable = !liveVariant || liveVariant.availableCount < 1;
                  return <article className={`cart-page-item ${selectedItem?.variantId === item.variantId ? "is-active" : ""} ${unavailable ? "is-unavailable" : ""}`} key={item.variantId}>
                    <button type="button" className="cart-page-item-main" disabled={unavailable} onClick={() => setActiveVariantId(item.variantId)} aria-label={unavailable ? `${item.productName} 暂时缺货` : `选择 ${item.productName} ${item.variantLabel}`}><ProductThumbnail src={item.imageUrl} /><span><strong>{item.productName}</strong><small>{item.variantLabel} · {item.durationLabel}</small><em>{money(item.priceCents)} / 件{unavailable ? " · 暂时缺货" : ""}</em></span></button>
                    <div className="cart-page-item-actions"><div className="cart-quantity-control"><button type="button" aria-label="减少数量" disabled={item.quantity <= 1} onClick={() => updateQuantity(item, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" aria-label="增加数量" disabled={unavailable || item.quantity >= (liveVariant?.availableCount ?? item.quantity)} onClick={() => updateQuantity(item, 1)}><Plus size={13} /></button></div><button type="button" className="cart-item-remove" aria-label={`移除 ${item.productName}`} onClick={() => removeItem(item.variantId)}><Trash2 size={14} /></button></div>
                  </article>;
                })}
              </div>
              <div className="cart-page-total"><span>购物车预计总额</span><strong>{money(totalCents)}</strong></div>
            </section>
            <form className="cart-page-form" onSubmit={createOrder}>
              <div className="cart-page-form-heading"><span className="cart-page-form-icon"><ShieldCheck size={20} /></span><div><span>SECURE CHECKOUT</span><h2>填写付款信息</h2></div></div>
              <div className="cart-page-selection"><span>本次结算规格</span><strong>{selectedItem ? `${selectedItem.productName} · ${selectedItem.variantLabel}` : "请选择商品"}</strong><small>点击左侧其他商品行可切换</small></div>
              <label className="field-label" htmlFor="cart-email">接收邮箱</label>
              <div className="cart-page-email"><Mail size={16} /><input id="cart-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></div>
              <span className="field-label">支付方式</span>
              <SegmentedControl className="segmented-payment" label="支付方式" value={paymentMethod} onValueChange={(method) => { if (method === "wechat" || method === "alipay" || method === "bepusdt") setPaymentMethod(method); }} options={[{ value: "wechat", label: <span className="segmented-payment-label"><Image className="payment-brand-icon" src="/icons/wechat-pay.png" alt="" width={22} height={22} />微信支付</span>, accessibleLabel: "微信支付", disabled: bepusdtEnabled || !wechatEnabled }, { value: "alipay", label: <span className="segmented-payment-label"><Image className="payment-brand-icon" src="/icons/alipay.png" alt="" width={22} height={22} />支付宝</span>, accessibleLabel: "支付宝", disabled: bepusdtEnabled }, { value: "bepusdt", label: <span className="segmented-payment-label">USDT / 加密货币</span>, accessibleLabel: "USDT / 加密货币", disabled: !bepusdtEnabled }]} />
              <div className="cart-page-payable"><span>本次应付</span><strong>{selectedItem ? money(selectedItem.priceCents) : "--"}</strong></div>
              <label className="digital-terms-confirmation"><input type="checkbox" checked={acceptedDigitalTerms} onChange={(event) => setAcceptedDigitalTerms(event.target.checked)} required /><span>我已阅读并确认：卡密等数字商品交付后，原则上不支持七日无理由退款。<Link href="/policies#refund" target="_blank">查看完整规则</Link></span></label>
              {turnstileSiteKey && <TurnstileWidget key={`cart-${turnstileAttempt}`} siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button cart-page-submit" disabled={submitting || !selectedItem || !selectedAvailable || !acceptedDigitalTerms || Boolean(turnstileSiteKey && !turnstileToken)}><ShoppingBag size={17} />{submitting ? "正在创建订单…" : "继续付款"}<ArrowRight size={17} /></button>
              <p className="cart-page-note">当前选中的规格会进入现有订单确认页，库存与支付状态会在提交时再次校验。</p>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
