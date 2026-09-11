"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Mail, MessageCircle, Users } from "lucide-react";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";

const QQ_GROUP = "1107140300";

export function SiteFooter() {
  const [qqCopied, setQqCopied] = useState(false);

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
    <RuixenGradientFooter className="ruixen-footer" gradientHeight="44vh" minReveal={0.035} bars={10} blur={18} peak={0.94} valley={0.42} ariaLabelledBy="site-footer-title">
      <div className="ruixen-footer-inner">
        <div className="ruixen-footer-top" data-footer-reveal>
          <span className="ruixen-footer-kicker">DIGITAL GOODS / STUDIO</span>
          <span className="ruixen-footer-status"><i /> 服务正常运行</span>
          <span className="ruixen-footer-coordinate">ONLINE · 2026</span>
        </div>

        <div className="ruixen-footer-content">
          <section className="ruixen-footer-intro" data-footer-reveal>
            <span className="ruixen-footer-eyebrow">04 / THE LAST STEP</span>
            <h2 id="site-footer-title">每一次购买，<br /><em>都该简单。</em></h2>
            <p>清晰的数字商品、可靠的支付与自动交付，把最后一步也做得从容。</p>
            <Link className="ruixen-footer-primary" href="/">浏览商品 <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </section>

          <nav className="ruixen-footer-nav" aria-label="页脚导航" data-footer-reveal>
            <div className="ruixen-footer-column">
              <span className="ruixen-footer-label">规则 / POLICY</span>
              <Link href="/policies#refund">退款规则 <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/policies#privacy">隐私政策 <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/policies#contact">售后说明 <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/orders">查询订单 <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </div>
            <div className="ruixen-footer-column">
              <span className="ruixen-footer-label">联系 / CONTACT</span>
              <a href="mailto:support@reiishop.cn"><Mail size={14} aria-hidden="true" /> support@reiishop.cn</a>
              <a href="https://discord.gg/MmXRuWnrQT" target="_blank" rel="noreferrer"><MessageCircle size={14} aria-hidden="true" /> Discord 频道 <ArrowUpRight size={13} aria-hidden="true" /></a>
              <button type="button" onClick={() => void copyQq()}><Users size={14} aria-hidden="true" /> QQ 群 {QQ_GROUP} {qqCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}</button>
            </div>
          </nav>
        </div>

        <div className="ruixen-footer-wordmark" aria-hidden="true" data-footer-reveal>
          <span>Blank</span><em> / </em><span>Canvas</span>
        </div>
        <div className="ruixen-footer-bottom" data-footer-reveal>
          <span>© 2026 DIGITAL GOODS</span>
          <span>Made with intent <b>↗</b></span>
          <span>Online · Always</span>
        </div>
      </div>
    </RuixenGradientFooter>
  );
}
