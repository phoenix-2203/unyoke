import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { LiveApproval } from "./evmApprovalState";
import type { NativePermission } from "./nativePermissions";
import { evmRow, nativeRow, selectRows } from "./permissionRows";

const HEAD = 10_000_000n;
const approval = (over: Partial<LiveApproval>): LiveApproval => ({
  kind: "erc20",
  token: "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex,
  owner: "0x1111111111111111111111111111111111111111" as Hex,
  spender: "0x000000000000000000000000000000000000dead" as Hex,
  amount: (1n << 256n) - 1n,
  balance: 1_250_000_000n,
  tokenInfo: { symbol: "fUSD", decimals: 6 },
  spenderIsContract: false,
  setAtBlock: HEAD - 10n,
  setInTx: null,
  ...over,
});
const base = { granter: "qor1granter", grantee: "qor1grantee00000000000000000000000000dead", expiration: null };
const send: NativePermission = { kind: "authz", ...base, authorizationType: "/cosmos.bank.v1beta1.SendAuthorization", msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend", spendLimit: [{ denom: "uqor", amount: "5000000" }] };
const vote: NativePermission = { kind: "authz", ...base, authorizationType: "/cosmos.authz.v1beta1.GenericAuthorization", msgTypeUrl: "/cosmos.gov.v1.MsgVote" };
const fees: NativePermission = { kind: "feegrant", ...base, allowanceType: "/cosmos.feegrant.v1beta1.BasicAllowance" };

// The sample account's four open permissions.
const rows = [evmRow(approval({}), HEAD), nativeRow(send), nativeRow(vote), nativeRow(fees)];

describe("permission rows", () => {
  it("describe each permission in one line", () => {
    expect(rows[0]).toMatchObject({ lane: "evm", title: "fUSD", sub: "Token approval", holderSub: "ordinary wallet", level: "high" });
    expect(rows[0]!.allowance).toMatch(/nlimited/);
    expect(rows[1]).toMatchObject({ lane: "native", title: "Authz grant", sub: "MsgSend", allowance: "up to 5 QOR", allowanceSub: "never expires" });
    expect(rows[2]).toMatchObject({ title: "Authz grant", sub: "MsgVote", level: "low" });
    expect(rows[3]).toMatchObject({ title: "Fee grant", allowance: "no limit" });
  });

  it("rank high risk first, across both lanes", () => {
    expect(selectRows(rows).map((r) => r.level)).toEqual(["high", "high", "medium", "low"]);
  });

  it("filter by lane or high risk", () => {
    expect(selectRows(rows, { lane: "evm" })).toHaveLength(1);
    expect(selectRows(rows, { lane: "native" })).toHaveLength(3);
    expect(selectRows(rows, { lane: "high" }).every((r) => r.level === "high")).toBe(true);
  });

  it("search the token, the grant and the holder's full address", () => {
    expect(selectRows(rows, { text: "fusd" }).map((r) => r.title)).toEqual(["fUSD"]);
    expect(selectRows(rows, { text: "MsgVote" })).toHaveLength(1);
    expect(selectRows(rows, { text: "dead" })).toHaveLength(4);
    expect(selectRows(rows, { text: "nothing like this" })).toHaveLength(0);
  });

  it("sort by holder or lane, keeping risk order inside each", () => {
    expect(selectRows(rows, { sort: "lane" })[0]!.lane).toBe("evm");
    const byHolder = selectRows(rows, { sort: "holder" });
    expect(byHolder[0]!.holderFull <= byHolder.at(-1)!.holderFull).toBe(true);
  });
});
