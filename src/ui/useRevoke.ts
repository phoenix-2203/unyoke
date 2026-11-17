/**
 * Revoking from the results view, with status per permission and a receipt.
 *
 * EVM approvals are revoked from the connected EVM wallet; on QoreX mobile the
 * wallet opens its own one-transaction window (see docs/SPIKE_RESULTS.md).
 * Native grants are revoked through QoreX's signAndBroadcast (hybrid signed).
 * Every revoke is checked on chain afterwards before it is marked done.
 */
import { QORECHAIN_TESTNET_CHAIN_ID, getQorexNative, hasCapability } from "@qorechain/qorex-types";
import { classifyEvmWindowRejection, qorechainTestnet } from "@qorechain/evm";
import { useCallback, useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { approvalForAllAbi, type LiveApproval } from "../lib/evmApprovalState";
import { type NativePermission, readNativePermissions, revokeMessageFor } from "../lib/nativePermissions";
import { toQorexMessage } from "../lib/qorexMessage";
import { type WindowEvidence, evmRevokeCall, parseWindowEvidence, permissionKey } from "../lib/revoke";
import type { ScanResult } from "../lib/scanAccount";
import { evmWindowBlocker, explainEvmError } from "./qorexEnv";

export type RevokeState = "idle" | "signing" | "confirming" | "verifying" | "done" | "failed";

export interface RevokeStatus {
  state: RevokeState;
  txHash?: string;
  error?: string;
  evidence?: WindowEvidence;
}

export interface ReceiptEntry {
  key: string;
  lane: "EVM" | "Native";
  what: string;
  txHash: string;
  evidence?: WindowEvidence;
  at: string;
}

const WINDOW_HELP: Record<string, string> = {
  "no-window":
    "The chain refused it: no EVM window is open. QoreX mobile opens one by itself. On desktop, open a small window in the QoreX extension first, or continue on your phone.",
  exhausted: "Your EVM window is used up. Open a new one (or use QoreX mobile, which opens one per revoke).",
  "no-pqc-key": "This account has no post-quantum key yet. Send any small transaction from QoreX once to register it.",
  invalid: "The chain refused the window parameters.",
};

const message = (e: unknown) => (e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e));

export function useRevoke(result: ScanResult | undefined, rest: string) {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: qorechainTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [status, setStatus] = useState<Record<string, RevokeStatus>>({});
  const [receipt, setReceipt] = useState<ReceiptEntry[]>([]);

  const set = (key: string, s: RevokeStatus) => setStatus((m) => ({ ...m, [key]: s }));

  /** Why EVM revokes are not possible right now, if they are not. */
  const evmBlocker = !result
    ? "Scan an account first."
    : !address
      ? "Connect the wallet that owns this account to revoke."
      : address.toLowerCase() !== result.account.evm.toLowerCase()
        ? "The connected wallet is a different account. Connect the one you scanned."
        : undefined;

  const revokeEvm = useCallback(
    async (a: LiveApproval) => {
      const key = permissionKey(a);
      if (!client || !result) return;
      try {
        if (chainId !== qorechainTestnet.id) await switchChainAsync({ chainId: qorechainTestnet.id });
        set(key, { state: "signing" });
        const blocked = await evmWindowBlocker(rest, result.account.qor, a.token);
        if (blocked) throw new Error(blocked);
        const call = evmRevokeCall(a);
        const hash = await writeContractAsync({ ...call, chainId: qorechainTestnet.id } as Parameters<typeof writeContractAsync>[0]);
        set(key, { state: "confirming", txHash: hash });
        const rcpt = await client.waitForTransactionReceipt({ hash });
        if (rcpt.status !== "success") throw new Error("The revoke transaction reverted.");
        set(key, { state: "verifying", txHash: hash });
        const still =
          a.kind === "erc20"
            ? ((await client.readContract({ address: a.token, abi: erc20Abi, functionName: "allowance", args: [a.owner, a.spender] })) as bigint) > 0n
            : ((await client.readContract({ address: a.token, abi: approvalForAllAbi, functionName: "isApprovedForAll", args: [a.owner, a.spender] })) as boolean);
        if (still) throw new Error("The transaction went through but the approval is still open. Try again.");
        let evidence: WindowEvidence | undefined;
        try {
          const r = await fetch(`${rest}/qorechain/pqc/v1/evm_window/${result.account.qor}`);
          if (r.ok) evidence = parseWindowEvidence(await r.json(), a.token);
        } catch {
          /* evidence is a bonus; the revoke itself is verified above */
        }
        set(key, { state: "done", txHash: hash, evidence });
        setReceipt((r) => [
          ...r,
          {
            key,
            lane: "EVM",
            what: `${a.tokenInfo.symbol ?? a.token}: ${a.kind === "erc20" ? "allowance" : "approve-all"} for ${a.spender} set to ${a.kind === "erc20" ? "0" : "false"}`,
            txHash: hash,
            evidence,
            at: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        const kind = classifyEvmWindowRejection(e);
        set(key, { state: "failed", error: kind ? WINDOW_HELP[kind] : explainEvmError(message(e)) });
      }
    },
    [client, result, chainId, switchChainAsync, writeContractAsync, rest],
  );

  const revokeNative = useCallback(
    async (p: NativePermission) => {
      const key = permissionKey(p);
      if (!result) return;
      const native = getQorexNative();
      if (!native) {
        set(key, { state: "failed", error: "QoreX not found. Open Unyoke inside the QoreX app's browser, or install QoreX." });
        return;
      }
      if (!hasCapability(native, "signAndBroadcast")) {
        set(key, { state: "failed", error: "This QoreX version can't sign for websites yet. Update QoreX." });
        return;
      }
      try {
        set(key, { state: "signing" });
        await native.enable(QORECHAIN_TESTNET_CHAIN_ID);
        const k = await native.getKey(QORECHAIN_TESTNET_CHAIN_ID);
        if (k.bech32Address !== result.account.qor) {
          throw new Error(`QoreX is on ${k.bech32Address}. Switch QoreX to the account you scanned (${result.account.qor}).`);
        }
        const res = await native.signAndBroadcast({
          chainId: QORECHAIN_TESTNET_CHAIN_ID,
          messages: [toQorexMessage(revokeMessageFor(p))],
          memo: "Unyoke: revoke",
        });
        if (res.code !== 0) throw new Error(`The chain refused it (code ${res.code}).`);
        set(key, { state: "verifying", txHash: res.txHash });
        const after = await readNativePermissions(rest, result.account.qor);
        if (after.some((x) => permissionKey(x) === key)) throw new Error("Sent, but the grant still shows. Wait a block and scan again.");
        set(key, { state: "done", txHash: res.txHash });
        const what =
          p.kind === "authz"
            ? `authz grant to ${p.grantee} (${p.msgTypeUrl ?? p.authorizationType}) revoked`
            : p.kind === "feegrant"
              ? `fee grant to ${p.grantee} revoked`
              : `EIP-7702 consent for ${p.delegate} cleared`;
        setReceipt((r) => [...r, { key, lane: "Native", what, txHash: res.txHash, at: new Date().toISOString() }]);
      } catch (e) {
        const m = message(e);
        set(key, {
          state: "failed",
          error: /cannot show|will not sign/i.test(m)
            ? `QoreX can't display this message type yet, so it won't sign it: ${m}`
            : /network|chain id|chainid/i.test(m)
              ? `QoreX is on another network. Switch it to testnet. (${m})`
              : m,
        });
      }
    },
    [result, rest],
  );

  return { status, receipt, evmBlocker, revokeEvm, revokeNative };
}
