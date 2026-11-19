import { describe, expect, it } from "vitest";
import { describePqcKey, readPqcKey } from "./pqcKey";

const ACCOUNT = "0xF1C9948Be3910B70224bD4578A154f74c2aB8082" as const;
const CONTRACT = "0x00000000000000000000000000000000000f00d1" as const;

describe("readPqcKey", () => {
  it("reads status() from the contract", async () => {
    const calls: unknown[] = [];
    const client = {
      readContract: async (a: unknown) => {
        calls.push(a);
        return [true, 1, true] as const;
      },
    };
    expect(await readPqcKey(client, ACCOUNT, CONTRACT)).toEqual({ registered: true, algorithmId: 1, proven: true });
    expect(calls[0]).toMatchObject({ address: CONTRACT, functionName: "status", args: [ACCOUNT] });
  });
  it("gives up quietly when there is no contract or the call fails", async () => {
    const boom = { readContract: async () => Promise.reject(new Error("PrecompileInactive")) };
    expect(await readPqcKey(boom, ACCOUNT, undefined)).toBeUndefined();
    expect(await readPqcKey(boom, ACCOUNT, CONTRACT)).toBeUndefined();
  });
});

describe("describePqcKey", () => {
  it("only calls a key fine when it is registered and proven", () => {
    expect(describePqcKey({ registered: true, algorithmId: 1, proven: true })).toMatchObject({ tone: "ok", title: "Post-quantum key: ML-DSA-87, proven" });
    expect(describePqcKey({ registered: true, algorithmId: 1, proven: false }).tone).toBe("warn");
    expect(describePqcKey({ registered: false, algorithmId: 0, proven: false }).title).toBe("No post-quantum key yet");
  });
});
