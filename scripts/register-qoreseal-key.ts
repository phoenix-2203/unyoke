/**
 * Publish a QoreSeal (ML-KEM-1024) encryption key for the throwaway account in
 * .env.seed, on the TESTNET, so others can seal messages to it:
 *
 *   pnpm qoreseal:register
 *
 * The key comes from the account's own phrase with QoreSeal's standard
 * derivation (deriveSealKeys, index 0), so the same phrase can always rebuild
 * it and open what is sealed to it. Nothing secret leaves this computer: only
 * the public key goes on chain, in a hybrid-signed MsgRegisterKEMKey.
 */
import { deriveSealKeys } from "@qorechain/qoreseal";
import { KEM_ALGORITHM_ML_KEM_1024, msg } from "@qorechain/sdk";
import { loadTestAccount, rest } from "./lib/testnet";

const mnemonic = (process.env.E2E_MNEMONIC ?? process.env.SEED_MNEMONIC)?.trim();
if (!mnemonic) throw new Error("Set E2E_MNEMONIC in .env.seed (the throwaway testnet phrase).");
const t = await loadTestAccount({ refuseDemo: true });
const keys = deriveSealKeys({ mnemonic });

const before = await rest<{ found: boolean }>(`/qorechain/pqc/v1/kem/${t.qor}`);
if (before.found) console.log("This account already has a KEM key; publishing again replaces it with the same one.");

const hash = await t.native("register QoreSeal key", [
  msg.pqc.registerKemKey({ sender: t.qor, algorithmId: KEM_ALGORITHM_ML_KEM_1024, publicKey: keys.mlkemPublicKey }),
]);
await new Promise((r) => setTimeout(r, 3000));
const after = await rest<{ found: boolean; key?: { algorithm_name?: string; registered_height?: string } }>(`/qorechain/pqc/v1/kem/${t.qor}`);

console.log(`
QoreSeal key published
  account:  ${t.qor}
  tx:       ${hash}
  on chain: found=${after.found} ${after.key?.algorithm_name ?? ""} at height ${after.key?.registered_height ?? "?"}
Then press Check on "First QoreSeal key" at build.qorechain.io/me`);
