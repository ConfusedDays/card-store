"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Mail, MessageCircle, Users } from "lucide-react";

const QQ_GROUP = "1107140300";

export function SiteFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const [qqCopied, setQqCopied] = useState(false);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) footer.classList.add("is-visible");
    }, { threshold: 0.14 });
    observer.observe(footer);

    const onPointerMove = (event: PointerEvent) => {
      const bounds = footer.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2;
      footer.style.setProperty("--footer-pointer-x", x.toFixed(3));
      footer.style.setProperty("--footer-pointer-y", y.toFixed(3));
    };
    footer.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      observer.disconnect();
      footer.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  async function copyQq() {
    try {
      await navigator.clipboard.writeText(QQ_GROUP);
      setQqCopied(true);
      window.setTimeout(() => setQqCopied(false), 1500);
    } catch {
      setQqCopied(false);
    }
  }

  return (
    <footer ref={footerRef} className="site-footer-luke" aria-labelledby="site-footer-title">
      <div className="site-footer-luke-grid" aria-hidden="true" />
      <div className="site-footer-luke-orb" aria-hidden="true" />
      <div className="site-footer-luke-inner">
        <div className="site-footer-luke-top" data-footer-reveal>
          <span className="site-footer-luke-kicker">REII SHOP / DIGITAL GOODS</span>
          <span className="site-footer-luke-status"><i /> 自动发卡 · 在线支持</span>
        </div>

        <div className="site-footer-luke-body">
          <div className="site-footer-luke-cta" data-footer-reveal>
            <span className="site-footer-luke-index">/ 04 — KEEP IN TOUCH</span>
            <h2 id="site-footer-title">把购买的最后一步，<br /><em>也做得清楚。</em></h2>
            <p>正版数字商品，支付后自动交付。遇到问题，带上订单号，我们会尽快帮你处理。</p>
            <Link className="site-footer-luke-primary" href="/">浏览商品 <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>

          <nav className="site-footer-luke-links" aria-label="规则与联系方式" data-footer-reveal>
            <div className="site-footer-luke-link-group">
              <span className="site-footer-luke-label">规则 / POLICY</span>
              <Link href="/policies#refund">退款规则 <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/policies#privacy">隐私政策 <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/policies#contact">售后说明 <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/orders">查询订单 <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </div>
            <div className="site-footer-luke-link-group">
              <span className="site-footer-luke-label">联系 / CONTACT</span>
              <a href="mailto:support@reiishop.cn"><Mail size={14} aria-hidden="true" /> support@reiishop.cn</a>
              <a href="https://discord.gg/MmXRuWnrQT" target="_blank" rel="noreferrer"><MessageCircle size={14} aria-hidden="true" /> Discord 频道 <ArrowUpRight size={13} aria-hidden="true" /></a>
              <button type="button" onClick={() => void copyQq()}><Users size={14} aria-hidden="true" /> QQ 群 {QQ_GROUP} {qqCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}</button>
            </div>
          </nav>
        </div>

        <div className="site-footer-luke-brand" data-footer-reveal>
          <Link href="/" aria-label="Reii Shop 首页"><span>Reii</span><em>Shop</em><sup>®</sup></Link>
        </div>
        <div className="site-footer-luke-bottom" data-footer-reveal>
          <span>© 2026 Reii Shop</span>
          <span>Made for a smoother checkout <b>↗</b></span>
        </div>
      </div>
    </footer>
  );
}
