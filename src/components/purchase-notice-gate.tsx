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
        <span className="notice-kicker">REII SHOP · OFFICIAL NOTICE</span>
        <h1 id="purchase-notice-title">购买须知</h1>
        <p className="notice-intro">请在购买或查询订单前阅读以下内容</p>

        <ul className="notice-rules">
          <li><ShieldCheck size={17} /><span>本站提供的产品皆为代购代付海外虚拟产品。</span></li>
          <li><ShieldCheck size={17} /><span>只为代购海外虚拟产品密钥，只保证密钥有效性，其他使用产生的后果均由你自行承担。</span></li>
          <li><ShieldCheck size={17} /><span>购买前请务必了解服务器状态；一旦售出只保证卡密正确。不是卡密问题不退不换；下单后遇到没有教程等问题，请咨询在线客服，或查看公告获取售后联系方式。</span></li>
          <li><ShieldCheck size={17} /><span>若支付后未能发货，请联系右下角在线客服或添加售后；请保存好订单号和付款凭证，以保障售后服务。</span></li>
          <li><ShieldCheck size={17} /><span>禁止未成年人购买。购买前请仔细阅读，下单后默认同意上述条例。</span></li>
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
