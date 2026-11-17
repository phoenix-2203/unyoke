import { describe, expect, it } from "vitest";
import { basicAllowance, genericAuthorization, sendAuthorization } from "./grantEncoding";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

describe("grant encoders", () => {
  it("GenericAuthorization: field 1 = msg", () => {
    const a = genericAuthorization("/x.Y");
    expect(a.typeUrl).toBe("/cosmos.authz.v1beta1.GenericAuthorization");
    expect(hex(a.value)).toBe("0a042f782e59");
  });

  it("SendAuthorization: field 1 = Coin { denom, amount }", () => {
    // 0a 0b | 0a 04 "uqor" | 12 03 "500"
    expect(hex(sendAuthorization("uqor", "500").value)).toBe("0a0b0a0475716f72120335303" + "0");
  });

  it("BasicAllowance with and without a limit", () => {
    expect(hex(basicAllowance("uqor", "1000").value)).toBe("0a0c0a0475716f7212043130303" + "0");
    expect(basicAllowance().value.length).toBe(0);
  });
});
