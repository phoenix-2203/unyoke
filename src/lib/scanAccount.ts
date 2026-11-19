/**
 * One scan of a QoreChain account: every standing permission it has granted,
 * on both lanes.
 *
 * - EVM lane: ERC-20 approvals and NFT approve-all, from logs, then checked live.
 * - Native lane: authz grants, fee grants, EIP-7702 consent, from REST.
 *
 * The public testnet node keeps only recent history, so the EVM part can only
 * see approvals made since its lowest kept block. The result says where that
 * is, so the UI can be honest about it.
 */
import { type Hex, toHex } from "viem";
import { type AccountKind, readAccountKind } from "./accountKind";
import { type AccountAddresses, parseAccount } from "./address";
import { type GetLogs, earliestLogBlock, latestPerPair, scanApprovalEvents } from "./evmApprovalLogs";
import { type ChainReader, type LiveApproval, readLiveApprovals, readTokenInfo } from "./evmApprovalState";
import { type EvmRevocation, type NativeRevocation, evmRevocations, readNativeRevocations } from "./history";
import { type FetchLike, type NativePermission, readNativePermissions } from "./nativePermissions";
import { type PqcKeyStatus, readPqcKey } from "./pqcKey";

/** What the scan needs from an EVM JSON-RPC client (a viem PublicClient fits). */
export interface EvmClient extends ChainReader {
  getBlockNumber(): Promise<bigint>;
  request(args: { method: "eth_getLogs"; params: [unknown] }): Promise<unknown>;
}

export interface ScanProgress {
  stage: "history" | "evm" | "live" | "native" | "done";
  blocksDone?: bigint;
  blocksTotal?: bigint;
}

export interface ScanResult {
  account: AccountAddresses;
  /** Ethereum-style accounts can have token approvals; Cosmos-style ones can't sign EVM transactions. */
  accountKind: AccountKind;
  /** The post-quantum signature key, read through PqcKeyCheck; absent when it couldn't be read. */
  pqcKey?: PqcKeyStatus;
  evm: LiveApproval[];
  native: NativePermission[];
  /** First and last block whose EVM logs were read. */
  scannedFrom: bigint;
  scannedTo: bigint;
  /** True when the node had pruned history older than scannedFrom. */
  historyLimited: boolean;
  /** Set when one lane failed; the other lane's results are still returned. */
  evmError?: string;
  nativeError?: string;
  /** Permissions removed in the past (any tool), newest first, as far back as the node keeps history. */
  history: { evm: EvmRevocation[]; native: NativeRevocation[]; nativeError?: string };
}

export interface ScanOptions {
  input: string;
  evm: EvmClient;
  /** Native REST base URL (through a CORS proxy in the browser). */
  rest: string;
  fetchFn?: FetchLike;
  /** Start block; defaults to the earliest block the node still serves. */
  fromBlock?: bigint;
  concurrency?: number;
  onProgress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
}

export function getLogsFrom(client: Pick<EvmClient, "request">): GetLogs {
  return async (f) =>
    (await client.request({
      method: "eth_getLogs",
      params: [{ fromBlock: toHex(f.fromBlock), toBlock: toHex(f.toBlock), topics: f.topics }],
    })) as Awaited<ReturnType<GetLogs>>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function scanAccount(opts: ScanOptions): Promise<ScanResult> {
  const account = parseAccount(opts.input);
  const progress = opts.onProgress ?? (() => {});
  const getLogs = getLogsFrom(opts.evm);

  const nativePromise = readNativePermissions(opts.rest, account.qor, opts.fetchFn).then(
    (native) => ({ native }),
    (e) => ({ native: [] as NativePermission[], nativeError: message(e) }),
  );

  const kindPromise = readAccountKind(opts.rest, account.qor, opts.fetchFn);
  const pqcKeyPromise = readPqcKey(opts.evm, account.evm as Hex);
  const nativeHistoryPromise = readNativeRevocations(opts.rest, account.qor, opts.fetchFn).then(
    (native) => ({ native }),
    (e) => ({ native: [] as NativeRevocation[], nativeError: message(e) }),
  );

  progress({ stage: "history" });
  let scannedFrom = 0n;
  let scannedTo = 0n;
  let historyLimited = false;
  let evm: LiveApproval[] = [];
  let evmError: string | undefined;
  let evmHistory: EvmRevocation[] = [];
  try {
    const [head, earliest] = await Promise.all([opts.evm.getBlockNumber(), earliestLogBlock(getLogs)]);
    scannedTo = head;
    scannedFrom = opts.fromBlock !== undefined && opts.fromBlock > earliest ? opts.fromBlock : earliest;
    historyLimited = earliest > 1n;
    const events = await scanApprovalEvents({
      getLogs,
      owner: account.evm.toLowerCase() as Hex,
      fromBlock: scannedFrom,
      toBlock: scannedTo,
      concurrency: opts.concurrency,
      signal: opts.signal,
      onProgress: (blocksDone, blocksTotal) => progress({ stage: "evm", blocksDone, blocksTotal }),
    });
    progress({ stage: "live" });
    evm = await readLiveApprovals(opts.evm, latestPerPair(events));
    evmHistory = await Promise.all(
      evmRevocations(events).map(async (r) => ({ ...r, tokenSymbol: (await readTokenInfo(opts.evm, r.token)).symbol })),
    );
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    evmError = message(e);
  }

  progress({ stage: "native" });
  const nativeResult = await nativePromise;
  const nativeHistory = await nativeHistoryPromise;
  const accountKind = await kindPromise;
  const pqcKey = await pqcKeyPromise;
  progress({ stage: "done" });
  return {
    account,
    accountKind,
    pqcKey,
    evm,
    scannedFrom,
    scannedTo,
    historyLimited,
    evmError,
    ...nativeResult,
    history: { evm: evmHistory, ...nativeHistory },
  };
}
