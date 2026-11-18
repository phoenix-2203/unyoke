/**
 * End-to-end check on the QoreChain TESTNET, using Unyoke's own code:
 *
 *   pnpm e2e:testnet
 *
 *   1. Create three permissions on a throwaway account: an unlimited fUSD
 *      approval (EVM lane), an authz vote grant and an unlimited fee grant
 *      (native lane), all to an address nobody controls.
 *   2. Scan the account with Unyoke's scanner (src/lib/scanAccount) and check
 *      it finds all three, with the risk Unyoke would show.
 *   3. Revoke each one with the exact call or message Unyoke builds
 *      (evmRevokeCall, revokeMessageFor). The EVM revoke goes through a window
 *      limited to fUSD and one transaction, like QoreX mobile opens.
 *   4. Scan again: all three must be gone, the revoke history must list them,
 *      and the window record must show "this token only, 1 tx".
 *
 * Exits 1 if any check fails. The first run makes a brand-new throwaway
 * account, saves its phrase to the git-ignored .env.seed and asks you to send
 * it 1 test QOR; later runs reuse it (and register its post-quantum key the
 * first time). It refuses Unyoke's sample account, whose permissions stay
 * open on purpose. Each run costs about 0.5 test QOR.
 */
import { toQorAddress } from "@qorechain/evm";
import { authz, feegrant } from "@qorechain/sdk";
import { type Hex, encodeFunctionData, erc20Abi, getAddress, maxUint256 } from "viem";
import { basicAllowance, genericAuthorization } from "../src/lib/grantEncoding";
import { readNativeRevocations } from "../src/lib/history";
import { revokeMessageFor } from "../src/lib/nativePermissions";
import { evmRevokeCall, parseWindowEvidence } from "../src/lib/revoke";
import { evmApprovalRisk, nativePermissionRisk } from "../src/lib/risk";
import { type EvmClient, type ScanResult, scanAccount } from "../src/lib/scanAccount";
import { FUSD, MAX_FEE_PER_GAS, REST, loadTestAccount, rest } from "./lib/testnet";

/** Spender and grantee for this run: an address nobody controls, distinct from the sandbox's 0x…dEaD. */
const SPENDER = getAddress("0x00000000000000000000000000000000000e2e01");
const GRANTEE = toQorAddress(SPENDER);
const VOTE = "/cosmos.gov.v1.MsgVote";

