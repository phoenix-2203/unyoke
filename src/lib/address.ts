/**
 * One QoreChain account, two spellings: the native `qor1...` form and the EVM
 * `0x...` form are the same 20 bytes. Unyoke accepts either and works with both.
 */
import { toEvmAddress, toQorAddress } from "@qorechain/evm";
import { getAddress, isAddress } from "viem";

export interface AccountAddresses {
  /** Native-lane form, `qor1...`. */
  qor: string;
  /** EVM-lane form, EIP-55 checksummed `0x...`. */
  evm: `0x${string}`;
}

export class AddressInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddressInputError";
  }
}

/** Parse a pasted address (`qor1...` or `0x...`) into both forms. */
export function parseAccount(input: string): AccountAddresses {
  const raw = input.trim();
  if (raw === "") throw new AddressInputError("Paste a qor1... or 0x... address.");

  if (/^0x/i.test(raw)) {
    if (!isAddress(raw, { strict: false })) {
      throw new AddressInputError("That 0x address is not 40 hex characters.");
    }
    const evm = getAddress(raw);
    return { evm, qor: toQorAddress(evm) };
  }

  if (/^qor1/i.test(raw)) {
    let evm: `0x${string}`;
    try {
      evm = getAddress(toEvmAddress(raw.toLowerCase()));
    } catch {
      throw new AddressInputError("That qor1 address is not valid (check for a typo).");
    }
    // Normalise the qor1 spelling from the bytes.
    return { evm, qor: toQorAddress(evm) };
  }

  throw new AddressInputError("Unyoke reads QoreChain accounts: start with qor1 or 0x.");
}
