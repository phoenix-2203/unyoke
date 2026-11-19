/**
 * The account's post-quantum signature key, read on chain through Unyoke's own
 * PqcKeyCheck contract (contracts/PqcKeyCheck.sol), which asks QoreChain's PQC
 * Key Status precompile (0x…0a02).
 *
 * It matters for revoking: native revokes carry a hybrid signature and EVM
 * revokes need a window, and both need a registered ML-DSA-87 key.
 */
import type { Abi, Hex } from "viem";
import type { ChainReader } from "./evmApprovalState";
import { PQC_KEY_CHECK_ABI } from "./pqcKeyCheckArtifact";

/** PqcKeyCheck on the QoreChain testnet (qorechain-diana), deployed in tx 0x897b95ce…a4dab406 at block 10,363,722. */
export const PQC_KEY_CHECK_ADDRESS: Hex | undefined = "0xC4d2b554BE4014656cf5938b5e2F0561011Cb5f9";

export interface PqcKeyStatus {
  registered: boolean;
  /** 1 = ML-DSA-87 */
  algorithmId: number;
  /** The key was registered with a verified proof of possession. */
  proven: boolean;
}

/** Read the key through PqcKeyCheck. Undefined when it can't be read (no contract, inactive precompile, network). */
export async function readPqcKey(client: Pick<ChainReader, "readContract">, account: Hex, contract = PQC_KEY_CHECK_ADDRESS): Promise<PqcKeyStatus | undefined> {
  if (!contract) return undefined;
  try {
    const [registered, algorithmId, proven] = (await client.readContract({
      address: contract,
      abi: PQC_KEY_CHECK_ABI as Abi,
      functionName: "status",
      args: [account],
    })) as readonly [boolean, number, boolean];
    return { registered, algorithmId: Number(algorithmId), proven };
  } catch {
    return undefined;
  }
}

export interface PqcKeyLine {
  tone: "ok" | "warn";
  title: string;
  detail: string;
}

/** One plain sentence about the key, for the results. */
export function describePqcKey(k: PqcKeyStatus): PqcKeyLine {
  const name = k.algorithmId === 1 ? "ML-DSA-87" : `algorithm ${k.algorithmId}`;
  if (k.registered && k.proven) {
    return { tone: "ok", title: `Post-quantum key: ${name}, proven`, detail: "Registered with a proof that this account holds it, so it can sign the hybrid transactions and windows that revokes use." };
  }
  if (k.registered) {
    return { tone: "warn", title: `Post-quantum key: ${name}, not proven`, detail: "Registered without a proof of possession: the chain accepts it, but nothing shows this account holds it." };
  }
  return { tone: "warn", title: "No post-quantum key yet", detail: "Revokes need one. QoreX registers it the first time this account sends a transaction." };
}
