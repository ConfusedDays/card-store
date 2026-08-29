import { describe, expect, it } from "vitest";
import { parseAlipayTradeQuery } from "@/lib/payment-provider";

describe("Alipay trade query reconciliation", () => {
  it("normalizes a successful paid trade", () => {
    expect(parseAlipayTradeQuery({
      code: "10000",
      msg: "Success",
      outTradeNo: "KTEST001",
      tradeNo: "202608290001",
      tradeStatus: "TRADE_SUCCESS",
      totalAmount: "0.01",
    }, "KTEST001")).toEqual({
      providerRef: "202608290001",
      amountCents: 1,
    });
  });

  it("keeps unpaid and unknown trades pending", () => {
    expect(parseAlipayTradeQuery({
      code: "10000",
      msg: "Success",
      outTradeNo: "KTEST002",
      tradeStatus: "WAIT_BUYER_PAY",
    }, "KTEST002")).toBeNull();
    expect(parseAlipayTradeQuery({
      code: "40004",
      msg: "Business Failed",
      subCode: "ACQ.TRADE_NOT_EXIST",
    }, "KTEST003")).toBeNull();
  });

  it("rejects a mismatched merchant order number", () => {
    expect(() => parseAlipayTradeQuery({
      code: "10000",
      msg: "Success",
      outTradeNo: "KOTHER",
      tradeNo: "202608290002",
      tradeStatus: "TRADE_SUCCESS",
      totalAmount: "0.01",
    }, "KTEST004")).toThrow("支付宝交易订单号不匹配");
  });
});
