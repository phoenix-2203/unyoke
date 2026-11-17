import { qorechainTestnet } from "@qorechain/evm";
import { useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import type { LiveApproval } from "../lib/evmApprovalState";
import { formatTokenAmount, shortAddress } from "../lib/format";
import type { NativePermission } from "../lib/nativePermissions";
import { type Risk, type RiskLevel, evmApprovalRisk, nativePermissionRisk, sortByRisk } from "../lib/risk";
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
      setResult(
        await scanAccount({ input: target, evm: client as unknown as EvmClient, rest: REST, signal: ctrl.signal, onProgress: setProgress }),
      );
    } catch (e) {
      setError(ctrl.signal.aborted ? "Scan stopped." : e instanceof Error ? e.message : String(e));
      setProgress(undefined);
    }
  }

  return (
    <>
      <section className="hero">
        <span className="eyebrow">
          <span className="dot" /> Q-Day hygiene for QoreChain
        </span>
        <h1>
          Take back every permission <span className="dim">you've handed out.</span>
        </h1>
        <p>
          Token approvals on the EVM lane, authz and fee grants on the native lane. Unyoke finds them, tells you which ones are
          risky, and helps you remove them.
        </p>
        <form
          className="scanbar"
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
        <p className="hint">Scanning only reads public data. No wallet needed.</p>
        {scanning && <Progress p={progress} />}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      {result && <Results r={result} />}
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

function RiskTag({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk ${level}`}>
      <span className={`dot ${level}`} />
      {level}
    </span>
  );
}

function Reasons({ risk }: { risk: Risk }) {
  return (
    <ul className="reasons">
      {risk.reasons.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

function Results({ r }: { r: ScanResult }) {
  const evm = sortByRisk(r.evm, (a) => evmApprovalRisk(a, r.scannedTo));
  const native = sortByRisk(r.native, nativePermissionRisk);
  const all = [...evm, ...native];
  const count = (l: RiskLevel) => all.filter((x) => x.risk.level === l).length;

  return (
    <section className="results">
      <div className="summary">
        <div className="stat">
          <div className="label">Open permissions</div>
          <div className="value">{all.length}</div>
        </div>
        {(["high", "medium", "low"] as const).map((l) => (
          <div className="stat" key={l}>
            <div className="label">
              <span className={`dot ${l}`} /> {l[0]!.toUpperCase() + l.slice(1)} risk
            </div>
            <div className="value">{count(l)}</div>
          </div>
        ))}
      </div>

      <div className="account-line">
        <span>
          Account <code>{r.account.evm}</code>
        </span>
        <span>
          <code>{r.account.qor}</code>
        </span>
      </div>

      {r.historyLimited && (
        <div className="notice">
          <span className="dot medium" />
          <span>
            The public testnet node keeps history only from block {r.scannedFrom.toLocaleString("en-US")}. Approvals made before
            that can't be found from history by anyone using this node.
          </span>
        </div>
      )}

      <div className="lane">
        <div className="lane-head">
          <h2>EVM lane · token approvals</h2>
          <span>
            blocks {r.scannedFrom.toLocaleString("en-US")}–{r.scannedTo.toLocaleString("en-US")}
          </span>
        </div>
        {r.evmError ? (
          <p className="error">Could not read the EVM lane: {r.evmError}</p>
        ) : evm.length === 0 ? (
          <p className="empty">No open token approvals found.</p>
        ) : (
          evm.map(({ item, risk }) => <EvmRow key={`${item.kind}:${item.token}:${item.spender}`} a={item} risk={risk} />)
        )}
      </div>

      <div className="lane">
        <div className="lane-head">
          <h2>Native lane · grants</h2>
          <span>authz · fee grants · 7702 consent</span>
        </div>
        {r.nativeError ? (
          <p className="error">Could not read the native lane: {r.nativeError}</p>
        ) : native.length === 0 ? (
          <p className="empty">No open grants found.</p>
        ) : (
          native.map(({ item, risk }, i) => <NativeRow key={i} p={item} risk={risk} />)
        )}
      </div>
    </section>
  );
}

function EvmRow({ a, risk }: { a: LiveApproval; risk: Risk }) {
  const sym = a.tokenInfo.symbol ?? shortAddress(a.token);
  const amount = a.kind === "operator" ? "Every NFT in this collection" : formatTokenAmount(a.amount, a.tokenInfo.decimals, sym);
  const balance =
    a.balance === undefined ? "balance unknown" : `you hold ${formatTokenAmount(a.balance, a.tokenInfo.decimals, a.kind === "operator" ? "NFTs" : sym)}`;
  return (
    <div className="row">
      <RiskTag level={risk.level} />
      <div>
        <div className="cell-title">{sym}</div>
        <div className="cell-sub mono">{shortAddress(a.token)}</div>
      </div>
      <div>
        <div className="cell-title">{amount}</div>
        <div className="cell-sub">{balance}</div>
      </div>
      <div>
        <div className="cell-title mono">{shortAddress(a.spender)}</div>
        <div className="cell-sub">
          {a.spenderIsContract ? "contract" : "ordinary wallet"}
          {a.setInTx && (
            <>
              {" · "}
              <a href={`${EXPLORER_TX}${a.setInTx}`} target="_blank" rel="noreferrer">
                set at block {a.setAtBlock.toLocaleString("en-US")}
              </a>
            </>
          )}
        </div>
      </div>
      <button type="button" className="danger" disabled title="Revoking arrives in the next build">
        Revoke
      </button>
      <Reasons risk={risk} />
    </div>
  );
}

function NativeRow({ p, risk }: { p: NativePermission; risk: Risk }) {
  const limit = (c?: { denom: string; amount: string }[]) => (c ? c.map((x) => `${x.amount} ${x.denom}`).join(", ") : "no limit");
  const [title, sub, who, whoSub] =
    p.kind === "eip7702"
      ? ["EIP-7702 consent", p.live ? "active" : "expired", shortAddress(p.delegate), `expires at block ${p.expiryHeight.toLocaleString("en-US")}`]
      : p.kind === "authz"
        ? [
            "Authz grant",
            (p.msgTypeUrl ?? p.authorizationType).split(".").pop()!,
            shortAddress(p.grantee),
            `${p.spendLimit ? `up to ${limit(p.spendLimit)}` : "no spend limit"} · ${p.expiration ? `expires ${new Date(p.expiration).toLocaleDateString()}` : "never expires"}`,
          ]
        : [
            "Fee grant",
            limit(p.spendLimit),
            shortAddress(p.grantee),
            p.expiration ? `expires ${new Date(p.expiration).toLocaleDateString()}` : "never expires",
          ];
  return (
    <div className="row">
      <RiskTag level={risk.level} />
      <div>
        <div className="cell-title">{title}</div>
        <div className="cell-sub mono">{sub}</div>
      </div>
      <div>
        <div className="cell-title">granted to</div>
        <div className="cell-sub mono">{who}</div>
      </div>
      <div>
        <div className="cell-sub">{whoSub}</div>
      </div>
      <button type="button" className="danger" disabled title="Revoking arrives in the next build">
        Revoke
      </button>
      <Reasons risk={risk} />
    </div>
  );
}
