import type { Hex } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApprovalEvent } from "./evmApprovalLogs";
import { type ChainReader, clearTokenInfoCache, readLiveApprovals } from "./evmApprovalState";

const OWNER = "0x1111111111111111111111111111111111111111" as Hex;
const DEX = "0x2222222222222222222222222222222222222222" as Hex;
const WALLET = "0x4444444444444444444444444444444444444444" as Hex;
const FUSD = "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex;
const NFT = "0x3333333333333333333333333333333333333333" as Hex;

const ev = (over: Partial<ApprovalEvent>): ApprovalEvent => ({
  kind: "erc20",
  token: FUSD,
  owner: OWNER,
  spender: DEX,
  value: 5n,
  blockNumber: 10n,
  txHash: null,
  logIndex: 0,
  ...over,
});

/** A fake chain: fUSD has allowances to DEX (open) and WALLET (revoked); the NFT has DEX approved for all. */
function fakeReader(opts: { failAllowance?: boolean } = {}): ChainReader {
  return {
    async readContract({ address, functionName, args }) {
      if (address === FUSD) {
        if (functionName === "name") return "FestUSD";
        if (functionName === "symbol") return "fUSD";
        if (functionName === "decimals") return 6;
        if (functionName === "balanceOf") return 250_000_000n;
        if (functionName === "allowance") {
          if (opts.failAllowance) throw new Error("rpc down");
          return args?.[1] === DEX ? 2n ** 256n - 1n : 0n;
        }
      }
      if (address === NFT) {
        if (functionName === "isApprovedForAll") return true;
        if (functionName === "balanceOf") return 3n;
        throw new Error("not an ERC-20");
      }
      throw new Error(`unexpected ${functionName}`);
    },
    async getCode({ address }) {
      return address === DEX ? "0x6080" : undefined;
    },
  };
}

describe("readLiveApprovals", () => {
  beforeEach(() => clearTokenInfoCache());

  it("keeps only approvals still open on chain and enriches them", async () => {
    const live = await readLiveApprovals(fakeReader(), [ev({}), ev({ spender: WALLET, value: 7n })]);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      spender: DEX,
      amount: 2n ** 256n - 1n,
      balance: 250_000_000n,
      tokenInfo: { name: "FestUSD", symbol: "fUSD", decimals: 6 },
      spenderIsContract: true,
    });
  });

  it("reads NFT approve-all and marks plain-wallet spenders", async () => {
    const live = await readLiveApprovals(fakeReader(), [ev({ kind: "operator", token: NFT, spender: WALLET, value: 1n })]);
    expect(live[0]).toMatchObject({ kind: "operator", amount: 1n, spenderIsContract: false, tokenInfo: { decimals: undefined } });
  });

  it("falls back to the logged value when the live read fails", async () => {
    const live = await readLiveApprovals(fakeReader({ failAllowance: true }), [ev({ value: 42n })]);
    expect(live[0]?.amount).toBe(42n);
  });
});
