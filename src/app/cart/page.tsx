import { getStorefrontProducts } from "@/lib/catalog";
import { CartPage } from "@/components/cart-page";

export const dynamic = "force-dynamic";

export default function CartCheckoutPage() {
  return <CartPage products={getStorefrontProducts()} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY} wechatEnabled={process.env.PAYMENT_MODE === "epay" || process.env.PAYMENT_MODE === "hybrid" || process.env.NODE_ENV !== "production"} bepusdtEnabled={process.env.PAYMENT_MODE === "bepusdt" || process.env.PAYMENT_MODE === "hybrid"} />;
}
