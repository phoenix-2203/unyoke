/**
 * Building revokes, and reading the evidence afterwards.
 *
 * - EVM: approve(spender, 0) or setApprovalForAll(operator, false), sent to the
 *   token contract from the owner's EVM wallet. QoreX mobile opens its own
 *   one-transaction window for it (see docs/SPIKE_RESULTS.md).
 * - Native: MsgRevoke / MsgRevokeAllowance / MsgClearEVMDelegation, signed by
 *   QoreX (hybrid signature).
 */
import { type Hex, erc20Abi, getAddress } from "viem";
import { approvalForAllAbi } from "./evmApprovalState";
import type { LiveApproval } from "./evmApprovalState";

export type EvmRevokeCall =
  | { address: Hex; abi: typeof erc20Abi; functionName: "approve"; args: readonly [Hex, bigint] }
  | { address: Hex; abi: typeof approvalForAllAbi; functionName: "setApprovalForAll"; args: readonly [Hex, boolean] };

/** The one contract call that removes this approval. Only ever sets it to zero/false. */
export function evmRevokeCall(a: LiveApproval): EvmRevokeCall {
  const token = getAddress(a.token);
  const spender = getAddress(a.spender);
  return a.kind === "erc20"
    ? { address: token, abi: erc20Abi, functionName: "approve", args: [spender, 0n] as const }
    : { address: token, abi: approvalForAllAbi, functionName: "setApprovalForAll", args: [spender, false] as const };
}

/** Human description of the call, shown before signing. */
export function describeEvmRevoke(a: LiveApproval, symbol: string): string {
  return a.kind === "erc20"
    ? `approve(${a.spender}, 0) on ${symbol}`
    : `setApprovalForAll(${a.spender}, false) on ${symbol}`;
}

/** Stable key for a permission, used to track its revoke status. */
export function permissionKey(p: { kind: string; token?: string; spender?: string; grantee?: string; msgTypeUrl?: string; delegate?: string }): string {
  return [p.kind, p.token, p.spender, p.grantee, p.msgTypeUrl, p.delegate].filter(Boolean).join(":").toLowerCase();
}

/** What a window record says, as evidence for the receipt. */
export interface WindowEvidence {
  found: boolean;
  allowedTargets: string[];
  maxTxs: number;
  usedTxs: number;
  openedHeight: number;
  expiryHeight: number;
  /** True when the window was limited to the token contract and to one transaction. */
  tight: boolean;
}

export function parseWindowEvidence(body: unknown, token: string): WindowEvidence {
  const b = (body ?? {}) as Record<string, unknown>;
  const targets = Array.isArray(b.allowed_targets) ? (b.allowed_targets as string[]).map((t) => t.toLowerCase()) : [];
  const maxTxs = Number(b.max_txs ?? 0);
  const usedTxs = Number(b.used_txs ?? 0);
  return {
    found: b.found === true,
    allowedTargets: targets,
    maxTxs,
    usedTxs,
    openedHeight: Number(b.opened_height ?? 0),
    expiryHeight: Number(b.expiry_height ?? 0),
    tight: targets.length === 1 && targets[0] === token.toLowerCase() && maxTxs === 1,
  };
}

/**
 * Can the account send an EVM transaction to `target` right now, judging by its
 * window record (GET /qorechain/pqc/v1/evm_window/{qor})? Used before asking a
 * desktop wallet to sign: wallets other than QoreX mobile can't open a window,
 * and some (Keplr) turn the chain's refusal into "An unknown RPC error occurred".
 */
export function windowAllowsTx(body: unknown, target: string): boolean {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.found !== true || b.live !== true) return false;
  if (Number(b.remaining_txs ?? 0) < 1 || Number(b.remaining_blocks ?? 0) < 1) return false;
  const targets = Array.isArray(b.allowed_targets) ? (b.allowed_targets as string[]).map((t) => t.toLowerCase()) : [];
  return targets.length === 0 || targets.includes(target.toLowerCase());
}
