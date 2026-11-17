import { qorechainTestnet } from "@qorechain/evm";
import { useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatTokenAmount, shortAddress } from "../lib/format";
import type { LiveApproval } from "../lib/evmApprovalState";
import type { NativePermission } from "../lib/nativePermissions";
import { type EvmClient, type ScanProgress, type ScanResult, scanAccount } from "../lib/scanAccount";

/** Native REST through the dev/preview proxy (the public REST API sends no CORS headers). */
const REST = "/lcd-testnet";
const EXPLORER_TX = "https://explore.qore.network/tx/";

export function ScanPage() {
  const { address: connected } = useAccount();
  const client = usePublicClient({ chainId: qorechainTestnet.id });
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<ScanProgress>();
  const [result, setResult] = useState<ScanResult>();
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController>();
  const scanning = progress !== undefined && progress.stage !== "done";

  async function run(target: string) {
    if (!client) return setError("No connection to the QoreChain testnet.");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(undefined);
    setResult(undefined);
    setProgress({ stage: "history" });
    try {
      const r = await scanAccount({
        input: target,
        evm: client as unknown as EvmClient,
        rest: REST,
        signal: ctrl.signal,
        onProgress: setProgress,
      });
      setResult(r);
    } catch (e) {
      setError(ctrl.signal.aborted ? "Scan stopped." : e instanceof Error ? e.message : String(e));
      setProgress(undefined);
    }
  }

  return (
    <section className="card">
      <h2>Scan an account</h2>
      <p className="muted">Paste any qor1… or 0x… address, or scan the wallet you connected. Scanning only reads public data.</p>
      <form
        className="scan-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(input || connected || "");
        }}
      >
        <label htmlFor="addr" className="sr-only">
          Account address
        </label>
        <input
          id="addr"
          value={input}
          placeholder={connected ?? "qor1… or 0x…"}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={scanning || (!input && !connected)}>
          Scan
        </button>
        {scanning && (
          <button type="button" className="secondary" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        )}
      </form>

      {scanning && <Progress p={progress} />}
      {error && <p className="error" role="alert">{error}</p>}
      {result && <Results r={result} />}
    </section>
  );
}

function Progress({ p }: { p: ScanProgress }) {
  const pct =
    p.stage === "evm" && p.blocksTotal ? Math.floor(Number((p.blocksDone! * 100n) / p.blocksTotal)) : undefined;
  const label: Record<ScanProgress["stage"], string> = {
    history: "Finding where the node's history starts…",
    evm: `Reading EVM approval history${pct !== undefined ? ` (${pct}%)` : "…"}`,
    live: "Checking which approvals are still open…",
    native: "Reading native-lane grants…",
    done: "Done",
  };
  return (
    <div className="progress" aria-live="polite">
      <span>{label[p.stage]}</span>
      {pct !== undefined && <progress max={100} value={pct} />}
    </div>
  );
}

function Results({ r }: { r: ScanResult }) {
  const total = r.evm.length + r.native.length;
  return (
    <div className="results">
      <p className="summary">
        <strong>{total === 0 ? "No open permissions found." : `${total} open permission${total === 1 ? "" : "s"} found.`}</strong>{" "}
        Account <code>{shortAddress(r.account.evm)}</code> / <code>{shortAddress(r.account.qor)}</code>
      </p>
      {r.historyLimited && (
        <p className="notice">
          The public testnet node only keeps history from block {r.scannedFrom.toLocaleString("en-US")}. Approvals made before
          that can't be found from history by anyone using this node.
        </p>
      )}

      <h3>EVM lane: token approvals</h3>
      {r.evmError ? (
        <p className="error">Could not read the EVM lane: {r.evmError}</p>
      ) : r.evm.length === 0 ? (
        <p className="muted">None open.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Who can spend</th>
              <th>How much</th>
              <th>Your balance</th>
              <th>Set in</th>
            </tr>
          </thead>
          <tbody>
            {r.evm.map((a) => (
              <EvmRow key={`${a.kind}:${a.token}:${a.spender}`} a={a} />
            ))}
          </tbody>
        </table>
      )}

      <h3>Native lane: grants</h3>
      {r.nativeError ? (
        <p className="error">Could not read the native lane: {r.nativeError}</p>
      ) : r.native.length === 0 ? (
        <p className="muted">None open.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Granted to</th>
              <th>What it allows</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {r.native.map((p, i) => (
              <NativeRow key={i} p={p} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EvmRow({ a }: { a: LiveApproval }) {
  const sym = a.tokenInfo.symbol ?? shortAddress(a.token);
  const amount =
    a.kind === "operator" ? "All your NFTs in this collection" : formatTokenAmount(a.amount, a.tokenInfo.decimals, sym);
  return (
    <tr>
      <td>
        {sym}
        <div className="muted small">{shortAddress(a.token)}</div>
      </td>
      <td>
        <code>{shortAddress(a.spender)}</code>
        <div className="muted small">{a.spenderIsContract ? "contract" : "ordinary wallet"}</div>
      </td>
      <td>{amount}</td>
      <td>{a.balance === undefined ? "?" : formatTokenAmount(a.balance, a.tokenInfo.decimals, a.kind === "operator" ? "NFTs" : sym)}</td>
      <td>
        block {a.setAtBlock.toLocaleString("en-US")}
        {a.setInTx && (
          <div className="small">
            <a href={`${EXPLORER_TX}${a.setInTx}`} target="_blank" rel="noreferrer">
              transaction
            </a>
          </div>
        )}
      </td>
    </tr>
  );
}

function NativeRow({ p }: { p: NativePermission }) {
  if (p.kind === "eip7702") {
    return (
      <tr>
        <td>EIP-7702 consent</td>
        <td>
          <code>{shortAddress(p.delegate)}</code>
        </td>
        <td>Your EVM account may run this contract's code{p.live ? "" : " (expired)"}</td>
        <td>block {p.expiryHeight.toLocaleString("en-US")}</td>
      </tr>
    );
  }
  const what =
    p.kind === "authz"
      ? `Send ${p.msgTypeUrl ?? p.authorizationType} for you${p.spendLimit ? `, up to ${p.spendLimit.map((c) => `${c.amount} ${c.denom}`).join(", ")}` : ""}`
      : `Pay its fees with your QOR${p.spendLimit ? `, up to ${p.spendLimit.map((c) => `${c.amount} ${c.denom}`).join(", ")}` : " (no limit)"}`;
  return (
    <tr>
      <td>{p.kind === "authz" ? "Authz grant" : "Fee grant"}</td>
      <td>
        <code>{shortAddress(p.grantee)}</code>
      </td>
      <td>{what}</td>
      <td>{p.expiration ? new Date(p.expiration).toLocaleDateString() : "Never"}</td>
    </tr>
  );
}
