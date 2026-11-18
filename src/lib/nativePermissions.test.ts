import { describe, expect, it } from "vitest";
import {
  type FetchLike,
  parseAuthzGrants,
  parseDelegationConsent,
  parseFeeGrants,
  readNativePermissions,
  revokeMessageFor,
} from "./nativePermissions";
import { toQorexMessage } from "./qorexMessage";
import { nativePermissionRisk } from "./risk";

const ME = "qor1qef7x5ac8zwq82ckeyg80j9g3ekdpgwczw8lwh";
const THEM = "qor1ju2rkacaxnwmjyctspa3xkhxwkj6jc72k63kvn";

// Shapes as the Cosmos SDK REST gateway returns them.
const authzBody = {
  grants: [
    {
      granter: ME,
      grantee: THEM,
      authorization: { "@type": "/cosmos.bank.v1beta1.SendAuthorization", spend_limit: [{ denom: "uqor", amount: "5000000" }], allow_list: [] },
      expiration: null,
    },
    {
      granter: ME,
      grantee: THEM,
      authorization: { "@type": "/cosmos.authz.v1beta1.GenericAuthorization", msg: "/cosmos.gov.v1.MsgVote" },
      expiration: "2027-01-01T00:00:00Z",
    },
    {
      granter: ME,
      grantee: THEM,
      authorization: {
        "@type": "/cosmos.staking.v1beta1.StakeAuthorization",
        authorization_type: "AUTHORIZATION_TYPE_DELEGATE",
        max_tokens: null,
      },
      expiration: null,
    },
  ],
  pagination: { next_key: null, total: "3" },
};
const feeBody = {
  allowances: [
    {
      granter: ME,
      grantee: THEM,
      allowance: {
        "@type": "/cosmos.feegrant.v1beta1.AllowedMsgAllowance",
        allowance: { "@type": "/cosmos.feegrant.v1beta1.BasicAllowance", spend_limit: [{ denom: "uqor", amount: "100" }], expiration: null },
        allowed_messages: ["/cosmos.bank.v1beta1.MsgSend"],
      },
    },
  ],
};
const consentBody = { found: true, live: true, delegate: "0xabc", granted_height: "5", expiry_height: "900", current_delegate: "", nonce: "3" };

describe("parsing", () => {
  it("reads authz grants and the message type each covers", () => {
    const g = parseAuthzGrants(authzBody);
    expect(g.map((x) => x.msgTypeUrl)).toEqual([
      "/cosmos.bank.v1beta1.MsgSend",
      "/cosmos.gov.v1.MsgVote",
      "/cosmos.staking.v1beta1.MsgDelegate",
    ]);
    expect(g[0]!.spendLimit).toEqual([{ denom: "uqor", amount: "5000000" }]);
    expect(g[1]!.expiration).toBe("2027-01-01T00:00:00Z");
  });

  it("unwraps fee allowances", () => {
    expect(parseFeeGrants(feeBody)[0]).toMatchObject({
      allowanceType: "/cosmos.feegrant.v1beta1.AllowedMsgAllowance",
      spendLimit: [{ denom: "uqor", amount: "100" }],
      expiration: null,
    });
  });

  it("reads 7702 consent only when one is stored", () => {
    expect(parseDelegationConsent(ME, consentBody)).toMatchObject({ delegate: "0xabc", live: true, expiryHeight: 900n });
    expect(parseDelegationConsent(ME, { found: false })).toBeNull();
  });
});

describe("readNativePermissions", () => {
  it("reads all three sources for the account", async () => {
    const urls: string[] = [];
    const fake: FetchLike = async (url) => {
      urls.push(url);
      const body = url.includes("/authz/") ? authzBody : url.includes("/feegrant/") ? feeBody : consentBody;
      return { ok: true, status: 200, json: async () => body };
    };
    const all = await readNativePermissions("https://rest.example/", ME, fake);
    expect(all.map((p) => p.kind)).toEqual(["authz", "authz", "authz", "feegrant", "eip7702"]);
    expect(urls[0]).toBe(`https://rest.example/cosmos/authz/v1beta1/grants/granter/${ME}?pagination.limit=200`);
  });

  it("fails loudly when the API errors", async () => {
    const fake: FetchLike = async () => ({ ok: false, status: 501, json: async () => ({}) });
    await expect(readNativePermissions("https://rest.example", ME, fake)).rejects.toThrow(/501/);
  });
});

describe("revokeMessageFor", () => {
  it("builds encodable revoke messages for each kind", () => {
    const perms = [...parseAuthzGrants(authzBody), ...parseFeeGrants(feeBody), parseDelegationConsent(ME, consentBody)!];
    const types = perms.map((p) => toQorexMessage(revokeMessageFor(p)).typeUrl);
    expect(types).toEqual([
      "/cosmos.authz.v1beta1.MsgRevoke",
      "/cosmos.authz.v1beta1.MsgRevoke",
      "/cosmos.authz.v1beta1.MsgRevoke",
      "/cosmos.feegrant.v1beta1.MsgRevokeAllowance",
      "/qorechain.pqc.v1.MsgClearEVMDelegation",
    ]);
  });

  it("refuses an authz grant whose message type is unknown", () => {
    const [g] = parseAuthzGrants({ grants: [{ granter: ME, grantee: THEM, authorization: { "@type": "/x.Custom" }, expiration: null }] });
    expect(() => revokeMessageFor(g!)).toThrow(/can't tell/);
  });
});

describe("unlimited grants", () => {
  it("treats an empty spend_limit as no limit (what the chain returns for an unlimited fee grant)", () => {
    const [g] = parseFeeGrants({
      allowances: [
        {
          granter: "qor1a",
          grantee: "qor1b",
          allowance: { "@type": "/cosmos.feegrant.v1beta1.BasicAllowance", spend_limit: [], expiration: null },
        },
      ],
    });
    expect(g.spendLimit).toBeUndefined();
    expect(nativePermissionRisk(g).level).toBe("medium");
  });
});

