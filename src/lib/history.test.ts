import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { ApprovalEvent } from "./evmApprovalLogs";
import { UNYOKE_MEMO, evmRevocations, parseNativeRevocations, readNativeRevocations } from "./history";

const ME = "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu";
const DEAD_QOR = "qor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqph4dpvyp40";
const FUSD = "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex;
const DEAD = "0x000000000000000000000000000000000000dead" as Hex;

const ev = (over: Partial<ApprovalEvent>): ApprovalEvent => ({
  kind: "erc20",
  token: FUSD,
  owner: "0xf1c9948be3910b70224bd4578a154f74c2ab8082" as Hex,
  spender: DEAD,
  value: 0n,
  blockNumber: 1n,
  txHash: "0xaa" as Hex,
  logIndex: 0,
  ...over,
});

describe("evmRevocations", () => {
  it("keeps allowances set to 0 and approve-all turned off, newest first", () => {
    const out = evmRevocations([
      ev({ value: 2n ** 256n - 1n, blockNumber: 5n }),
      ev({ value: 0n, blockNumber: 7n }),
      ev({ kind: "operator", value: 0n, blockNumber: 9n }),
      ev({ kind: "operator", value: 1n, blockNumber: 8n }),
    ]);
    expect(out.map((r) => [r.kind, r.blockNumber])).toEqual([
      ["operator", 9n],
      ["erc20", 7n],
    ]);
  });
});

const tx = (hash: string, height: string, memo: string, messages: Record<string, unknown>[], code = 0) => ({
  txhash: hash,
  height,
  timestamp: "2026-11-17T13:32:50Z",
  code,
  tx: { body: { memo, messages } },
});

const SEARCH = {
  tx_responses: [
    tx("7d4f", "10257694", UNYOKE_MEMO, [
      { "@type": "/cosmos.authz.v1beta1.MsgRevoke", granter: ME, grantee: DEAD_QOR, msg_type_url: "/cosmos.gov.v1.MsgVote" },
    ]),
    tx("6a23", "10257811", "other tool", [{ "@type": "/cosmos.feegrant.v1beta1.MsgRevokeAllowance", granter: ME, grantee: DEAD_QOR }]),
    tx("f36a", "10257664", "", [{ "@type": "/cosmos.authz.v1beta1.MsgGrant", granter: ME, grantee: DEAD_QOR }]),
    tx("dead", "10257900", UNYOKE_MEMO, [{ "@type": "/cosmos.authz.v1beta1.MsgRevoke", granter: ME, grantee: DEAD_QOR }], 5),
  ],
};

describe("parseNativeRevocations", () => {
  it("finds revokes, marks the ones sent through Unyoke, skips grants and failed txs", () => {
    const out = parseNativeRevocations(SEARCH, ME);
    expect(out.map((r) => [r.kind, r.height, r.viaUnyoke])).toEqual([
      ["feegrant", 10257811, false],
      ["authz", 10257694, true],
    ]);
    expect(out[1]).toMatchObject({ grantee: DEAD_QOR, msgTypeUrl: "/cosmos.gov.v1.MsgVote", txHash: "7D4F" });
  });

  it("ignores revokes by another granter in the same transaction", () => {
    const other = { tx_responses: [tx("ab", "1", "", [{ "@type": "/cosmos.authz.v1beta1.MsgRevoke", granter: "qor1other", grantee: DEAD_QOR }])] };
    expect(parseNativeRevocations(other, ME)).toEqual([]);
  });

  it("copes with an empty or odd body", () => {
    expect(parseNativeRevocations(undefined, ME)).toEqual([]);
    expect(parseNativeRevocations({ tx_responses: [{}] }, ME)).toEqual([]);
  });
});

describe("readNativeRevocations", () => {
  it("searches the account's own revokes, one search per revoke type, newest first", async () => {
    const asked: string[] = [];
    const got = await readNativeRevocations("/lcd-testnet/", ME, async (url) => {
      asked.push(decodeURIComponent(url));
      return { ok: true, status: 200, json: async () => SEARCH };
    });
    expect(asked).toHaveLength(3);
    expect(asked.every((u) => u.includes(`message.sender='${ME}' AND message.action='/`) && u.includes("order_by=2"))).toBe(true);
    expect(asked.some((u) => u.includes("message.action='/cosmos.authz.v1beta1.MsgRevoke'"))).toBe(true);
    // the same transaction returned by several searches is listed once
    expect(got).toEqual(parseNativeRevocations(SEARCH, ME));
  });

  it("reports a failed search", async () => {
    await expect(readNativeRevocations("/x", ME, async () => ({ ok: false, status: 500, json: async () => ({}) }))).rejects.toThrow("500");
  });
});
