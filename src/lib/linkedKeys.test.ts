import { describe, expect, it } from "vitest";
import type { FetchLike } from "./nativePermissions";
import { describeLinkedKeys, keyKind, parseLinkedKeys, readLinkedKeys } from "./linkedKeys";

const NOW = 1_795_000_000;
// Shape from the testnet (19 Nov 2026), trimmed.
const key = (over: Record<string, unknown> = {}) => ({
  scheme: "secp256k1",
  pubkey_hex: "b19581eef73012eadbe908b3f3da947e166da6a2",
  permissions: ["evm"],
  expiry_unix: String(NOW + 30 * 86400),
  label: "bill payer",
  created_at_unix: "1794886018",
  revoked: false,
  has_spend_rule: false,
  ...over,
});

describe("parseLinkedKeys", () => {
  it("keeps live keys, counts expired ones, drops revoked ones", () => {
    const k = parseLinkedKeys(
      { authenticators: [key(), key({ expiry_unix: String(NOW - 1) }), key({ revoked: true })] },
      { rules: [{ id: "daily", enabled: false }] },
      NOW,
    );
    expect(k.live).toHaveLength(1);
    expect(k.expired).toBe(1);
    expect(k.accountRule).toBe(false);
  });
});

describe("readLinkedKeys", () => {
  it("treats a 404 as no linked keys", async () => {
    const fake: FetchLike = async () => ({ ok: false, status: 404, json: async () => ({}) });
    expect(await readLinkedKeys("https://rest.example", "qor1x", fake, NOW)).toEqual({ live: [], expired: 0, accountRule: false });
  });
  it("gives up quietly on other errors", async () => {
    const fake: FetchLike = async () => ({ ok: false, status: 500, json: async () => ({}) });
    expect(await readLinkedKeys("https://rest.example", "qor1x", fake, NOW)).toBeUndefined();
  });
  it("reads the keys and the spending rules", async () => {
    const urls: string[] = [];
    const fake: FetchLike = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, json: async () => (url.endsWith("/authenticators") ? { authenticators: [key()] } : { rules: [{ enabled: true }] }) };
    };
    const k = await readLinkedKeys("https://rest.example/", "qor1abc", fake, NOW);
    expect(urls).toEqual([
      "https://rest.example/qorechain/abstractaccount/v1/accounts/qor1abc/authenticators",
      "https://rest.example/qorechain/abstractaccount/v1/accounts/qor1abc/spending_rules",
    ]);
    expect(k?.accountRule).toBe(true);
  });
});

describe("describeLinkedKeys", () => {
  it("says nothing when no key can act", () => {
    expect(describeLinkedKeys({ live: [], expired: 3, accountRule: false })).toBeUndefined();
  });
  it("is red when a key can move value with no limit", () => {
    const line = describeLinkedKeys(parseLinkedKeys({ authenticators: [key(), key({ pubkey_hex: "c8657c752f88dc4c498c00385c68ee00b426d745" })] }, {}, NOW))!;
    expect(line.tone).toBe("high");
    expect(line.title).toBe("2 linked keys can act for this account");
    expect(line.detail).toContain("Both are MetaMask-style keys: old-style locks a quantum computer could pick");
    expect(line.detail).toContain("can send EVM transactions, with no spending limit");
  });
  it("is orange when a spending rule caps them", () => {
    const line = describeLinkedKeys(parseLinkedKeys({ authenticators: [key()] }, { rules: [{ enabled: true }] }, NOW))!;
    expect(line.tone).toBe("warn");
    expect(line.detail).toContain("capped by a spending rule");
    expect(line.detail).toContain("It is a MetaMask-style key: an old-style lock");
  });
  it("names the kind of key", () => {
    expect(keyKind({ scheme: "ed25519", pubkeyHex: "aa".repeat(32) })).toBe("Phantom-style (ed25519)");
    expect(keyKind({ scheme: "secp256k1", pubkeyHex: "02" + "aa".repeat(32) })).toBe("secp256k1");
  });
});
