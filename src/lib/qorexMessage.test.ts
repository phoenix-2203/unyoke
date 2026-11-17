import { authz, closeEvmWindowMsg, qorechainRegistry } from "@qorechain/sdk";
import { describe, expect, it } from "vitest";
import { toQorexMessage } from "./qorexMessage";

const A = "qor1qef7x5ac8zwq82ckeyg80j9g3ekdpgwczw8lwh";
const B = "qor1ju2rkacaxnwmjyctspa3xkhxwkj6jc72k63kvn";

describe("toQorexMessage", () => {
  it("encodes a Cosmos message to bytes that decode back", () => {
    const msg = authz.revoke({ granter: A, grantee: B, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" });
    const out = toQorexMessage(msg);
    expect(out.typeUrl).toBe("/cosmos.authz.v1beta1.MsgRevoke");
    expect(qorechainRegistry().decode(out)).toMatchObject({ granter: A, grantee: B });
  });

  it("encodes a QoreChain message", () => {
    const out = toQorexMessage(closeEvmWindowMsg(A));
    expect(out.typeUrl).toBe("/qorechain.pqc.v1.MsgCloseEVMWindow");
    expect(out.value.length).toBeGreaterThan(0);
  });

  it("refuses unknown types", () => {
    expect(() => toQorexMessage({ typeUrl: "/made.up.MsgNothing", value: {} })).toThrow(/No protobuf type/);
  });
});
