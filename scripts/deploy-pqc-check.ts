/**
 * Deploy PqcKeyCheck (contracts/PqcKeyCheck.sol) to the QoreChain TESTNET from
 * the throwaway account in .env.seed:
 *
 *   pnpm deploy:pqc-check
 *
 * Opens a 1-transaction EVM window (unscoped, because a scoped window refuses
 * contract creation), deploys, then calls status() on the new contract for
 * Unyoke's sample account to show it reads the precompile. Prints the address
 * to put in src/lib/pqcKey.ts and the deployment hash for the Ship Weeks form.
 */
import { DEMO_ACCOUNT, MAX_FEE_PER_GAS, loadTestAccount } from "./lib/testnet";
import { toEvmAddress } from "@qorechain/evm";
import { getAddress } from "viem";
import { PQC_KEY_CHECK_ABI, PQC_KEY_CHECK_BYTECODE } from "../src/lib/pqcKeyCheckArtifact";

const GAS = 400_000n;
const t = await loadTestAccount({ refuseDemo: true });
console.log(`Deploying PqcKeyCheck from ${t.qor} (${t.evm})`);

const win = await t.openWindow([], 1, GAS);
console.log(`  window (1 tx): ${win}`);
await new Promise((r) => setTimeout(r, 6000)); // let the window's block land before the EVM transaction

const hash = await t.wallet.deployContract({
  account: t.wallet.account!,
  chain: t.wallet.chain,
  abi: PQC_KEY_CHECK_ABI,
  bytecode: PQC_KEY_CHECK_BYTECODE,
  gas: GAS,
  maxFeePerGas: MAX_FEE_PER_GAS,
  maxPriorityFeePerGas: 1_000_000_000n,
});
const rcpt = await t.pub.waitForTransactionReceipt({ hash });
if (rcpt.status !== "success" || !rcpt.contractAddress) throw new Error(`Deployment failed: ${hash}`);
const address = getAddress(rcpt.contractAddress);

const sample = getAddress(toEvmAddress(DEMO_ACCOUNT));
const [registered, algorithmId, proven] = (await t.pub.readContract({ address, abi: PQC_KEY_CHECK_ABI, functionName: "status", args: [sample] })) as readonly [boolean, number, boolean];

console.log(`
PqcKeyCheck deployed
  contract:   ${address}
  deploy tx:  ${hash}   <- paste this in "First contract with a PQC check" on build.qorechain.io/me
  check:      sample account ${sample}: registered=${registered}, algorithm=${algorithmId}, proven=${proven}

Next: set PQC_KEY_CHECK_ADDRESS in src/lib/pqcKey.ts to ${address}`);
