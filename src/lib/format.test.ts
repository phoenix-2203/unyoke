import { maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import { formatQor, formatTokenAmount, isUnlimited, shortAddress } from "./format";

describe("formatTokenAmount", () => {
  it("calls max approvals unlimited", () => {
    expect(isUnlimited(maxUint256)).toBe(true);
    expect(isUnlimited(1n << 255n)).toBe(true);
    expect(formatTokenAmount(maxUint256, 6, "fUSD")).toBe("Unlimited fUSD");
  });

  it("shows whole tokens with grouping and trimmed decimals", () => {
    expect(formatTokenAmount(1_250_500_000n, 6, "fUSD")).toBe("1,250.5 fUSD");
    expect(formatTokenAmount(1_000_000n, 6, "fUSD")).toBe("1 fUSD");
    expect(formatTokenAmount(123n, 18, "fETH")).toBe("0 fETH");
    expect(formatTokenAmount(1_234_567_890_123_456_789n, 18)).toBe("1.234567");
  });

  it("is honest when decimals are unknown", () => {
    expect(formatTokenAmount(5n, undefined, "XYZ")).toBe("5 (raw units) XYZ");
  });
});

describe("helpers", () => {
  it("shortens addresses", () => {
    expect(shortAddress("0xF1C9948Be3910B70224bD4578A154f74c2aB8082")).toBe("0xF1C9…8082");
    expect(shortAddress("0x1234")).toBe("0x1234");
  });

  it("formats QOR from uqor", () => {
    expect(formatQor("4865000")).toBe("4.865 QOR");
  });
});
