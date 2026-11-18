import { describe, expect, it } from "vitest";
import { parseTxDetails } from "./txDetails";

// Trimmed from real testnet responses (17–18 Nov 2026).
const NATIVE_REVOKE = {
  tx: {
    body: {
      memo: "Unyoke: revoke",
      messages: [
        {
          "@type": "/cosmos.authz.v1beta1.MsgRevoke",
          granter: "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu",
          grantee: "qor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqph4dpvyp40",
          msg_type_url: "/cosmos.gov.v1.MsgVote",
        },
      ],
      extension_options: [{ "@type": "/qorechain.pqc.v1.PQCHybridSignature", algorithm_id: 1, pqc_signature: "gQ/f…" }],
    },
    auth_info: { fee: { amount: [{ denom: "uqor", amount: "60000" }] } },
  },
  tx_response: {
    txhash: "7d4f9def11a7567297e38e13202f4a56c6c885f110816a149ee114ce3a6633b2",
    height: "10257694",
    timestamp: "2026-11-17T13:32:50Z",
    code: 0,
    gas_used: "172299",
    gas_wanted: "400000",
    events: [
      { type: "pqc_verify", attributes: [{ key: "key_type", value: "hybrid" }] },
      { type: "pqc_hybrid_verify", attributes: [{ key: "algorithm_id", value: "dilithium5" }, { key: "status", value: "verified" }] },
    ],
  },
};

const EVM_REVOKE = {
  tx: {
    body: {
      memo: "",
      messages: [
        {
          "@type": "/cosmos.evm.vm.v1.MsgEthereumTx",
          raw: "0x02f8b3822648148502e90edd0085374c1a67008287d59497143b771d34ddb9130b807b135ae675a5a963ca80b844095ea7b3000000000000000000000000000000000000000000000000000000000000dead0000000000000000000000000000000000000000000000000000000000000000c001a0e684eb33e53c659a46e4765061acceae4cc6bddf197cbdcc6dce41f69cd7bdf6a03b4cd4392737061bf7ef203eda41c297e766cdfcb83e6dfd55887ea1d01475c4",
        },
      ],
      extension_options: [{ "@type": "/cosmos.evm.vm.v1.ExtensionOptionsEthereumTx" }],
    },
    auth_info: { fee: { amount: [{ denom: "aqor", amount: "8258587500000000" }] } },
  },
  tx_response: {
    txhash: "250959F74706CF4A2D705F5F0B826DA510E2BAADC1EA3E1ECDAD379AFADA6CDF",
    height: "10257789",
    code: 0,
    events: [
      { type: "ethereum_tx", attributes: [{ key: "ethereumTxHash", value: "0x9c35be14c94f13397fa59755f5e670fe944c08314089f4ca8be3ac215167f130" }] },
      {
        type: "pqc_evm_window_used",
        attributes: [
          { key: "window_open_height", value: "10257786" },
          { key: "used_txs", value: "1" },
          { key: "used_value", value: "8259" },
        ],
      },
    ],
  },
};

const WINDOW = {
  tx: {
    body: {
      messages: [
        {
          "@type": "/qorechain.pqc.v1.MsgOpenEVMWindow",
          sender: "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu",
          blocks: "100",
          max_txs: "1",
          max_value: "8259",
          allowed_targets: ["0x97143b771d34ddb9130b807b135ae675a5a963ca"],
        },
      ],
    },
  },
  tx_response: { txhash: "77c2", height: "10257786", code: 0, events: [] },
};

describe("parseTxDetails", () => {
  it("explains a native revoke and its verified hybrid signature", () => {
    const d = parseTxDetails(NATIVE_REVOKE);
    expect(d).toMatchObject({ ok: true, height: 10257694, memo: "Unyoke: revoke", fee: expect.stringContaining("0.06"), gasUsed: 172299 });
    expect(d.hash).toBe("7D4F9DEF11A7567297E38E13202F4A56C6C885F110816A149EE114CE3A6633B2");
    expect(d.hybrid).toEqual({ attached: true, verified: true, algorithm: "dilithium5" });
    expect(d.messages[0].type).toBe("MsgRevoke");
    expect(d.messages[0].summary).toContain("MsgVote");
    expect(d.windowUsed).toBeUndefined();
  });

  it("decodes an EVM revoke and the window that admitted it", () => {
    const d = parseTxDetails(EVM_REVOKE);
    expect(d.messages[0]).toMatchObject({ type: "approve", summary: expect.stringContaining("set to 0") });
    expect(d.messages[0].fields).toContainEqual(["Amount", "0"]);
    expect(d.windowUsed).toEqual({ openHeight: 10257786, usedTxs: 1, usedValue: "8259" });
    expect(d.evmHash).toBe("0x9c35be14c94f13397fa59755f5e670fe944c08314089f4ca8be3ac215167f130");
    expect(d.hybrid).toBeUndefined();
    expect(d.fee).toContain("QOR");
  });

  it("describes a scoped window", () => {
    const d = parseTxDetails(WINDOW);
    expect(d.messages[0].summary).toContain("1 tx, 100 blocks");
    expect(d.messages[0].summary).toContain("0x9714");
  });

  it("reports a failed transaction", () => {
    const d = parseTxDetails({ tx_response: { txhash: "ab", height: "1", code: 5, raw_log: "insufficient funds" } });
    expect(d).toMatchObject({ ok: false, error: "insufficient funds", messages: [] });
  });
});
