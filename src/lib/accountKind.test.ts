import { describe, expect, it } from "vitest";
import { parseAccountKind, readAccountKind } from "./accountKind";

const acct = (type: string | null) => ({ account: { "@type": "/cosmos.auth.v1beta1.BaseAccount", pub_key: type ? { "@type": type, key: "A0…" } : null } });

describe("parseAccountKind", () => {
  it("tells Ethereum-style, Cosmos-style and not-yet-used accounts apart (real testnet shapes)", () => {
    expect(parseAccountKind(acct("/cosmos.evm.crypto.v1.ethsecp256k1.PubKey"))).toBe("ethereum");
    expect(parseAccountKind(acct("/cosmos.crypto.secp256k1.PubKey"))).toBe("cosmos");
    expect(parseAccountKind(acct(null))).toBe("unknown");
    expect(parseAccountKind(undefined)).toBe("unknown");
  });
});

describe("readAccountKind", () => {
  it("never throws: a missing account or a down node is unknown", async () => {
    expect(await readAccountKind("/x", "qor1a", async () => ({ ok: false, status: 404, json: async () => ({}) }))).toBe("unknown");
    expect(await readAccountKind("/x", "qor1a", async () => { throw new Error("down"); })).toBe("unknown");
  });
});
