/**
 * /tx/<hash>: one testnet transaction, explained. Accepts a Cosmos hash or an
 * EVM 0x hash (looked up first). Read through the same read-only relay as the scan.
 */
import { useEffect, useState } from "react";
import { EXPLORER, cosmosHashForEvmTx, isEvmHash } from "../lib/explorer";
import { type TxDetails, parseTxDetails } from "../lib/txDetails";
import { Link } from "../router";

const REST = "/lcd-testnet";

type State = { status: "loading" } | { status: "missing"; message: string } | { status: "ok"; tx: TxDetails };

export function TxPage({ hash }: { hash: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const cosmos = isEvmHash(hash) ? await cosmosHashForEvmTx(REST, hash) : hash;
        if (!cosmos) throw new Error("This EVM transaction isn't on the testnet node (it may be older than its kept history, or on mainnet).");
        const r = await fetch(`${REST}/cosmos/tx/v1beta1/txs/${cosmos.toUpperCase()}`);
        if (!r.ok) throw new Error(r.status === 404 ? "No transaction with this hash on testnet. It may be on mainnet, or older than the node's kept history." : `The node answered ${r.status}.`);
        const tx = parseTxDetails(await r.json());
        if (live) setState({ status: "ok", tx });
      } catch (e) {
        if (live) setState({ status: "missing", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      live = false;
    };
  }, [hash]);

  return (
    <div className="page tx-page">
      <span className="kicker mono">transaction · qorechain testnet</span>
      <h1 className="tx-title mono">{hash.length > 24 ? `${hash.slice(0, 12)}…${hash.slice(-10)}` : hash}</h1>

      {state.status === "loading" && <p className="muted">Reading the transaction from testnet…</p>}
      {state.status === "missing" && <p className="status-line error">{state.message}</p>}
      {state.status === "ok" && <TxView tx={state.tx} />}

      <p className="muted tx-foot">
        Also on the <a href={`${EXPLORER}/tx/${state.status === "ok" ? state.tx.hash : hash}`} target="_blank" rel="noreferrer">QoreChain explorer</a>{" "}
        (choose <b>Testnet</b> at the top). · <Link href="/app">Back to the scanner</Link>
      </p>
    </div>
  );
}

function TxView({ tx }: { tx: TxDetails }) {
  return (
    <>
      <div className={`tx-status ${tx.ok ? "ok" : "fail"}`}>
        <b>{tx.ok ? "Succeeded" : "Failed"}</b>
        <span>
          block {tx.height.toLocaleString("en-US")}
          {tx.time && ` · ${new Date(tx.time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })}`}
        </span>
        {tx.memo && <span className="tx-memo">“{tx.memo}”</span>}
      </div>
      {tx.error && <p className="status-line error">{tx.error}</p>}

      <section className="tx-card">
        <h2>What it did</h2>
        {tx.messages.map((m, i) => (
          <div key={i} className="tx-msg">
            <div className="tx-msg-head">
              <span className="mono tx-type">{m.type}</span>
              <span>{m.summary}</span>
            </div>
            {m.fields.length > 0 && (
              <dl>
                {m.fields.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className="mono">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </section>

      <section className="tx-card">
        <h2>Post-quantum check</h2>
        {tx.hybrid ? (
          <p className={tx.hybrid.verified ? "pq-ok" : ""}>
            {tx.hybrid.verified ? "✓ " : ""}Signed with the hybrid signature: secp256k1 plus ML-DSA-87
            {tx.hybrid.algorithm ? ` (${tx.hybrid.algorithm})` : ""}. The chain{" "}
            {tx.hybrid.verified ? "verified the post-quantum half" : "recorded the post-quantum half"}.
          </p>
        ) : tx.windowUsed ? (
          <p className="pq-ok">
            ✓ An EVM transaction, admitted inside an EVM window opened with the account's post-quantum key at block{" "}
            {tx.windowUsed.openHeight.toLocaleString("en-US")}. It was transaction {tx.windowUsed.usedTxs} of that window.
          </p>
        ) : (
          <p className="muted">No hybrid signature or EVM window recorded for this transaction.</p>
        )}
        {tx.evmHash && (
          <p className="muted tx-evmhash">
            Ethereum-style hash: <span className="mono">{tx.evmHash}</span>
          </p>
        )}
      </section>

      <section className="tx-card tx-meta">
        <div>
          <dt>Fee</dt>
          <dd>{tx.fee ?? "—"}</dd>
        </div>
        <div>
          <dt>Gas used</dt>
          <dd>{tx.gasUsed !== undefined ? `${tx.gasUsed.toLocaleString("en-US")} of ${tx.gasWanted?.toLocaleString("en-US")}` : "—"}</dd>
        </div>
        <div>
          <dt>Hash</dt>
          <dd className="mono tx-hash">{tx.hash}</dd>
        </div>
      </section>
    </>
  );
}

/** /tx/<something that isn't a hash>: say so instead of silently showing the landing page. */
export function TxPathError() {
  return (
    <div className="page tx-page">
      <span className="kicker mono">transaction · qorechain testnet</span>
      <h1 className="tx-title">That isn't a transaction hash</h1>
      <p className="status-line error">A hash is 64 hex characters, with or without 0x in front.</p>
      <p className="muted tx-foot">
        <Link href="/app">Back to the scanner</Link>
      </p>
    </div>
  );
}
