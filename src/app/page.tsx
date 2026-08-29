import { getStorefrontProducts } from "@/lib/catalog";
import { Storefront } from "@/components/storefront";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <Storefront products={getStorefrontProducts()} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY} />;
}
