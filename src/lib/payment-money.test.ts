import { describe, expect, it } from "vitest";
import { centsToCny, cnyToCents } from "./payment-money";

describe("CNY payment amounts", () => {
  it("converts cents without floating point rounding", () => {
    expect(centsToCny(1)).toBe("0.01");
    expect(centsToCny(12345)).toBe("123.45");
    expect(cnyToCents("0.01")).toBe(1);
    expect(cnyToCents("123.45")).toBe(12345);
    expect(cnyToCents("10")).toBe(1000);
  });

  it("rejects malformed callback amounts", () => {
    expect(() => cnyToCents("1.001")).toThrow();
    expect(() => cnyToCents("-1.00")).toThrow();
    expect(() => cnyToCents("1e2")).toThrow();
    expect(() => centsToCny(-1)).toThrow();
  });
});
