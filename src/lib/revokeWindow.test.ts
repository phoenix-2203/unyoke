import { qorechainTypes } from "@qorechain/sdk";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  REVOKE_GAS_LIMIT,
  RevokeWindowError,
  encodeCloseWindow,
  encodeOpenWindow,
  planRevokeWindow,
} from "./revokeWindow";

const FUSD = "0x97143B771D34ddb9130b807b135Ae675A5a963CA";
const FETH = "0x02292293c13880a26242690eb70a0e42B8E91c28";
const SENDER = "qor1qef7x5ac8zwq82ckeyg80j9g3ekdpgwczw8lwh";
const GWEI_250 = 250_000_000_000n;

describe("planRevokeWindow", () => {
  it("lists exactly the token contracts, once each, checksummed", () => {
    const plan = planRevokeWindow({
      tokenContracts: [FUSD.toLowerCase(), FETH, FUSD],
      revokeCount: 3,
      maxFeePerGasWei: GWEI_250,
    });
    expect(plan.allowedTargets).toEqual([getAddress(FUSD), getAddress(FETH)]);
    expect(plan.maxTxs).toBe(3);
  });

  it("caps value at the fees plus a 20% margin by default", () => {
    // 80,000 gas x 250 gwei = 0.02 QOR = 20,000 uqor per revoke
    const plan = planRevokeWindow({ tokenContracts: [FUSD], revokeCount: 2, maxFeePerGasWei: GWEI_250 });
    expect(REVOKE_GAS_LIMIT).toBe(80_000n);
    expect(plan.maxValueUqor).toBe(48_000n);
  });

  it("sizes blocks to about ten minutes of testnet blocks", () => {
    const plan = planRevokeWindow({ tokenContracts: [FUSD], revokeCount: 1, maxFeePerGasWei: GWEI_250 });
    expect(plan.blocks).toBe(462); // 600 s / 1.3 s, rounded up
  });

  it("refuses an empty batch, bad addresses and too many contracts", () => {
    expect(() => planRevokeWindow({ tokenContracts: [FUSD], revokeCount: 0, maxFeePerGasWei: GWEI_250 })).toThrow(
      RevokeWindowError,
    );
    expect(() => planRevokeWindow({ tokenContracts: ["0x123"], revokeCount: 1, maxFeePerGasWei: GWEI_250 })).toThrow(
      /Not a contract address/,
    );
    const seventeen = Array.from({ length: 17 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`);
    expect(() => planRevokeWindow({ tokenContracts: seventeen, revokeCount: 17, maxFeePerGasWei: GWEI_250 })).toThrow(
      /at most 16 contracts/,
    );
  });

  it("refuses more contracts than revokes", () => {
    expect(() =>
      planRevokeWindow({ tokenContracts: [FUSD, FETH], revokeCount: 1, maxFeePerGasWei: GWEI_250 }),
    ).toThrow(/at least one revoke/);
  });
});

describe("window messages", () => {
  it("encodes MsgOpenEVMWindow that decodes back to the plan", () => {
    const plan = planRevokeWindow({ tokenContracts: [FUSD], revokeCount: 2, maxFeePerGasWei: GWEI_250 });
    const msg = encodeOpenWindow(SENDER, plan);
    expect(msg.typeUrl).toBe("/qorechain.pqc.v1.MsgOpenEVMWindow");
    const decoded = qorechainTypes.pqc.MsgOpenEVMWindow.decode(msg.value);
    expect(decoded.sender).toBe(SENDER);
    expect(decoded.allowedTargets).toEqual([FUSD]);
    expect(String(decoded.maxTxs)).toBe("2");
    expect(String(decoded.maxValue)).toBe("48000");
    expect(String(decoded.blocks)).toBe("462");
    expect(decoded.nativeOnly).toBe(false);
  });

  it("encodes MsgCloseEVMWindow for the sender", () => {
    const msg = encodeCloseWindow(SENDER);
    expect(msg.typeUrl).toBe("/qorechain.pqc.v1.MsgCloseEVMWindow");
    expect(qorechainTypes.pqc.MsgCloseEVMWindow.decode(msg.value).sender).toBe(SENDER);
  });
});
