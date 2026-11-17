/**
 * Day-1 spike: does the riskiest part of Unyoke work end to end on testnet?
 *
 * 1. QoreX (native lane) opens a window limited to the fUSD contract,
 *    signed with the hybrid secp256k1 + ML-DSA-87 signature.
 * 2. The EVM wallet (MetaMask or any injected wallet, Ethereum-style account)
 *    approves a test spender, then revokes it, inside that window.
 * 3. QoreX closes the window, and the app reads the window back.
 *
 * Throwaway: replaced by the real revoke flow once the answers are known.
 */
import { QORECHAIN_TESTNET_CHAIN_ID, getQorexNative, hasCapability } from "@qorechain/qorex-types";
import { evmWindowStatus, toEvmAddress, toQorAddress } from "@qorechain/evm";
import { authz, feegrant } from "@qorechain/sdk";
import { useState } from "react";
import { erc20Abi, getAddress } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { encodeCloseWindow, encodeOpenWindow, planRevokeWindow } from "../lib/revokeWindow";
import { toQorexMessage } from "../lib/qorexMessage";
import { basicAllowance, genericAuthorization } from "../lib/grantEncoding";

const FUSD = "0x97143B771D34ddb9130b807b135Ae675A5a963CA" as const;
/** A burn-style address used only as the test spender: nobody holds its key. */
const TEST_SPENDER = "0x000000000000000000000000000000000000dEaD" as const;
const MAX_FEE_PER_GAS = 250_000_000_000n; // 250 gwei, the figure the QoreChain workshop uses

type Line = { at: string; text: string };

/** Throwaway grantee for the native-lane tests: the qor1 form of 0x...dEaD. */
const TEST_GRANTEE = toQorAddress(TEST_SPENDER);



