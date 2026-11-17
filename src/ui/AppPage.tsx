/**
 * The scanner ("/app"). Opens with ?address=… to scan straight away.
 */
import { qorechainTestnet } from "@qorechain/evm";
import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { type EvmClient, type ScanProgress, type ScanResult, scanAccount } from "../lib/scanAccount";
import { LINKS, Link, navigate } from "../router";
import { DEMO_ADDRESS } from "./LandingPage";
import { Receipt } from "./Receipt";
import { TestSandbox } from "./TestSandbox";
import { Results } from "./Results";
import { useRevoke } from "./useRevoke";
import { evmApprovalRisk, nativePermissionRisk } from "../lib/risk";
import { ArrowUpRight, DropIcon, SearchIcon, WalletIcon } from "./icons";

/** Native REST through the dev/preview proxy (the public REST API sends no CORS headers). */
const REST = "/lcd-testnet";

export function AppPage({ initialAddress }: { initialAddress?: string }) {
  const { address: connected } = useAccount();
  const client = usePublicClient({ chainId: qorechainTestnet.id });
  const [input, setInput] = useState(initialAddress ?? "");
  const [progress, setProgress] = useState<ScanProgress>();
  const [result, setResult] = useState<ScanResult>();
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController>();
  const scanning = progress !== undefined && progress.stage !== "done";
  const { status, receipt, evmBlocker, revokeEvm, revokeNative } = useRevoke(result, REST);
  const highRisk = result
    ? {
        evm: result.evm.filter((a) => evmApprovalRisk(a, result.scannedTo).level === "high"),
        native: result.native.filter((p) => nativePermissionRisk(p).level === "high"),
      }
    : undefined;
  const [bulk, setBulk] = useState(false);
  async function revokeAllHigh() {
    if (!highRisk) return;
    setBulk(true);
    try {
      for (const p of highRisk.native) await revokeNative(p);
      if (!evmBlocker) for (const a of highRisk.evm) await revokeEvm(a);
    } finally {
      setBulk(false);
    }
  }

  async function run(target: string) {
    if (!target) return;
    if (!client) return setError("No connection to the QoreChain testnet.");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(undefined);
    setResult(undefined);
    setProgress({ stage: "history" });
    const url = `/app?address=${encodeURIComponent(target)}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState({}, "", url);
    try {
      setResult(
        await scanAccount({ input: target, evm: client as unknown as EvmClient, rest: REST, signal: ctrl.signal, onProgress: setProgress }),
      );
    } catch (e) {
      setError(ctrl.signal.aborted ? "Scan stopped." : e instanceof Error ? e.message : String(e));
      setProgress(undefined);
    }
  }

  // Scan straight away when opened with ?address=…
  useEffect(() => {
    if (initialAddress && client) void run(initialAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddress, client]);

  return (
    <div className="app-page">
      <section className="app-head">
        <div>
          <span className="kicker mono">scanner · QoreChain testnet</span>
          <h1>Scan an account</h1>
        </div>
        <div className="app-tools">
          <a className="tool" href={LINKS.qorex} target="_blank" rel="noreferrer" title="Get the QoreX wallet">
            <WalletIcon size={18} /> QoreX <ArrowUpRight size={12} />
          </a>
          <a className="tool" href={LINKS.faucet} target="_blank" rel="noreferrer" title="Free test QOR">
            <DropIcon size={18} /> Faucet <ArrowUpRight size={12} />
          </a>
        </div>
      </section>

      <form
        className="scanbar wide"
        onSubmit={(e) => {
          e.preventDefault();
          void run(input.trim() || connected || "");
        }}
      >
        <SearchIcon className="scan-icon" size={18} />
        <label htmlFor="app-addr" className="sr-only">
          Account address
        </label>
        <input
          id="app-addr"
          value={input}
          placeholder={connected ?? "Paste a qor1… or 0x… address"}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoFocus={!initialAddress}
        />
        {scanning ? (
          <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() && !connected}>
            Scan
          </button>
        )}
      </form>
      <div className="hero-actions left">
        {connected && !scanning && (
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setInput(connected);
              void run(connected);
            }}
          >
            Scan my connected wallet
          </button>
        )}
        {!scanning && (
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setInput(DEMO_ADDRESS);
              void run(DEMO_ADDRESS);
            }}
          >
            Try a sample account
          </button>
        )}
        <Link href="/#checks" className="linkish">
          What does it check?
        </Link>
      </div>

      {scanning && <Progress p={progress} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result ? (
        <section className="your-results">
          {highRisk && highRisk.evm.length + highRisk.native.length > 0 && (
            <div className="bulkbar">
              <div>
                <b>
                  {highRisk.evm.length + highRisk.native.length} high-risk permission
                  {highRisk.evm.length + highRisk.native.length === 1 ? "" : "s"}
                </b>
                <span className="muted">
                  {" "}
                  · each one is a separate approval in your wallet, and each is checked on chain afterwards
                </span>
              </div>
              <button type="button" onClick={revokeAllHigh} disabled={bulk}>
                {bulk ? "Revoking…" : "Revoke all high risk"}
              </button>
            </div>
          )}
          <WalletHint />
          <Results r={result} actions={{ status, evmBlocker, onRevokeEvm: revokeEvm, onRevokeNative: revokeNative }} />
          <Receipt account={result.account.evm} entries={receipt} />
          <TestSandbox qor={result.account.qor} evm={result.account.evm} onDone={() => run(result.account.qor)} />
        </section>
      ) : (
        !scanning && (
          <div className="app-empty">
            <p>Paste an address above, connect your wallet, or try the sample account.</p>
            <button type="button" className="ghost" onClick={() => navigate("/")}>
              Back to the overview
            </button>
          </div>
        )
      )}
    </div>
  );
}

function Progress({ p }: { p: ScanProgress }) {
  const pct = p.stage === "evm" && p.blocksTotal ? Number((p.blocksDone! * 100n) / p.blocksTotal) : undefined;
  const label: Record<ScanProgress["stage"], string> = {
    history: "finding where the node's history starts",
    evm: `reading EVM approval history${pct !== undefined ? ` · ${pct}%` : ""}`,
    live: "checking which approvals are still open",
    native: "reading native-lane grants",
    done: "done",
  };
  return (
    <div className="progress wide" aria-live="polite">
      {label[p.stage]}…
      <div className={`bar${pct === undefined ? " indeterminate" : ""}`}>
        <span style={pct !== undefined ? { width: `${pct}%` } : undefined} />
      </div>
    </div>
  );
}

/** Where revoking works today, said plainly. */
function WalletHint() {
  const inQorexBrowser = typeof window !== "undefined" && !!(window as { qorex?: unknown }).qorex && /Mobile|iPhone|Android/i.test(navigator.userAgent);
  if (inQorexBrowser) return null;
  return (
    <div className="notice subtle">
      <span className="dot" />
      <span>
        <b>Revoking works best in the QoreX mobile app.</b> Open this page in its built-in browser: it signs native revokes with
        your post-quantum key and opens a one-transaction window for each token revoke. The QoreX Chrome extension can't sign EVM
        transactions yet, so on desktop use an EVM wallet with a window you opened in QoreX.
      </span>
    </div>
  );
}
