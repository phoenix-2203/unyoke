/**
 * Logs are history. Before showing (or revoking) an approval, Unyoke reads
 * what is true on chain right now: the live allowance or operator flag, the
 * token's details, the owner's balance and whether the spender is a contract.
 */
import { type Abi, type Hex, erc20Abi } from "viem";
import type { ApprovalEvent, ApprovalKind } from "./evmApprovalLogs";

export const approvalForAllAbi = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

/** The read calls Unyoke needs (a viem PublicClient fits). */
export interface ChainReader {
  readContract(args: { address: Hex; abi: Abi; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
  getCode(args: { address: Hex }): Promise<Hex | undefined>;
}

export interface TokenInfo {
  name?: string;
  symbol?: string;
  decimals?: number;
}

export interface LiveApproval {
  kind: ApprovalKind;
  token: Hex;
  owner: Hex;
  spender: Hex;
  /** ERC-20: current allowance. Operator: 1n if approved for all. */
  amount: bigint;
  /** Owner's balance of this token right now (ERC-20 base units, or NFT count). */
  balance?: bigint;
  tokenInfo: TokenInfo;
  /** False when the spender address holds no code (an ordinary wallet). */
  spenderIsContract: boolean;
  /** Block of the event that set this approval. */
  setAtBlock: bigint;
  setInTx: Hex | null;
}

async function tryRead<T>(p: Promise<unknown>): Promise<T | undefined> {
  try {
    return (await p) as T;
  } catch {
    return undefined;
  }
}

const tokenInfoCache = new Map<string, Promise<TokenInfo>>();

export function readTokenInfo(reader: ChainReader, token: Hex): Promise<TokenInfo> {
  const key = token.toLowerCase();
  let hit = tokenInfoCache.get(key);
  if (!hit) {
    hit = (async () => {
      const [name, symbol, decimals] = await Promise.all([
        tryRead<string>(reader.readContract({ address: token, abi: erc20Abi, functionName: "name" })),
        tryRead<string>(reader.readContract({ address: token, abi: erc20Abi, functionName: "symbol" })),
        tryRead<number | bigint>(reader.readContract({ address: token, abi: erc20Abi, functionName: "decimals" })),
      ]);
      return { name, symbol, decimals: decimals === undefined ? undefined : Number(decimals) };
    })();
    tokenInfoCache.set(key, hit);
  }
  return hit;
}

/** For tests. */
export function clearTokenInfoCache() {
  tokenInfoCache.clear();
}

/**
 * Check each candidate against the chain. Returns only approvals that are still
 * open (allowance above zero, or operator still approved).
 */
export async function readLiveApprovals(reader: ChainReader, candidates: readonly ApprovalEvent[]): Promise<LiveApproval[]> {
  const results = await Promise.all(
    candidates.map(async (ev): Promise<LiveApproval | null> => {
      let amount: bigint | undefined;
      if (ev.kind === "erc20") {
        amount = await tryRead<bigint>(
          reader.readContract({ address: ev.token, abi: erc20Abi, functionName: "allowance", args: [ev.owner, ev.spender] }),
        );
      } else {
        const ok = await tryRead<boolean>(
          reader.readContract({ address: ev.token, abi: approvalForAllAbi, functionName: "isApprovedForAll", args: [ev.owner, ev.spender] }),
        );
        amount = ok === undefined ? undefined : ok ? 1n : 0n;
      }
      // If the live read fails, fall back to the last logged value rather than hide it.
      const live = amount ?? ev.value;
      if (live === 0n) return null;

      const [tokenInfo, balance, code] = await Promise.all([
        readTokenInfo(reader, ev.token),
        tryRead<bigint>(reader.readContract({ address: ev.token, abi: erc20Abi, functionName: "balanceOf", args: [ev.owner] })),
        tryRead<Hex | undefined>(reader.getCode({ address: ev.spender })),
      ]);
      return {
        kind: ev.kind,
        token: ev.token,
        owner: ev.owner,
        spender: ev.spender,
        amount: live,
        balance,
        tokenInfo,
        spenderIsContract: !!code && code !== "0x",
        setAtBlock: ev.blockNumber,
        setInTx: ev.txHash,
      };
    }),
  );
  return results.filter((r): r is LiveApproval => r !== null);
}
