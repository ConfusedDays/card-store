"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, CircleHelp, Clock3, Copy, LockKeyhole, Mail, MessageCircle, Users,
  PackageCheck, Search, ShieldCheck, ShoppingBag, Sparkles, Zap,
} from "lucide-react";
import type { OrderResult, Product, Variant } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreHeroTitle } from "@/components/store-hero-title";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AnimatedButtonIcon } from "@/components/ui/animated-state-icons";
import { TextEffect } from "@/components/ui/text-effect";

const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);

export function Storefront({ products, view = "catalog", turnstileSiteKey, wechatEnabled = false }: { products: Product[]; view?: "catalog" | "orders"; turnstileSiteKey?: string; wechatEnabled?: boolean }) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [category, setCategory] = useState("all");
  const [switchDirection, setSwitchDirection] = useState<"forward" | "backward">("forward");
  const categories = useMemo(() => [...new Set(products.map((item) => item.category))], [products]);
  const visibleProducts = useMemo(() => category === "all" ? products : products.filter((item) => item.category === category), [category, products]);
  const product = useMemo(() => visibleProducts.find((item) => item.id === productId) ?? visibleProducts[0], [visibleProducts, productId]);
  const [selectedId, setSelectedId] = useState(products[0]?.variants[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wechat" | "alipay">("alipay");
  const [acceptedDigitalTerms, setAcceptedDigitalTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState({ orderNo: "", email: "" });
  const [lookupResult, setLookupResult] = useState<OrderResult | null>(null);
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    if (view !== "catalog") return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.16, rootMargin: "0px 0px -7%" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [view]);

  useEffect(() => {
    if (product && product.id !== productId) selectProduct(product.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, product?.id]);

  const selected = useMemo(() => product?.variants.find((variant) => variant.id === selectedId), [product, selectedId]);

  function selectProduct(nextProductId: string) {
    if (nextProductId === productId) return;
    const currentIndex = products.findIndex((item) => item.id === productId);
    const nextIndex = products.findIndex((item) => item.id === nextProductId);
    const nextProduct = products[nextIndex];
    setSwitchDirection(nextIndex >= currentIndex ? "forward" : "backward");
    setProductId(nextProductId);
    setSelectedId(nextProduct?.variants[0]?.id ?? "");
    setAcceptedDigitalTerms(false);
    setTurnstileToken("");
    setTurnstileAttempt((attempt) => attempt + 1);
    setError("");
  }
  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
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
        body: JSON.stringify({
          variantId: selectedId,
          email,
          paymentMethod,
          digitalTermsAccepted: true,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "创建订单失败");
      sessionStorage.setItem(`order-email:${data.orderNo}`, email.trim());
      // Always show the order confirmation page first. It owns the final handoff
      // to the payment provider after the customer verifies the order details.
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

  async function findOrder(event: React.FormEvent) {
    event.preventDefault();
    setLookupError("");
    setLookupResult(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(lookup.orderNo.trim())}?email=${encodeURIComponent(lookup.email.trim())}&reconcile=payment`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "查询失败");
      setLookupResult(data);
    } catch (reason) {
      setLookupError(reason instanceof Error ? reason.message : "查询失败");
    }
  }

  if (view === "catalog" && !product) return <main className="empty-state">暂无在售商品</main>;

  return (
    <div className="site-shell">
      <SiteHeader active={view} />

      <main className={`storefront-main ${view === "orders" ? "order-page" : "catalog-page"}`}>
        {view === "catalog" && (
          <section className="store-hero" aria-labelledby="store-hero-title">
            <div className="store-hero-glow store-hero-glow-one" aria-hidden="true" />
            <div className="store-hero-glow store-hero-glow-two" aria-hidden="true" />
            <div className="store-hero-grid" aria-hidden="true" />
            <div className="store-hero-inner">
              <div className="store-hero-copy scroll-reveal" data-scroll-reveal>
                <span className="store-hero-badge"><Sparkles size={15} /> 数字商品，即时交付</span>
                <StoreHeroTitle />
                <p>
                  <TextEffect className="store-hero-description-effect" delay={1.05} duration={0.9} stagger={0.04} hover forceMotion>
                    从选择规格到安全付款，再到卡密自动发放，每一步都清晰、快速且可追溯。
                  </TextEffect>
                </p>
                <div className="store-hero-actions">
                  <button type="button" className="store-hero-primary" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>立即选购 <AnimatedButtonIcon idle={<ArrowRight size={18} />} /></button>
                  <Link className="store-hero-secondary" href="/orders"><AnimatedButtonIcon idle={<Search size={17} />} /> 查询订单</Link>
                </div>
              </div>
              <div className="store-hero-stats scroll-reveal" data-scroll-reveal>
                <div><Zap size={19} /><strong>自动发卡</strong><span>支付确认后即时交付</span></div>
                <div><ShieldCheck size={19} /><strong>加密存储</strong><span>库存与交付安全隔离</span></div>
                <div><Clock3 size={19} /><strong>全程可查</strong><span>订单状态随时追溯</span></div>
              </div>
            </div>
          </section>
        )}
        {view === "catalog" && product && (
          <section className="catalog-band" id="catalog">          <div className="catalog-wrap scroll-reveal" data-scroll-reveal>
            {categories.length > 1 && <SegmentedControl className="catalog-category-filter segmented-categories" role="tablist" label="按商品分类筛选" value={category} onValueChange={setCategory} options={[{ value: "all", label: "全部", accessibleLabel: "全部" }, ...categories.map((item) => ({ value: item, label: item, accessibleLabel: item }))]} />}
            {visibleProducts.length > 1 && (
              <SegmentedControl className="segmented-products" columns={3} role="tablist" label="选择商品" value={product.id} onValueChange={selectProduct} options={visibleProducts.map((item) => {
                  const firstVariant = item.variants[0];
                  const totalStock = item.variants.reduce((sum, variant) => sum + variant.availableCount, 0);
                  const price = firstVariant ? `起价 ${money(firstVariant.priceCents)}` : "暂无规格";
                  const stock = totalStock > 0 ? `${totalStock} 件` : "缺货";
                  return {
                    value: item.id,
                    accessibleLabel: `${item.name} ${price} ${stock}`,
                    label: <span className="segmented-product-label"><ProductThumbnail src={item.imageUrl} /><span className="segmented-product-copy"><strong>{item.name}</strong><small>{price}</small></span><em>{stock}</em></span>,
                  };
                })} />
            )}
            <div key={`summary-${product.id}`} className="product-summary" data-switch-direction={switchDirection}>
              <div className="eyebrow"><span className="live-dot" /> 即时库存</div>
              <div className={`product-visual ${product.imageUrl ? "has-promo-image" : ""}`}>
                {product.imageUrl ? (
                  <Image className="product-promo-image" src={product.imageUrl} alt={`${product.name} 宣传图`} fill sizes="(max-width: 920px) calc(100vw - 48px), 650px" unoptimized priority />
                ) : (
                  <div aria-hidden="true">
                    <div className="visual-grid" />
                    <div className="license-tile license-tile-back"><span>LICENSE</span></div>
                    <div className="license-tile license-tile-front">
                      <ShieldCheck size={34} />
                      <span>AUTHORIZED</span>
                      <strong>SOFTWARE KEY</strong>
                      <small>SECURE DIGITAL DELIVERY</small>
                    </div>
                  </div>
                )}
              </div>
              <div className="product-copy">
                <span className="category-label">{product.category}</span>
                <h1>{product.name}</h1>
                <p className="product-description">{product.description}</p>
              </div>
              <div className="trust-row">
                <span><PackageCheck size={17} /> 支付后自动发货</span>
                <span><LockKeyhole size={17} /> 卡密加密存储</span>
                <span><CircleHelp size={17} /> 订单可追溯</span>
              </div>
            </div>

            <form key={`purchase-${product.id}`} className="purchase-panel" data-switch-direction={switchDirection} onSubmit={createOrder}>
              <div className="panel-heading">
                <div><span>选择规格</span><strong>{selected ? money(selected.priceCents) : "--"}</strong></div>
                <span className="stock-pill">库存 {selected?.availableCount ?? 0}</span>
              </div>
              <fieldset className="variant-list">
                <legend className="sr-only">商品规格</legend>
                {product.variants.map((variant) => (
                  <VariantOption key={variant.id} variant={variant} selected={variant.id === selectedId} onSelect={setSelectedId} />
                ))}
              </fieldset>
              <label className="field-label" htmlFor="email">接收邮箱</label>
              <input id="email" className="text-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
              <span className="field-label">支付方式</span>
              <SegmentedControl className="segmented-payment" label="支付方式" value={paymentMethod} onValueChange={(method) => { if (method === "wechat" || method === "alipay") setPaymentMethod(method); }} options={[
                { value: "wechat", label: <span className="segmented-payment-label"><Image className="payment-brand-icon" src="/icons/wechat-pay.svg" alt="" width={22} height={22} />微信支付</span>, accessibleLabel: "微信支付", disabled: !wechatEnabled },
                { value: "alipay", label: <span className="segmented-payment-label"><Image className="payment-brand-icon" src="/icons/alipay.svg" alt="" width={22} height={22} />支付宝</span>, accessibleLabel: "支付宝" },
              ]} />
              {product.contactEnabled && (
                <div className="product-contact product-contact-payment" aria-label="商品联系方式">
                  <span className="product-contact-title">需要联系我</span>
                  <div className="product-contact-links">
                    <a href="mailto:support@reiishop.cn"><Mail size={14} aria-hidden="true" /> support@reiishop.cn</a>
                    <a href="https://discord.gg/MmXRuWnrQT" target="_blank" rel="noreferrer"><MessageCircle size={14} aria-hidden="true" /> Discord 频道</a>
                    <span><Users size={14} aria-hidden="true" /> QQ 群 1107140300</span>
                  </div>
                </div>
              )}
              <div className="order-total"><span>应付金额</span><strong>{selected ? money(selected.priceCents) : "--"}</strong></div>
              <label className="digital-terms-confirmation">
                <input
                  type="checkbox"
                  checked={acceptedDigitalTerms}
                  onChange={(event) => setAcceptedDigitalTerms(event.target.checked)}
                  required
                />
                <span>
                  我已阅读并确认：卡密等数字商品交付后，原则上不支持七日无理由退款。
                  <Link href="/policies#refund" target="_blank">查看完整规则</Link>
                </span>
              </label>
              {turnstileSiteKey && (
                <TurnstileWidget
                  key={`${product.id}-${turnstileAttempt}`}
                  siteKey={turnstileSiteKey}
                  onVerify={setTurnstileToken}
                />
              )}
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button" disabled={submitting || !selected || selected.availableCount < 1 || !acceptedDigitalTerms || Boolean(turnstileSiteKey && !turnstileToken)}>
                <AnimatedButtonIcon loading={submitting} idle={<ShoppingBag size={18} />} /> {submitting ? "正在创建订单..." : "提交订单"} <AnimatedButtonIcon className="button-trailing-icon" idle={<ArrowRight size={18} />} />
              </button>
              <p className="purchase-note">支付成功并通过平台确认后自动发卡，请确认接收邮箱填写正确。</p>
            </form>
          </div>
        </section>
        )}

        {view === "orders" && (
          <section className="order-band" id="orders">
            <div className="order-wrap">
              <div className="order-intro">
                <span className="order-intro-mark"><Search size={23} /></span>
                <span className="section-index">ORDER LOOKUP</span>
                <h2>查询订单与卡密</h2>
                <p>使用订单号和下单邮箱查看支付状态及已交付卡密。</p>
              </div>

              <form className="lookup-form" onSubmit={findOrder}>
                <div className="lookup-form-heading">
                  <div>
                    <span>订单验证</span>
                    <strong>输入查询信息</strong>
                  </div>
                  <span className="lookup-security" title="安全查询"><ShieldCheck size={19} /></span>
                </div>
                <div className="lookup-fields">
                  <label>
                    <span>订单号</span>
                    <input value={lookup.orderNo} onChange={(event) => setLookup({ ...lookup, orderNo: event.target.value })} placeholder="K..." autoComplete="off" required />
                  </label>
                  <label>
                    <span>下单邮箱</span>
                    <input type="email" value={lookup.email} onChange={(event) => setLookup({ ...lookup, email: event.target.value })} placeholder="name@example.com" autoComplete="email" required />
                  </label>
                  <button type="submit"><AnimatedButtonIcon idle={<Search size={18} />} /> 查询订单</button>
                </div>
                <div className="lookup-feedback" aria-live="polite">
                  {lookupError && <p className="form-error" role="alert">{lookupError}</p>}
                  {lookupResult && <OrderResultView order={lookupResult} />}
                </div>
              </form>
            </div>
          </section>
        )}      </main>
      <SiteFooter />
    </div>
  );
}

function VariantOption({ variant, selected, onSelect }: { variant: Variant; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <label className={`variant-option ${selected ? "selected" : ""} ${variant.availableCount < 1 ? "disabled" : ""}`}>
      <input type="radio" name="variant" checked={selected} disabled={variant.availableCount < 1} onChange={() => onSelect(variant.id)} />
      <span className="radio-check">{selected && <Check size={14} />}</span>
      <span className="variant-name"><strong>{variant.label}</strong>{variant.giftVariantId && <small>赠送 {variant.giftProductName ? `${variant.giftProductName} · ` : ""}{variant.giftVariantLabel ?? "卡密"}</small>}</span>
      <span className="variant-stock">{variant.availableCount > 0 ? `${variant.availableCount} 件` : "缺货"}</span>
      <strong className="variant-price">{money(variant.priceCents)}</strong>
    </label>
  );
}

function OrderResultView({ order }: { order: OrderResult }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const deliveredKeys = order.licenseKeys ?? (order.licenseKey ? [{ key: order.licenseKey, isGift: false, productName: "", variantLabel: order.variantLabel }] : []);
  async function copyKey(key: string, index: number) {
    await navigator.clipboard.writeText(key);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex((current) => current === index ? null : current), 1500);
  }
  return (
    <div className="lookup-result">
      <div><span>订单号</span><strong>{order.orderNo}</strong></div>
      <div><span>状态</span><strong>{statusText(order.status)}</strong></div>
      {deliveredKeys.map((item, index) => <div className={`delivered-key ${item.isGift ? "delivered-gift" : ""}`} key={`${item.key}-${index}`}><span>{item.isGift ? "附赠卡密" : "已交付卡密"}</span>{item.productName && <small>{item.productName} · {item.variantLabel}</small>}<code>{item.key}</code><button type="button" onClick={() => void copyKey(item.key, index)}><AnimatedButtonIcon success={copiedIndex === index} idle={<Copy size={16} />} /> {copiedIndex === index ? "已复制" : "复制"}</button></div>)}
    </div>
  );
}

export function statusText(status: OrderResult["status"]) {
  return ({ pending: "待支付", paid: "已支付", delivered: "已发货", paid_no_stock: "已支付，等待补货", cancelled: "已取消" })[status];
}
