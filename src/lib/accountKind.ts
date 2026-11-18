/**
 * Which kind of key an account has, from its public key on chain:
 *
 * - "ethereum": an Ethereum-style key (coin 60, ethsecp256k1). Its 0x address
 *   is real: EVM wallets sign for it, so it can make (and revoke) token approvals.
 * - "cosmos": a Cosmos-style key (coin 118, QoreX's default account). Its 0x
 *   form is only a re-encoding of the same bytes; no EVM signature can come
 *   from it, so it can't approve or revoke tokens. Native grants work as usual.
 * - "unknown": the account has never signed anything, so the chain doesn't know yet.
 */
import type { FetchLike } from "./nativePermissions";

export type AccountKind = "ethereum" | "cosmos" | "unknown";

export function parseAccountKind(body: unknown): AccountKind {
  const type = String(((body ?? {}) as { account?: { pub_key?: { "@type"?: string } | null } }).account?.pub_key?.["@type"] ?? "");
  if (/ethsecp256k1/i.test(type)) return "ethereum";
  if (type === "/cosmos.crypto.secp256k1.PubKey") return "cosmos";
  return "unknown";
}

export async function readAccountKind(rest: string, qor: string, fetchFn: FetchLike = fetch): Promise<AccountKind> {
  try {
    const res = await fetchFn(`${rest.replace(/\/$/, "")}/cosmos/auth/v1beta1/accounts/${qor}`);
    return res.ok ? parseAccountKind(await res.json()) : "unknown";
  } catch {
    return "unknown";
  }
}