const results: { step: string; ok: boolean; detail: string }[] = [];
function check(step: string, ok: boolean, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${step}${detail ? ` — ${detail}` : ""}`);
}
const txLink = (h: string) => `https://unyoke.duckdns.org/tx/${h}`;

async function main() {
  const t = await loadTestAccount({ refuseDemo: true, create: true });
  console.log(`Account: ${t.qor} / ${t.evm}`);
  const evmClient = t.pub as unknown as EvmClient;
  const start = await t.pub.getBlockNumber();
  // Scan only from just before this run, so the check takes seconds, not the whole history.
  const fromBlock = start - 50n;
  const scan = () => scanAccount({ input: t.qor, evm: evmClient, rest: REST, fromBlock });

  console.log("\n1. Create permissions");
  const winA = await t.openWindow([FUSD], 1);
  console.log(`  window (fUSD only, 1 tx): ${txLink(winA)}`);
  const approveHash = await t.wallet.writeContract({
    account: t.wallet.account!,
    chain: t.wallet.chain,
    address: FUSD,
    abi: erc20Abi,
    functionName: "approve",
    args: [SPENDER, maxUint256],
    gas: 100_000n,
    maxFeePerGas: MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: 1_000_000_000n,
  });
  const approveRcpt = await t.pub.waitForTransactionReceipt({ hash: approveHash });
  check("unlimited fUSD approval sent", approveRcpt.status === "success", approveHash);
  const grantVote = await t.native("authz vote grant", [authz.grant({ granter: t.qor, grantee: GRANTEE, grant: { authorization: genericAuthorization(VOTE) } })]);
  check("authz vote grant sent", true, txLink(grantVote));
  const grantFee = await t.native("fee grant", [feegrant.grant({ granter: t.qor, grantee: GRANTEE, allowance: basicAllowance() })]);
  check("fee grant sent", true, txLink(grantFee));

  console.log("\n2. Scan with Unyoke");
  const before: ScanResult = await scan();
  const ap = before.evm.find((a) => a.spender.toLowerCase() === SPENDER.toLowerCase() && a.token.toLowerCase() === FUSD.toLowerCase());
  const vote = before.native.find((p) => p.kind === "authz" && p.grantee === GRANTEE && p.msgTypeUrl === VOTE);
  const fee = before.native.find((p) => p.kind === "feegrant" && p.grantee === GRANTEE);
  check("scanner finds the fUSD approval", !!ap, ap ? `risk ${evmApprovalRisk(ap, before.scannedTo).level}` : "missing");
  check("…and rates it high (unlimited)", !!ap && evmApprovalRisk(ap, before.scannedTo).level === "high");
  check("scanner finds the vote grant", !!vote, vote ? `risk ${nativePermissionRisk(vote).level}` : "missing");
  check("scanner finds the fee grant", !!fee, fee ? `risk ${nativePermissionRisk(fee).level}` : "missing");
  check("…and rates it medium (no spend limit)", !!fee && nativePermissionRisk(fee).level === "medium");
  check("account read as Ethereum-style", before.accountKind === "ethereum", before.accountKind);
  if (!ap || !vote || !fee) throw new Error("Scan missed a permission; not revoking.");

  console.log("\n3. Revoke with the calls Unyoke builds");
  const winB = await t.openWindow([FUSD], 1);
  console.log(`  window (fUSD only, 1 tx): ${txLink(winB)}`);
  const call = evmRevokeCall(ap);
  const revokeHash = await t.wallet.sendTransaction({
    account: t.wallet.account!,
    chain: t.wallet.chain,
    to: call.address,
    data: encodeFunctionData(call as Parameters<typeof encodeFunctionData>[0]),
    gas: 100_000n,
    maxFeePerGas: MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: 1_000_000_000n,
  });
  const revokeRcpt = await t.pub.waitForTransactionReceipt({ hash: revokeHash });
  check("EVM revoke (approve to 0) confirmed", revokeRcpt.status === "success", revokeHash);
  const revVote = await t.native("revoke vote grant", [revokeMessageFor(vote)], "Unyoke: revoke");
  check("vote grant revoke sent (MsgRevoke)", true, txLink(revVote));
  const revFee = await t.native("revoke fee grant", [revokeMessageFor(fee)], "Unyoke: revoke");
  check("fee grant revoke sent (MsgRevokeAllowance)", true, txLink(revFee));

  console.log("\n4. Scan again and check the evidence");
  const after = await scan();
  const sameSpender = (s: Hex) => s.toLowerCase() === SPENDER.toLowerCase();
  check("fUSD approval gone", !after.evm.some((a) => sameSpender(a.spender)));
  check("vote grant gone", !after.native.some((p) => p.kind === "authz" && p.grantee === GRANTEE));
  check("fee grant gone", !after.native.some((p) => p.kind === "feegrant" && p.grantee === GRANTEE));
  check("history lists the EVM revoke", after.history.evm.some((r) => sameSpender(r.spender) && r.kind === "erc20"));
  const nativeHistory = await readNativeRevocations(REST, t.qor);
  const mine = nativeHistory.filter((r) => r.grantee === GRANTEE && r.viaUnyoke);
  check("history lists both native revokes as via Unyoke", mine.length >= 2, `${mine.length} found`);
  const win = parseWindowEvidence(await rest(`/qorechain/pqc/v1/evm_window/${t.qor}`), FUSD);
  check("EVM revoke window: this token only, 1 tx, used up", win.tight && win.usedTxs >= 1, `targets ${win.allowedTargets.join(",")} · ${win.usedTxs}/${win.maxTxs} tx`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? "PASS" : "FAIL"}: ${results.length - failed.length}/${results.length} checks`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(`\nFAIL: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