export function WindowSpike() {
  const { address: evmAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [qorAddress, setQorAddress] = useState<string>();
  const [log, setLog] = useState<Line[]>([]);
  const say = (text: string) => setLog((l) => [...l, { at: new Date().toLocaleTimeString(), text }]);
  const fail = (step: string, e: unknown) => say(`${step} failed: ${e instanceof Error ? e.message : String(e)}`);

  async function connectQorex() {
    const native = getQorexNative();
    if (!native) return say("QoreX not found. Install the QoreX extension and reload.");
    if (!hasCapability(native, "signAndBroadcast")) {
      return say("This QoreX build has no signAndBroadcast. Update QoreX.");
    }
    try {
      await native.enable(QORECHAIN_TESTNET_CHAIN_ID);
      const key = await native.getKey(QORECHAIN_TESTNET_CHAIN_ID);
      setQorAddress(key.bech32Address);
      say(`QoreX account: ${key.bech32Address} (0x form ${toEvmAddress(key.bech32Address)})`);
    } catch (e) {
      fail("Connecting QoreX", e);
    }
  }

  const sameAccount =
    qorAddress && evmAddress ? getAddress(toEvmAddress(qorAddress)) === getAddress(evmAddress) : undefined;

  async function openWindow() {
    if (!qorAddress) return;
    try {
      const plan = planRevokeWindow({ tokenContracts: [FUSD], revokeCount: 2, maxFeePerGasWei: MAX_FEE_PER_GAS });
      say(`Asking QoreX to open: only ${plan.allowedTargets.join(", ")}, ${plan.maxTxs} txs, ${plan.maxValueUqor} uqor, ${plan.blocks} blocks`);
      const res = await getQorexNative()!.signAndBroadcast({
        chainId: QORECHAIN_TESTNET_CHAIN_ID,
        messages: [encodeOpenWindow(qorAddress, plan)],
        memo: "unyoke spike: open revoke window",
      });
      say(`Open window: code ${res.code}, shield ${res.shield}, tx ${res.txHash}`);
    } catch (e) {
      fail("Opening the window", e);
    }
  }

  async function approveThenRevoke() {
    try {
      const a = await writeContractAsync({ address: FUSD, abi: erc20Abi, functionName: "approve", args: [TEST_SPENDER, 1_000_000n] });
      say(`Test approval of 1 fUSD sent: ${a}`);
      const r = await writeContractAsync({ address: FUSD, abi: erc20Abi, functionName: "approve", args: [TEST_SPENDER, 0n] });
      say(`Revoke sent: ${r}`);
    } catch (e) {
      fail("Approve/revoke", e);
    }
  }

  async function sendNative(label: string, msg: { typeUrl: string; value: unknown }) {
    const res = await getQorexNative()!.signAndBroadcast({
      chainId: QORECHAIN_TESTNET_CHAIN_ID,
      messages: [toQorexMessage(msg)],
      memo: `unyoke spike: ${label}`,
    });
    say(`${label}: code ${res.code}, shield ${res.shield}, tx ${res.txHash}`);
  }

  async function authzGrantThenRevoke() {
    if (!qorAddress) return;
    const msgTypeUrl = "/cosmos.gov.v1.MsgVote";
    try {
      await sendNative(
        "authz grant (vote only)",
        authz.grant({
          granter: qorAddress,
          grantee: TEST_GRANTEE,
          grant: {
            authorization: genericAuthorization(msgTypeUrl),
            expiration: { seconds: BigInt(Math.floor(Date.now() / 1000) + 86_400), nanos: 0 },
          },
        }),
      );
      await sendNative("authz revoke", authz.revoke({ granter: qorAddress, grantee: TEST_GRANTEE, msgTypeUrl }));
    } catch (e) {
      fail("authz grant/revoke", e);
    }
  }

  async function feeGrantThenRevoke() {
    if (!qorAddress) return;
    try {
      await sendNative(
        "fee grant (1000 uqor)",
        feegrant.grant({
          granter: qorAddress,
          grantee: TEST_GRANTEE,
          allowance: basicAllowance("uqor", "1000"),
        }),
      );
      await sendNative("fee grant revoke", feegrant.revoke({ granter: qorAddress, grantee: TEST_GRANTEE }));
    } catch (e) {
      fail("fee grant/revoke", e);
    }
  }

  async function closeWindow() {
    if (!qorAddress) return;
    try {
      const res = await getQorexNative()!.signAndBroadcast({
        chainId: QORECHAIN_TESTNET_CHAIN_ID,
        messages: [encodeCloseWindow(qorAddress)],
        memo: "unyoke spike: close revoke window",
      });
      say(`Close window: code ${res.code}, shield ${res.shield}, tx ${res.txHash}`);
    } catch (e) {
      fail("Closing the window", e);
    }
  }

  async function readWindow() {
    if (!qorAddress) return;
    try {
      const w = await evmWindowStatus({ rest: "/lcd-testnet", address: qorAddress });
      say(
        w.found
          ? `Window: ${w.live ? "LIVE" : "not usable"}, ${w.remainingTxs} txs, ${w.remainingValue} uqor, ${w.remainingBlocks} blocks left`
          : "Window: none",
      );
    } catch (e) {
      fail("Reading the window", e);
    }
  }

  return (
    <section style={{ border: "1px dashed #999", padding: "1rem", marginTop: "1.5rem" }}>
      <h2>Spike: limited window and native revokes from QoreX</h2>
      <p>
        Testnet only. Use a throwaway account. Connect your EVM wallet above first (the Ethereum-style
        account), then follow the buttons in order.
      </p>
      <ol>
        <li>
          <button type="button" onClick={connectQorex}>Connect QoreX</button>
          {sameAccount === false && (
            <strong> QoreX and your EVM wallet are different accounts. In QoreX, add and switch to the
              Ethereum account (coin 60) from the same recovery phrase.</strong>
          )}
          {sameAccount && <span> Same account in both wallets.</span>}
        </li>
        <li><button type="button" onClick={openWindow} disabled={!qorAddress}>Open window (fUSD only, 2 txs, ~10 min)</button></li>
        <li><button type="button" onClick={readWindow} disabled={!qorAddress}>Read window</button></li>
        <li><button type="button" onClick={approveThenRevoke} disabled={!evmAddress}>Approve 1 fUSD to a test spender, then revoke it</button></li>
        <li><button type="button" onClick={closeWindow} disabled={!qorAddress}>Close window</button></li>
        <li><button type="button" onClick={readWindow} disabled={!qorAddress}>Read window again</button></li>
        <li><button type="button" onClick={authzGrantThenRevoke} disabled={!qorAddress}>Native: create a test authz grant, then revoke it</button></li>
        <li><button type="button" onClick={feeGrantThenRevoke} disabled={!qorAddress}>Native: create a test fee grant, then revoke it</button></li>
      </ol>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f4", padding: "0.5rem" }}>
        {log.map((l) => `${l.at}  ${l.text}`).join("\n") || "Log is empty."}
      </pre>
    </section>
  );
}
