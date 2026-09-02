import Link from "next/link";
import { ArrowLeft, CircleHelp, FileCheck2, LockKeyhole, PackageCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "数字商品购买与售后规则 · Reii小店",
  description: "数字商品交付、退款、隐私及售后说明",
};

export default function PoliciesPage() {
  return (
    <div className="site-shell policy-shell">
      <SiteHeader active="catalog" />
      <main className="policy-page">
        <Link className="policy-back" href="/"><ArrowLeft size={16} /> 返回购买页面</Link>
        <header className="policy-hero">
          <span className="section-index">PURCHASE POLICY</span>
          <h1>数字商品购买与售后规则</h1>
          <p>购买前请仔细阅读。下单时的主动勾选将作为您已阅读并确认本规则的记录。</p>
          <small>生效日期：2026 年 8 月 29 日 · 版本：2026-08-29</small>
        </header>

        <div className="policy-grid">
          <section id="delivery" className="policy-card">
            <span className="policy-icon"><PackageCheck size={21} /></span>
            <div>
              <h2>商品性质与交付</h2>
              <p>本站销售的是卡密、授权码等数字化商品，不包含需要物流寄送的实物。支付成功且支付平台确认后，系统会在结算页、订单查询页或下单邮箱中展示或发送卡密。</p>
              <p>卡密首次成功展示或邮件成功发送时，视为商品已经交付。请确保邮箱准确，并妥善保管订单号和卡密。</p>
            </div>
          </section>

          <section id="refund" className="policy-card policy-card-emphasis">
            <span className="policy-icon"><FileCheck2 size={21} /></span>
            <div>
              <h2>退款规则</h2>
              <p><strong>卡密等数字商品一经展示、复制或通过邮件发送，即视为已交付，原则上不支持七日无理由退货或退款。</strong></p>
              <p>下列情形不受上述限制：商品尚未交付、发生重复扣款、卡密在交付时即无效、商品与页面描述明显不符，或者法律法规另有规定。经核实符合条件的，我们将补发可用卡密或按实际情况退款。</p>
              <p>因买家填错邮箱、泄露卡密、违反商品使用说明，或因第三方平台规则和账号状态导致无法使用的，不属于商品在交付时即存在的质量问题；我们仍会协助核查具体原因。</p>
            </div>
          </section>

          <section id="privacy" className="policy-card">
            <span className="policy-icon"><LockKeyhole size={21} /></span>
            <div>
              <h2>隐私说明</h2>
              <p>为完成订单、付款核验、自动发卡和售后处理，我们会处理您的下单邮箱、订单号、支付流水标识以及必要的系统日志。我们不会出售您的个人信息。</p>
              <p>支付宝、邮件发送服务和网站托管服务会在完成各自服务所必需的范围内处理相关数据。数据仅在履行订单、保障安全和满足法定义务所需期限内保存。</p>
            </div>
          </section>

          <section id="contact" className="policy-card">
            <span className="policy-icon"><CircleHelp size={21} /></span>
            <div>
              <h2>售后处理</h2>
              <p>需要售后时，请先在订单查询页确认订单状态，并通过购买时约定的客服渠道提交订单号、下单邮箱和问题截图。请勿在公开页面发送完整卡密。</p>
              <p>对于卡密无效等问题，我们会核对交付记录、库存记录和激活状态，再提供补发或退款方案。</p>
              <Link className="policy-action" href="/orders">前往订单查询</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
