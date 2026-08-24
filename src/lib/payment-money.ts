export function cnyToCents(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("支付宝回调金额格式无效");
  const [yuan, fraction = ""] = value.split(".");
  const cents = BigInt(yuan) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("支付宝回调金额超出范围");
  return Number(cents);
}

export function centsToCny(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("订单金额无效");
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
