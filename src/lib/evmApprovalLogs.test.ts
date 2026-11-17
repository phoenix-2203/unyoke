import { type Hex, keccak256, pad, toHex } from "viem";
import { describe, expect, it } from "vitest";
import {
  APPROVAL_FOR_ALL_TOPIC,
  APPROVAL_TOPIC,
  type LogFilter,
  type RawLog,
  decodeApprovalLog,
  latestPerPair,
  scanApprovalEvents,
} from "./evmApprovalLogs";

const OWNER = "0x1111111111111111111111111111111111111111" as Hex;
const SPENDER = "0x2222222222222222222222222222222222222222" as Hex;
const TOKEN = "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex;
const NFT = "0x3333333333333333333333333333333333333333" as Hex;
const MAX = (1n << 256n) - 1n;

const t = (a: Hex) => pad(a, { size: 32 });
const erc20Log = (value: bigint, block: bigint, logIndex = 0, token = TOKEN): RawLog => ({
  address: token,
  topics: [APPROVAL_TOPIC, t(OWNER), t(SPENDER)],
  data: toHex(value, { size: 32 }),
  blockNumber: block,
  transactionHash: `0x${"ab".repeat(32)}`,
  logIndex,
});
const operatorLog = (approved: boolean, block: bigint): RawLog => ({
  address: NFT,
  topics: [APPROVAL_FOR_ALL_TOPIC, t(OWNER), t(SPENDER)],
  data: toHex(approved ? 1n : 0n, { size: 32 }),
  blockNumber: toHex(block),
  transactionHash: null,
  logIndex: "0x1",
});

describe("event topics", () => {
  it("match the event signatures", () => {
    expect(keccak256(toHex("Approval(address,address,uint256)"))).toBe(APPROVAL_TOPIC);
    expect(keccak256(toHex("ApprovalForAll(address,address,bool)"))).toBe(APPROVAL_FOR_ALL_TOPIC);
  });
});

describe("decodeApprovalLog", () => {
  it("reads an ERC-20 approval", () => {
    expect(decodeApprovalLog(erc20Log(MAX, 7n))).toMatchObject({
      kind: "erc20",
      token: TOKEN,
      owner: OWNER,
      spender: SPENDER,
      value: MAX,
      blockNumber: 7n,
    });
  });

  it("reads an NFT approve-all, hex block numbers included", () => {
    expect(decodeApprovalLog(operatorLog(true, 12n))).toMatchObject({ kind: "operator", value: 1n, blockNumber: 12n, logIndex: 1 });
    expect(decodeApprovalLog(operatorLog(false, 12n))?.value).toBe(0n);
  });

  it("skips ERC-721 per-token approvals and unrelated logs", () => {
    const perToken: RawLog = { ...erc20Log(0n, 1n), topics: [APPROVAL_TOPIC, t(OWNER), t(SPENDER), toHex(5n, { size: 32 })], data: "0x" };
    expect(decodeApprovalLog(perToken)).toBeNull();
    expect(decodeApprovalLog({ ...erc20Log(1n, 1n), topics: [keccak256(toHex("Transfer(address,address,uint256)")), t(OWNER), t(SPENDER)] })).toBeNull();
  });
});

describe("scanApprovalEvents", () => {
  it("reads the range in chunks of at most 10,000 blocks, filtered by owner", async () => {
    const calls: LogFilter[] = [];
    const events = await scanApprovalEvents({
      owner: OWNER,
      fromBlock: 100n,
      toBlock: 25_099n,
      getLogs: async (f) => {
        calls.push(f);
        return f.fromBlock === 100n ? [erc20Log(5n, 150n)] : [];
      },
    });
    expect(calls.map((c) => [c.fromBlock, c.toBlock])).toEqual([
      [100n, 10_099n],
      [10_100n, 20_099n],
      [20_100n, 25_099n],
    ]);
    expect(calls[0]!.topics).toEqual([[APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC], t(OWNER)]);
    expect(events).toHaveLength(1);
  });

  it("reports progress and can be stopped", async () => {
    const seen: bigint[] = [];
    const ctrl = new AbortController();
    await expect(
      scanApprovalEvents({
        owner: OWNER,
        fromBlock: 0n,
        toBlock: 29_999n,
        getLogs: async () => [],
        onProgress: (done) => {
          seen.push(done);
          if (done >= 9_999n) ctrl.abort();
        },
        signal: ctrl.signal,
      }),
    ).rejects.toThrow(/stopped/);
    expect(seen).toEqual([9_999n]);
  });

  it("refuses oversized chunks", async () => {
    await expect(scanApprovalEvents({ owner: OWNER, fromBlock: 0n, toBlock: 1n, chunkSize: 20_000n, getLogs: async () => [] })).rejects.toThrow();
  });
});

describe("latestPerPair", () => {
  it("keeps the newest event per token and spender", () => {
    const evs = [erc20Log(MAX, 10n), erc20Log(0n, 20n), erc20Log(9n, 20n, 3), erc20Log(1n, 5n, 0, NFT)].map(
      (l) => decodeApprovalLog(l)!,
    );
    const latest = latestPerPair(evs);
    expect(latest).toHaveLength(2);
    expect(latest.find((e) => e.token === TOKEN)?.value).toBe(9n);
  });
});
