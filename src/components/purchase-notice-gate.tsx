"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

const SESSION_KEY = "reiishop.purchase-notice.session";
const REMEMBER_KEY = "reiishop.purchase-notice.remembered";

export function PurchaseNoticeGate() {
  const alreadyAccepted = useSyncExternalStore(
    () => () => undefined,
    () => window.sessionStorage.getItem(SESSION_KEY) === "true" || window.localStorage.getItem(REMEMBER_KEY) === "true",
    () => false,
  );
  const [entered, setEntered] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [remember, setRemember] = useState(false);
  const open = !alreadyAccepted && !entered;

  useEffect(() => {
    document.body.classList.toggle("purchase-notice-open", open);
    return () => document.body.classList.remove("purchase-notice-open");
  }, [open]);

  function enterStore() {
    if (!accepted) return;
    window.sessionStorage.setItem(SESSION_KEY, "true");
    if (remember) window.localStorage.setItem(REMEMBER_KEY, "true");
    else window.localStorage.removeItem(REMEMBER_KEY);
    setEntered(true);
  }

  if (!open) return null;

  return (
    <div className="purchase-notice-overlay" role="presentation">
      <section className="purchase-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-notice-title">
        <div className="notice-emblem notice-logo" aria-hidden="true"><Image src="/reii-bear.jpg" alt="" width={54} height={54} priority /></div>
        <h1 id="purchase-notice-title">购买须知</h1>
        <p className="notice-intro">请在购买或查询订单前阅读以下内容</p>

        <ul className="notice-rules">
          <li><ShieldCheck size={17} /><span>请勿向他人透露订单号、接收邮箱或完整卡密；因泄露造成的损失需自行承担。</span></li>
          <li><ShieldCheck size={17} /><span>本站商品为数字化授权内容，支付确认后将自动交付至结算页、订单查询页或下单邮箱。</span></li>
          <li><ShieldCheck size={17} /><span>卡密一经展示、复制或发送，即视为交付，原则上不支持七日无理由退款；未交付、重复扣款、交付时即无效等法定例外除外。</span></li>
          <li><ShieldCheck size={17} /><span>请确认商品说明及使用条件，并遵守相关平台和软件的规则。购买前请核对接收邮箱。</span></li>
        </ul>

        <label className="notice-agreement">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span className="notice-checkmark">{accepted && <Check size={13} />}</span>
          <span>我已阅读并同意 <Link href="/policies" target="_blank">《购买须知与退款规则》</Link></span>
        </label>
        <label className="notice-remember">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>不再显示（仅保存在当前浏览器）</span>
        </label>

        <button className="notice-enter-button" type="button" disabled={!accepted} onClick={enterStore}>
          {accepted ? "同意并进入网站" : "请先阅读并勾选同意"}
        </button>
        <p className="notice-footnote">进入后仍可在页脚查看退款规则、隐私说明和售后处理方式。</p>
      </section>
    </div>
  );
}
