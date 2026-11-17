import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { LiveApproval } from "./evmApprovalState";
import type { NativePermission } from "./nativePermissions";
import { OLD_APPROVAL_BLOCKS, evmApprovalRisk, nativePermissionRisk, sortByRisk } from "./risk";

const HEAD = 10_000_000n;
const approval = (over: Partial<LiveApproval>): LiveApproval => ({
  kind: "erc20",
  token: "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex,
  owner: "0x1111111111111111111111111111111111111111" as Hex,
  spender: "0x2222222222222222222222222222222222222222" as Hex,
  amount: 5_000_000n,
  balance: 100_000_000n,
  tokenInfo: { symbol: "fUSD", decimals: 6 },
  spenderIsContract: true,
  setAtBlock: HEAD - 10n,
  setInTx: null,
  ...over,
});

describe("evmApprovalRisk", () => {
  it("unlimited is high", () => {
    const r = evmApprovalRisk(approval({ amount: (1n << 256n) - 1n }), HEAD);
    expect(r.level).toBe("high");
    expect(r.reasons[0]).toMatch(/Unlimited/);
  });

  it("an ordinary-wallet spender is high and explained first", () => {
    const r = evmApprovalRisk(approval({ spenderIsContract: false }), HEAD);
    expect(r.level).toBe("high");
    expect(r.reasons[0]).toMatch(/ordinary wallet/);
  });

  it("NFT approve-all is high", () => {
    expect(evmApprovalRisk(approval({ kind: "operator", amount: 1n }), HEAD).level).toBe("high");
  });

  it("covering the whole balance is medium", () => {
    expect(evmApprovalRisk(approval({ amount: 100_000_000n }), HEAD).level).toBe("medium");
  });

  it("old approvals are at least medium", () => {
    const r = evmApprovalRisk(approval({ setAtBlock: HEAD - OLD_APPROVAL_BLOCKS - 1n }), HEAD);
    expect(r.level).toBe("medium");
    expect(r.reasons.join(" ")).toMatch(/week/);
  });

  it("a small, recent approval to a contract is low, never called safe", () => {
    const r = evmApprovalRisk(approval({}), HEAD);
    expect(r.level).toBe("low");
    expect(r.reasons[0]).toMatch(/No strong warning signs/);
    expect(r.reasons.join(" ")).not.toMatch(/\bsafe\b/i);
  });

  it("mentions a zero balance", () => {
    expect(evmApprovalRisk(approval({ balance: 0n }), HEAD).reasons.join(" ")).toMatch(/hold none/);
  });
});

describe("nativePermissionRisk", () => {
  const base = { granter: "qor1a", grantee: "qor1b", expiration: null } as const;

  it("send grants are high", () => {
    const p: NativePermission = { kind: "authz", ...base, authorizationType: "/cosmos.bank.v1beta1.SendAuthorization", msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend", spendLimit: [{ denom: "uqor", amount: "5" }] };
    const r = nativePermissionRisk(p);
    expect(r.level).toBe("high");
    expect(r.reasons).toContain("It never expires.");
  });

  it("unknown grants are treated as dangerous", () => {
    expect(nativePermissionRisk({ kind: "authz", ...base, authorizationType: "/x.Custom" }).level).toBe("high");
  });

  it("vote grants are low, stake grants medium", () => {
    expect(nativePermissionRisk({ kind: "authz", ...base, authorizationType: "g", msgTypeUrl: "/cosmos.gov.v1.MsgVote" }).level).toBe("low");
    expect(nativePermissionRisk({ kind: "authz", ...base, authorizationType: "s", msgTypeUrl: "/cosmos.staking.v1beta1.MsgDelegate" }).level).toBe("medium");
  });

  it("fee grants: no limit is medium, limited is low", () => {
    expect(nativePermissionRisk({ kind: "feegrant", ...base, allowanceType: "b" }).level).toBe("medium");
    expect(nativePermissionRisk({ kind: "feegrant", ...base, allowanceType: "b", spendLimit: [{ denom: "uqor", amount: "1" }] }).level).toBe("low");
  });

  it("live 7702 consent is high", () => {
    expect(nativePermissionRisk({ kind: "eip7702", account: "qor1a", delegate: "0x1", live: true, currentDelegate: "", expiryHeight: 5n }).level).toBe("high");
  });
});

describe("sortByRisk", () => {
  it("puts high first", () => {
    const sorted = sortByRisk([approval({}), approval({ spenderIsContract: false })], (a) => evmApprovalRisk(a, HEAD));
    expect(sorted.map((s) => s.risk.level)).toEqual(["high", "low"]);
  });
});
