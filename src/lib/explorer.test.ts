import { describe, expect, it } from "vitest";
import { cosmosHashForEvmTx, explorerTxUrl } from "./explorer";

const COSMOS = "250959F74706CF4A2D705F5F0B826DA510E2BAADC1EA3E1ECDAD379AFADA6CDF";
const EVM = "0x9c35be14c94f13397fa59755f5e670fe944c08314089f4ca8be3ac215167f130";

describe("explorerTxUrl", () => {
  it("links Cosmos hashes", () => {
    expect(explorerTxUrl(COSMOS.toLowerCase())).toBe(`https://explore.qore.network/tx/${COSMOS}`);
  });
  it("refuses EVM hashes, which the explorer can't open", () => {
    expect(explorerTxUrl(EVM)).toBeUndefined();
  });
});

describe("cosmosHashForEvmTx", () => {
  it("finds the carrying Cosmos tx through the event index", async () => {
    let asked = "";
    const h = await cosmosHashForEvmTx("/lcd-testnet/", EVM, async (url) => {
      asked = url;
      return { ok: true, json: async () => ({ tx_responses: [{ txhash: COSMOS }] }) };
    });
    expect(h).toBe(COSMOS);
    expect(decodeURIComponent(asked)).toContain(`ethereum_tx.ethereumTxHash='${EVM}'`);
    expect(asked.startsWith("/lcd-testnet/cosmos/tx/v1beta1/txs?")).toBe(true);
  });
  it("gives up quietly when the node has pruned it or is down", async () => {
    expect(await cosmosHashForEvmTx("/x", EVM, async () => ({ ok: true, json: async () => ({ tx_responses: [] }) }))).toBeUndefined();
    expect(await cosmosHashForEvmTx("/x", EVM, async () => { throw new Error("down"); })).toBeUndefined();
    expect(await cosmosHashForEvmTx("/x", "nope", async () => { throw new Error("unused"); })).toBeUndefined();
  });
});
