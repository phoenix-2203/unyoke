import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { LiveApproval } from "./evmApprovalState";
import { describeEvmRevoke, evmRevokeCall, parseWindowEvidence, permissionKey, windowAllowsTx } from "./revoke";

const base: LiveApproval = {
  kind: "erc20",
  token: "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex,
  owner: "0x1111111111111111111111111111111111111111" as Hex,
  spender: "0x2222222222222222222222222222222222222222" as Hex,
  amount: 5n,
  tokenInfo: { symbol: "fUSD" },
  spenderIsContract: true,
  setAtBlock: 1n,
  setInTx: null,
};

describe("evmRevokeCall", () => {
  it("ERC-20: approve(spender, 0) on the token", () => {
    const c = evmRevokeCall(base);
    expect(c.functionName).toBe("approve");
    expect(c.address).toBe("0x97143B771D34ddb9130b807b135Ae675A5a963CA");
    expect(c.args).toEqual(["0x2222222222222222222222222222222222222222", 0n]);
  });

  it("NFT: setApprovalForAll(operator, false)", () => {
    const c = evmRevokeCall({ ...base, kind: "operator", amount: 1n });
    expect(c.functionName).toBe("setApprovalForAll");
    expect(c.args[1]).toBe(false);
  });

  it("describes the call in words", () => {
    expect(describeEvmRevoke(base, "fUSD")).toBe("approve(0x2222222222222222222222222222222222222222, 0) on fUSD");
  });
});

describe("permissionKey", () => {
  it("is stable and case-insensitive", () => {
    expect(permissionKey({ kind: "erc20", token: "0xAB", spender: "0xCD" })).toBe(permissionKey({ kind: "erc20", token: "0xab", spender: "0xcd" }));
  });
});

describe("parseWindowEvidence", () => {
  // The shape the chain returned during the spike (docs/SPIKE_RESULTS.md).
  const record = {
    found: true,
    live: false,
    opened_height: "10250034",
    expiry_height: "10250134",
    max_txs: "1",
    used_txs: "1",
    allowed_targets: ["0x97143b771d34ddb9130b807b135ae675a5a963ca"],
  };

  it("recognises QoreX's one-transaction window limited to the token", () => {
    expect(parseWindowEvidence(record, base.token)).toMatchObject({ found: true, maxTxs: 1, usedTxs: 1, tight: true, openedHeight: 10250034 });
  });

  it("flags a wide window", () => {
    expect(parseWindowEvidence({ ...record, allowed_targets: [], max_txs: "20" }, base.token).tight).toBe(false);
  });
});

describe("windowAllowsTx", () => {
  const FUSD = "0x97143B771D34ddb9130b807b135Ae675A5a963CA";
  const open = { found: true, live: true, remaining_txs: "1", remaining_blocks: "40", allowed_targets: [FUSD.toLowerCase()] };
  it("allows a live window with room, for its target", () => {
    expect(windowAllowsTx(open, FUSD)).toBe(true);
    expect(windowAllowsTx({ ...open, allowed_targets: [] }, FUSD)).toBe(true);
  });
  it("refuses a used-up, expired, missing or wrong-target window", () => {
    expect(windowAllowsTx({ ...open, remaining_txs: "0" }, FUSD)).toBe(false);
    expect(windowAllowsTx({ ...open, live: false }, FUSD)).toBe(false);
    expect(windowAllowsTx({ found: false }, FUSD)).toBe(false);
    expect(windowAllowsTx({ ...open, allowed_targets: ["0x02292293c13880a26242690eb70a0e42b8e91c28"] }, FUSD)).toBe(false);
    expect(windowAllowsTx(undefined, FUSD)).toBe(false);
  });
});
