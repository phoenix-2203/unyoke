import { type Hex, pad, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { APPROVAL_TOPIC } from "./evmApprovalLogs";
import { type EvmClient, scanAccount } from "./scanAccount";

const OWNER = "0xF1C9948Be3910B70224bD4578A154f74c2aB8082";
const SPENDER = "0x2222222222222222222222222222222222222222" as Hex;
const FUSD = "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex;
const MAX = (1n << 256n) - 1n;

function fakeEvm(opts: { pruneBelow?: bigint; failLogs?: boolean } = {}): EvmClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async getBlockNumber() {
      return 25_000n;
    },
    async request({ params }) {
      const f = params[0] as { fromBlock: Hex; toBlock: Hex };
      calls.push(f);
      if (opts.failLogs) throw new Error("rpc down");
      const from = BigInt(f.fromBlock);
      if (opts.pruneBelow && from < opts.pruneBelow) {
        throw new Error(`height ${from} is not available, lowest height is ${opts.pruneBelow}`);
      }
      if (from <= 20_000n && BigInt(f.toBlock) >= 20_000n) {
        return [
          {
            address: FUSD,
            topics: [APPROVAL_TOPIC, pad(OWNER.toLowerCase() as Hex, { size: 32 }), pad(SPENDER, { size: 32 })],
            data: toHex(MAX, { size: 32 }),
            blockNumber: toHex(20_000n),
            transactionHash: `0x${"cd".repeat(32)}`,
            logIndex: "0x0",
          },
        ];
      }
      return [];
    },
    async readContract({ functionName }) {
      if (functionName === "allowance") return MAX;
      if (functionName === "symbol") return "fUSD";
      if (functionName === "decimals") return 6;
      if (functionName === "name") return "FestUSD";
      if (functionName === "balanceOf") return 9_000_000n;
      throw new Error(functionName);
    },
    async getCode() {
      return "0x60";
    },
  };
}

const emptyNative = async (url: string) => ({
  ok: true,
  status: 200,
  json: async () => (url.includes("authz") ? { grants: [] } : url.includes("feegrant") ? { allowances: [] } : { found: false }),
});

describe("scanAccount", () => {
  it("finds a live unlimited approval and reports where history starts", async () => {
    const evm = fakeEvm({ pruneBelow: 15_000n });
    const stages: string[] = [];
    const r = await scanAccount({
      input: OWNER,
      evm,
      rest: "https://rest.example",
      fetchFn: emptyNative,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(r.account.qor).toBe("qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu");
    expect(r.scannedFrom).toBe(15_000n);
    expect(r.scannedTo).toBe(25_000n);
    expect(r.historyLimited).toBe(true);
    expect(r.evm).toHaveLength(1);
    expect(r.evm[0]).toMatchObject({ token: FUSD, spender: SPENDER, amount: MAX, tokenInfo: { symbol: "fUSD" } });
    expect(r.native).toEqual([]);
    expect(stages[0]).toBe("history");
    expect(stages.at(-1)).toBe("done");
  });

  it("still returns the native lane when the EVM lane fails", async () => {
    const r = await scanAccount({ input: OWNER, evm: fakeEvm({ failLogs: true }), rest: "https://rest.example", fetchFn: emptyNative });
    expect(r.evmError).toMatch(/rpc down/);
    expect(r.nativeError).toBeUndefined();
  });

  it("still returns the EVM lane when the native lane fails", async () => {
    const r = await scanAccount({
      input: OWNER,
      evm: fakeEvm(),
      rest: "https://rest.example",
      fetchFn: async () => ({ ok: false, status: 502, json: async () => ({}) }),
    });
    expect(r.evm).toHaveLength(1);
    expect(r.nativeError).toMatch(/502/);
  });
});
