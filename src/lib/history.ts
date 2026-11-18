/**
 * Revoke history for an account, read from the chain (not from this browser),
 * so it's the same for anyone who scans the address and covers revokes made
 * with any tool, not only Unyoke.
 *
 * EVM lane: Approval events with value 0 and ApprovalForAll(false), from the
 * same log scan the live check uses. Native lane: the account's MsgRevoke,
 * MsgRevokeAllowance and MsgClearEVMDelegation transactions, from the REST
 * transaction search. Both only reach back as far as the node keeps history.
 */
import type { Hex } from "viem";
import type { ApprovalEvent } from "./evmApprovalLogs";
import type { FetchLike } from "./nativePermissions";

export const UNYOKE_MEMO = "Unyoke: revoke";

export interface EvmRevocation {
  lane: "EVM";
  kind: "erc20" | "operator";
  token: Hex;
  /** Filled in by the scan when the token answers symbol(). */
  tokenSymbol?: string;
  spender: Hex;
  blockNumber: bigint;
  txHash: Hex | null;
}

export interface NativeRevocation {
  lane: "Native";
  kind: "authz" | "feegrant" | "eip7702";
  /** Grantee (authz, fee grant); empty for 7702. */
  grantee: string;
  /** authz only: the message type the grant covered. */
  msgTypeUrl?: string;
  height: number;
  time?: string;
  txHash: string;
  /** Sent through Unyoke (its memo). EVM revokes carry no memo, so this is native-only. */
  viaUnyoke: boolean;
}

export type Revocation = EvmRevocation | NativeRevocation;

/** Approval events that removed a permission: allowance set to 0, or approve-all turned off. */
export function evmRevocations(events: readonly ApprovalEvent[]): EvmRevocation[] {
  return events
    .filter((e) => e.value === 0n)
    .map((e) => ({ lane: "EVM" as const, kind: e.kind, token: e.token, spender: e.spender, blockNumber: e.blockNumber, txHash: e.txHash }))
    .sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1));
}

const REVOKE_TYPES: Record<string, NativeRevocation["kind"]> = {
  "/cosmos.authz.v1beta1.MsgRevoke": "authz",
  "/cosmos.feegrant.v1beta1.MsgRevokeAllowance": "feegrant",
  "/qorechain.pqc.v1.MsgClearEVMDelegation": "eip7702",
};

interface TxResponse {
  txhash?: string;
  height?: string;
  timestamp?: string;
  code?: number;
  tx?: { body?: { memo?: string; messages?: Record<string, unknown>[] } };
}

/** Pull the revoke messages out of a REST tx-search response. Failed transactions are skipped. */
export function parseNativeRevocations(body: unknown, granter: string): NativeRevocation[] {
  const txs = ((body ?? {}) as { tx_responses?: TxResponse[] }).tx_responses ?? [];
  const out: NativeRevocation[] = [];
  for (const t of txs) {
    if ((t.code ?? 0) !== 0 || !t.txhash) continue;
    const memo = t.tx?.body?.memo ?? "";
    for (const m of t.tx?.body?.messages ?? []) {
      const kind = REVOKE_TYPES[String(m["@type"])];
      if (!kind) continue;
      const from = String(m.granter ?? m.sender ?? m.address ?? "");
      if (from && from !== granter) continue;
      out.push({
        lane: "Native",
        kind,
        grantee: String(m.grantee ?? ""),
        msgTypeUrl: typeof m.msg_type_url === "string" ? m.msg_type_url : undefined,
        height: Number(t.height ?? 0),
        time: t.timestamp,
        txHash: t.txhash.toUpperCase(),
        viaUnyoke: memo === UNYOKE_MEMO,
      });
    }
  }
  return out.sort((a, b) => b.height - a.height);
}

/** The account's native revokes that the node still has, newest first. */
export async function readNativeRevocations(rest: string, qor: string, fetchFn: FetchLike = fetch): Promise<NativeRevocation[]> {
  const base = rest.replace(/\/$/, "");
  const query = encodeURIComponent(`message.sender='${qor}'`);
  const res = await fetchFn(`${base}/cosmos/tx/v1beta1/txs?query=${query}&order_by=2&pagination.limit=100`);
  if (!res.ok) throw new Error(`Transaction search failed (HTTP ${res.status}).`);
  return parseNativeRevocations(await res.json(), qor);
}
