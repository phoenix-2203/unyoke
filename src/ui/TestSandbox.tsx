/**
 * Testnet only: give your own account a few harmless permissions so you can
 * watch Unyoke find and remove them. Every grant goes to 0x…dEaD, an address
 * nobody holds the key to, and uses testnet tokens with no value.
 */
import { QORECHAIN_TESTNET_CHAIN_ID, getQorexNative, hasCapability } from "@qorechain/qorex-types";
import { qorechainTestnet, toQorAddress } from "@qorechain/evm";
import { authz, feegrant } from "@qorechain/sdk";
import { useState } from "react";
import { erc20Abi, maxUint256 } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { basicAllowance, genericAuthorization, sendAuthorization } from "../lib/grantEncoding";
import { toQorexMessage } from "../lib/qorexMessage";
import { evmWindowBlocker, explainEvmError } from "./qorexEnv";

const FUSD = "0x97143B771D34ddb9130b807b135Ae675A5a963CA" as const;
const DEAD = "0x000000000000000000000000000000000000dEaD" as const;
const DEAD_QOR = toQorAddress(DEAD);

type Job = "approval" | "authz" | "send" | "feegrant";
const message = (e: unknown) => (e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e));

export function TestSandbox({ qor, evm, onDone }: { qor: string; evm: string; onDone: () => void }) {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: qorechainTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<Job>();
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  async function native(job: Job, msg: { typeUrl: string; value: unknown }) {
    const q = getQorexNative();
    if (!q || !hasCapability(q, "signAndBroadcast")) throw new Error("Connect QoreX first: the browser extension (on testnet) or the QoreX app's browser.");
    await q.enable(QORECHAIN_TESTNET_CHAIN_ID);
    const key = await q.getKey(QORECHAIN_TESTNET_CHAIN_ID);
    if (key.bech32Address !== qor) throw new Error("QoreX is on a different account than the one you scanned.");
    const res = await q.signAndBroadcast({ chainId: QORECHAIN_TESTNET_CHAIN_ID, messages: [toQorexMessage(msg)], memo: `unyoke test: ${job}` });
    if (res.code !== 0) throw new Error(`The chain refused it (code ${res.code}).`);
  }

  async function make(job: Job) {
    setBusy(job);
    setNote(undefined);
    try {
      if (job === "approval") {
        if (!address || address.toLowerCase() !== evm.toLowerCase()) throw new Error("Connect the wallet you scanned first.");
        const blocked = await evmWindowBlocker("/lcd-testnet", qor, FUSD);
        if (blocked) throw new Error(blocked);
        if (chainId !== qorechainTestnet.id) await switchChainAsync({ chainId: qorechainTestnet.id });
        const hash = await writeContractAsync({ address: FUSD, abi: erc20Abi, functionName: "approve", args: [DEAD, maxUint256], chainId: qorechainTestnet.id });
        await client?.waitForTransactionReceipt({ hash });
      } else if (job === "send") {
        await native(job, authz.grant({ granter: qor, grantee: DEAD_QOR, grant: { authorization: sendAuthorization("uqor", "5000000") } }));
      } else if (job === "authz") {
        await native(job, authz.grant({ granter: qor, grantee: DEAD_QOR, grant: { authorization: genericAuthorization("/cosmos.gov.v1.MsgVote") } }));
      } else {
        await native(job, feegrant.grant({ granter: qor, grantee: DEAD_QOR, allowance: basicAllowance() }));
      }
      setNote({ ok: true, text: "Created. Scanning again…" });
      onDone();
    } catch (e) {
      setNote({ ok: false, text: job === "approval" ? explainEvmError(message(e)) : message(e) });
    } finally {
      setBusy(undefined);
    }
  }

  const btn = (job: Job, label: string) => (
    <button type="button" className="ghost" disabled={!!busy} onClick={() => make(job)}>
      {busy === job ? "Waiting for wallet…" : label}
    </button>
  );

  return (
    <div className="sandbox">
      <div>
        <span className="kicker mono">testnet sandbox</span>
        <h3>Nothing to revoke? Make some test permissions.</h3>
        <p className="muted">
          Each one goes to 0x…dEaD, an address nobody controls, using worthless testnet tokens. Make one, then revoke it above.
        </p>
      </div>
      <div className="sandbox-actions">
        {btn("approval", "Unlimited fUSD approval")}
        {btn("authz", "Authz grant (vote, no expiry)")}
        {btn("send", "Authz send grant (up to 5 QOR)")}
        {btn("feegrant", "Fee grant (no limit)")}
      </div>
      {note && <p className={`status-line ${note.ok ? "ok" : ""}`}>{note.text}</p>}
    </div>
  );
}
