/**
 * Sizing and encoding the EVM authorisation window Unyoke opens for a batch of
 * revokes.
 *
 * The window is kept as small as the batch allows:
 * - allowedTargets: exactly the token contracts being revoked, nothing else
 * - maxTxs: exactly one transaction per revoke
 * - maxValue: the fees of those transactions plus a small margin (revokes move
 *   no QOR; the cap counts value plus each transaction's maximum fee)
 * - blocks: about ten minutes of testnet blocks
 *
 * Token approvals are not priced by a window, so the target list is what bounds
 * them. Docs: https://docs.qorechain.io/developer-guide/evm-window-reference
 */
import {
  CLOSE_EVM_WINDOW_TYPE_URL,
  MAX_EVM_WINDOW_BLOCKS,
  MAX_EVM_WINDOW_TARGETS,
  MAX_EVM_WINDOW_TXS,
  OPEN_EVM_WINDOW_TYPE_URL,
  evmWindowCost,
} from "@qorechain/evm";
import { closeEvmWindowMsg, openEvmWindowMsg, qorechainTypes } from "@qorechain/sdk";
import { getAddress, isAddress } from "viem";

/** Gas one approve(spender, 0) or setApprovalForAll(operator, false) may use. */
export const REVOKE_GAS_LIMIT = 80_000n;
/** Testnet block time measured by the QoreChain docs (about 1.3 s). */
export const TESTNET_BLOCK_SECONDS = 1.3;

export interface RevokeWindowInput {
  /** Token contracts the batch will call (duplicates are removed). */
  tokenContracts: readonly string[];
  /** Number of revoke transactions in the batch. */
  revokeCount: number;
  /** Highest maxFeePerGas (wei) the EVM wallet may use for each revoke. */
  maxFeePerGasWei: bigint;
  /** How long the window stays open. Defaults to 10 minutes. */
  minutes?: number;
  /** Extra fee headroom in percent. Defaults to 20. */
  marginPercent?: number;
  /** Seconds per block. Defaults to the testnet figure. */
  blockSeconds?: number;
}

export interface RevokeWindowPlan {
  allowedTargets: `0x${string}`[];
  maxTxs: number;
  /** uqor: value plus maximum fee of every transaction, with margin. */
  maxValueUqor: bigint;
  blocks: number;
}

export class RevokeWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevokeWindowError";
  }
}

export function planRevokeWindow(input: RevokeWindowInput): RevokeWindowPlan {
  const { revokeCount, maxFeePerGasWei } = input;
  const minutes = input.minutes ?? 10;
  const marginPercent = input.marginPercent ?? 20;
  const blockSeconds = input.blockSeconds ?? TESTNET_BLOCK_SECONDS;

  if (!Number.isInteger(revokeCount) || revokeCount < 1) {
    throw new RevokeWindowError("Pick at least one approval to revoke.");
  }
  if (revokeCount > Number(MAX_EVM_WINDOW_TXS)) {
    throw new RevokeWindowError(`A window admits at most ${MAX_EVM_WINDOW_TXS} transactions.`);
  }
  if (maxFeePerGasWei <= 0n) {
    throw new RevokeWindowError("The fee per gas must be above zero.");
  }
  if (!(minutes > 0) || !(blockSeconds > 0) || marginPercent < 0) {
    throw new RevokeWindowError("Window duration, block time and margin must be positive.");
  }

  const seen = new Set<string>();
  const allowedTargets: `0x${string}`[] = [];
  for (const raw of input.tokenContracts) {
    if (!isAddress(raw, { strict: false })) {
      throw new RevokeWindowError(`Not a contract address: ${raw}`);
    }
    const checksummed = getAddress(raw);
    if (!seen.has(checksummed)) {
      seen.add(checksummed);
      allowedTargets.push(checksummed);
    }
  }
  if (allowedTargets.length === 0) {
    throw new RevokeWindowError("The batch names no token contract.");
  }
  if (allowedTargets.length > Number(MAX_EVM_WINDOW_TARGETS)) {
    throw new RevokeWindowError(
      `A window can list at most ${MAX_EVM_WINDOW_TARGETS} contracts. Revoke in smaller batches.`,
    );
  }
  if (allowedTargets.length > revokeCount) {
    throw new RevokeWindowError("Every listed contract needs at least one revoke.");
  }

  const perTx = evmWindowCost({ gas: REVOKE_GAS_LIMIT, maxFeePerGas: maxFeePerGasWei });
  const base = perTx * BigInt(revokeCount);
  const maxValueUqor = base + (base * BigInt(marginPercent) + 99n) / 100n;

  const blocks = Math.min(Number(MAX_EVM_WINDOW_BLOCKS), Math.max(1, Math.ceil((minutes * 60) / blockSeconds)));

  return { allowedTargets, maxTxs: revokeCount, maxValueUqor, blocks };
}

/** A message in the shape QoreX `signAndBroadcast` takes: type URL + protobuf bytes. */
export interface EncodedMessage {
  typeUrl: string;
  value: Uint8Array;
}

const pqcTypes = qorechainTypes.pqc;

/** MsgOpenEVMWindow for `sender` (its qor1 address), encoded for QoreX. */
export function encodeOpenWindow(sender: string, plan: RevokeWindowPlan): EncodedMessage {
  const msg = openEvmWindowMsg({
    sender,
    blocks: plan.blocks,
    maxTxs: plan.maxTxs,
    maxValue: plan.maxValueUqor.toString(),
    allowedTargets: plan.allowedTargets,
  });
  const value = pqcTypes.MsgOpenEVMWindow.encode(pqcTypes.MsgOpenEVMWindow.fromPartial(msg.value)).finish();
  return { typeUrl: OPEN_EVM_WINDOW_TYPE_URL, value };
}

/** MsgCloseEVMWindow for `sender`, encoded for QoreX. */
export function encodeCloseWindow(sender: string): EncodedMessage {
  const msg = closeEvmWindowMsg(sender);
  const value = pqcTypes.MsgCloseEVMWindow.encode(pqcTypes.MsgCloseEVMWindow.fromPartial(msg.value)).finish();
  return { typeUrl: CLOSE_EVM_WINDOW_TYPE_URL, value };
}
