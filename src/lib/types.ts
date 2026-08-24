export type Currency = "CNY";

export type Variant = {
  id: string;
  label: string;
  durationLabel: string;
  priceCents: number;
  currency: Currency;
  availableCount: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  imageUrl: string | null;
  variants: Variant[];
};

export type OrderStatus = "pending" | "paid" | "delivered" | "paid_no_stock" | "cancelled";

export type OrderResult = {
  orderNo: string;
  status: OrderStatus;
  amountCents: number;
  currency: Currency;
  variantLabel: string;
  email: string;
  paymentMethod: string;
  licenseKey?: string;
  createdAt: string;
};
