/**
 * Finding the approvals an account has granted on QoreChain's EVM lane, from
 * event logs.
 *
 * - ERC-20 `Approval(owner indexed, spender indexed, value)`: 3 topics + data.
 * - ERC-721 / ERC-1155 `ApprovalForAll(owner indexed, operator indexed, bool)`.
 *
 * The public node answers eth_getLogs for at most 10,000 blocks per call
 * (docs: Networks), so the range is read in chunks. Logs only tell the
 * history: the latest event per (token, spender) is a candidate, and the
 * current on-chain state is checked separately (see evmApprovalState.ts).
 */
import { type Hex, pad } from "viem";

/** keccak256("Approval(address,address,uint256)"), shared by ERC-20 and ERC-721. */
export const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925" as const;
/** keccak256("ApprovalForAll(address,address,bool)"). */
export const APPROVAL_FOR_ALL_TOPIC = "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31" as const;
/** Largest block range the public QoreChain EVM endpoints accept per eth_getLogs. */
export const MAX_LOG_RANGE = 10_000n;

export interface RawLog {
  address: Hex;
  topics: Hex[];
  data: Hex;
  blockNumber: Hex | bigint | null;
  transactionHash: Hex | null;
  logIndex: Hex | number | null;
}

export interface LogFilter {
  fromBlock: bigint;
  toBlock: bigint;
  topics: (Hex | Hex[] | null)[];
}

/** Anything that can run eth_getLogs (a viem client, a test double). */
export type GetLogs = (filter: LogFilter) => Promise<RawLog[]>;

export type ApprovalKind = "erc20" | "operator";

export interface ApprovalEvent {
  kind: ApprovalKind;
  token: Hex;
  owner: Hex;
  /** Spender (ERC-20) or operator (NFT "approve all"). */
  spender: Hex;
  /** ERC-20: amount as logged. Operator: 1n approved, 0n revoked. */
  value: bigint;
  blockNumber: bigint;
  txHash: Hex | null;
  logIndex: number;
}

const toBig = (v: Hex | bigint | null): bigint => (v === null ? 0n : typeof v === "bigint" ? v : BigInt(v));
const toNum = (v: Hex | number | null): number => (v === null ? 0 : typeof v === "number" ? v : Number(BigInt(v)));
const topicToAddress = (t: Hex): Hex => `0x${t.slice(-40)}` as Hex;

/** Turn a raw log into an approval event, or null if it is not one we track. */
export function decodeApprovalLog(log: RawLog): ApprovalEvent | null {
  const [t0, t1, t2] = log.topics;
  if (!t0 || !t1 || !t2) return null;
  const base = {
    token: log.address.toLowerCase() as Hex,
    owner: topicToAddress(t1).toLowerCase() as Hex,
    spender: topicToAddress(t2).toLowerCase() as Hex,
    blockNumber: toBig(log.blockNumber),
    txHash: log.transactionHash,
    logIndex: toNum(log.logIndex),
  };
  if (t0.toLowerCase() === APPROVAL_TOPIC) {
    // ERC-721 Approval has a 4th indexed topic (tokenId) and no data: per-token
    // approvals are cleared on transfer, so Unyoke tracks ERC-20 only here.
    if (log.topics.length !== 3 || log.data === "0x") return null;
    return { kind: "erc20", ...base, value: BigInt(log.data) };
  }
  if (t0.toLowerCase() === APPROVAL_FOR_ALL_TOPIC) {
    return { kind: "operator", ...base, value: BigInt(log.data) === 0n ? 0n : 1n };
  }
  return null;
}

export interface ScanOptions {
  getLogs: GetLogs;
  owner: Hex;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
  /** How many chunks to request at once. Default 4. */
  concurrency?: number;
  /** Called as chunks finish with the number of blocks read so far and the total. */
  onProgress?: (blocksDone: bigint, blocksTotal: bigint) => void;
  /** Stop early. */
  signal?: AbortSignal;
}

/** Read every approval event `owner` emitted in [fromBlock, toBlock], chunk by chunk. */
export async function scanApprovalEvents(opts: ScanOptions): Promise<ApprovalEvent[]> {
  const chunk = opts.chunkSize ?? MAX_LOG_RANGE;
  if (chunk < 1n || chunk > MAX_LOG_RANGE) throw new Error(`chunkSize must be 1..${MAX_LOG_RANGE}`);
  if (opts.toBlock < opts.fromBlock) return [];

  const ranges: [bigint, bigint][] = [];
  for (let start = opts.fromBlock; start <= opts.toBlock; start += chunk) {
    ranges.push([start, start + chunk - 1n < opts.toBlock ? start + chunk - 1n : opts.toBlock]);
  }
  const total = opts.toBlock - opts.fromBlock + 1n;
  const ownerTopic = pad(opts.owner.toLowerCase() as Hex, { size: 32 });
  const owner = opts.owner.toLowerCase();
  const results: ApprovalEvent[][] = new Array(ranges.length);
  let done = 0n;
  let next = 0;

  const worker = async () => {
    while (next < ranges.length) {
      if (opts.signal?.aborted) throw new Error("Scan stopped.");
      const i = next++;
      const [from, to] = ranges[i]!;
      const logs = await opts.getLogs({ fromBlock: from, toBlock: to, topics: [[APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC], ownerTopic] });
      results[i] = logs.map(decodeApprovalLog).filter((e): e is ApprovalEvent => !!e && e.owner === owner);
      done += to - from + 1n;
      opts.onProgress?.(done, total);
    }
  };
  const n = Math.max(1, Math.min(opts.concurrency ?? 4, ranges.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results.flat();
}

/** Keep the most recent event for each (kind, token, spender). */
export function latestPerPair(events: readonly ApprovalEvent[]): ApprovalEvent[] {
  const byKey = new Map<string, ApprovalEvent>();
  for (const ev of events) {
    const key = `${ev.kind}:${ev.token}:${ev.spender}`;
    const prev = byKey.get(key);
    if (
      !prev ||
      ev.blockNumber > prev.blockNumber ||
      (ev.blockNumber === prev.blockNumber && ev.logIndex > prev.logIndex)
    ) {
      byKey.set(key, ev);
    }
  }
  return [...byKey.values()];
}

/**
 * The public testnet node prunes old blocks: asking for logs below its lowest
 * kept height fails with "... height N is not available, lowest height is M".
 * Approvals set before M cannot be found from logs by anyone using that node.
 */
export function parseLowestAvailableHeight(message: string): bigint | null {
  const m = /lowest height is (\d+)/i.exec(message);
  return m ? BigInt(m[1]!) : null;
}

/**
 * The first block whose logs the node can still serve. Probes block 1; if the
 * node has pruned it, reads the lowest kept height from the error message.
 */
export async function earliestLogBlock(getLogs: GetLogs): Promise<bigint> {
  try {
    await getLogs({ fromBlock: 1n, toBlock: 1n, topics: [APPROVAL_TOPIC] });
    return 1n;
  } catch (e) {
    const lowest = parseLowestAvailableHeight(e instanceof Error ? e.message : String(e));
    if (lowest === null) throw e;
    return lowest;
  }
}
