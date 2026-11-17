/** Plain-language formatting for amounts and addresses. */
import { formatUnits } from "viem";

/**
 * Wallets usually ask for "unlimited" as the largest uint256 (2^256 - 1);
 * some use 2^255 or similar. Anything at or above 2^128 is unlimited in practice.
 */
export const UNLIMITED_THRESHOLD = 1n << 128n;

export function isUnlimited(amount: bigint): boolean {
  return amount >= UNLIMITED_THRESHOLD;
}

/** "Unlimited", or the amount in whole tokens with up to 6 decimals, e.g. "1,250.5 fUSD". */
export function formatTokenAmount(amount: bigint, decimals: number | undefined, symbol?: string): string {
  const unit = symbol ? ` ${symbol}` : "";
  if (isUnlimited(amount)) return `Unlimited${unit}`;
  if (decimals === undefined) return `${amount.toString()} (raw units)${unit}`;
  const [whole, frac = ""] = formatUnits(amount, decimals).split(".");
  const wholeGrouped = BigInt(whole!).toLocaleString("en-US");
  const fracTrim = frac.slice(0, 6).replace(/0+$/, "");
  return `${wholeGrouped}${fracTrim ? `.${fracTrim}` : ""}${unit}`;
}

/** 0x1234…abcd */
export function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** uqor (6 decimals) to "1.5 QOR". */
export function formatQor(uqor: bigint | string): string {
  return formatTokenAmount(BigInt(uqor), 6, "QOR");
}

