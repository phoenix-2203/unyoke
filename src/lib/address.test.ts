import { describe, expect, it } from "vitest";
import { AddressInputError, parseAccount } from "./address";

const QOR = "qor1ju2rkacaxnwmjyctspa3xkhxwkj6jc72k63kvn";
const EVM = "0x97143B771D34ddb9130b807b135Ae675A5a963CA";

describe("parseAccount", () => {
  it("turns a 0x address into both forms", () => {
    expect(parseAccount(EVM.toLowerCase())).toEqual({ evm: EVM, qor: QOR });
  });

  it("turns a qor1 address into both forms", () => {
    expect(parseAccount(`  ${QOR}  `)).toEqual({ evm: EVM, qor: QOR });
  });

  it("round-trips", () => {
    const a = parseAccount(EVM);
    expect(parseAccount(a.qor)).toEqual(a);
  });

  it("explains bad input", () => {
    expect(() => parseAccount("")).toThrow(AddressInputError);
    expect(() => parseAccount("0x1234")).toThrow(/40 hex/);
    expect(() => parseAccount("qor1notreal")).toThrow(/not valid/);
    expect(() => parseAccount("cosmos1abc")).toThrow(/qor1 or 0x/);
  });
});
