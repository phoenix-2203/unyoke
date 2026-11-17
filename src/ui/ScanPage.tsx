import { qorechainTestnet } from "@qorechain/evm";
import { useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { type EvmClient, type ScanProgress, type ScanResult, scanAccount } from "../lib/scanAccount";
import { Landing } from "./Landing";
import { PermissionGraph } from "./PermissionGraph";
import { Results } from "./Results";
import { useReveal } from "./useReveal";

/** Native REST through the dev/preview proxy (the public REST API sends no CORS headers). */
const REST = "/lcd-testnet";
/** A public testnet account with open permissions, for visitors without one. */
const DEMO_ADDRESS = import.meta.env.VITE_DEMO_ADDRESS || "0x76dac5461ff361f911e5f39810c9455a6180c180";

export function ScanPage() {
  const { address: connected } = useAccount();
  const client = usePublicClient({ chainId: qorechainTestnet.id });
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<ScanProgress>();
  const [result, setResult] = useState<ScanResult>();
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController>();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scanning = progress !== undefined && progress.stage !== "done";
  useReveal([result]);

  async function run(target: string) {
    if (!client) return setError("No connection to the QoreChain testnet.");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(undefined);
    setResult(undefined);
    setProgress({ stage: "history" });
    try {
      const r = await scanAccount({ input: target, evm: client as unknown as EvmClient, rest: REST, signal: ctrl.signal, onProgress: setProgress });
      setResult(r);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(ctrl.signal.aborted ? "Scan stopped." : e instanceof Error ? e.message : String(e));
      setProgress(undefined);
    }
  }

  return (
    <>
      <section className="hero">
        <span className="pill mono">
          <span className="dot" /> Built for QoreChain
        </span>
        <h1>
          Take back every <span className="hl">permission</span>
          <br />
          you've <em>handed out.</em>
        </h1>
        <p className="lede">
          Forgotten token approvals and grants are the open door on Q-Day. Unyoke finds every one on both lanes of QoreChain,
          explains the risk, and helps you shut it.
        </p>
        <form
          className="scanbar"
          onSubmit={(e) => {
            e.preventDefault();
            void run(input || connected || "");
          }}
        >
          <svg className="scan-icon" viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="addr" className="sr-only">
            Account address
          </label>
          <input
            ref={inputRef}
            id="addr"
            value={input}
            placeholder={connected ?? "Paste a qor1… or 0x… address"}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {scanning ? (
            <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input && !connected}>
              Scan
            </button>
          )}
        </form>
        <div className="hero-actions">
          <span className="mono">read-only · no wallet needed</span>
          {!scanning && (
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setInput(DEMO_ADDRESS);
                void run(DEMO_ADDRESS);
              }}
            >
              or try a sample account →
            </button>
          )}
        </div>
        {scanning && <Progress p={progress} />}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <div ref={resultsRef}>
        {result ? (
          <section className="your-results reveal">
            <Results r={result} />
          </section>
        ) : (
          <div className="stage">
            <PermissionGraph />
          </div>
        )}
      </div>

      <Landing
        onScanClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => inputRef.current?.focus(), 400);
        }}
      />
    </>
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
    <div className="progress" aria-live="polite">
      {label[p.stage]}…
      <div className={`bar${pct === undefined ? " indeterminate" : ""}`}>
        <span style={pct !== undefined ? { width: `${pct}%` } : undefined} />
      </div>
    </div>
  );
}
