import type { LiveApproval } from "../lib/evmApprovalState";
import { formatQor, formatTokenAmount, shortAddress } from "../lib/format";
import type { NativePermission } from "../lib/nativePermissions";
import { type Risk, type RiskLevel, evmApprovalRisk, nativePermissionRisk, sortByRisk } from "../lib/risk";
import type { ScanResult } from "../lib/scanAccount";

const EXPLORER_TX = "https://explore.qore.network/tx/";

function RiskTag({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk ${level}`}>
      <span className={`dot ${level}`} />
      {level}
    </span>
  );
}

/** The results view. `example` renders it as a static showcase (no links, no actions). */
export function Results({ r, example = false }: { r: ScanResult; example?: boolean }) {
  const evm = sortByRisk(r.evm, (a) => evmApprovalRisk(a, r.scannedTo));
  const native = sortByRisk(r.native, nativePermissionRisk);
  const all = [...evm, ...native];
  const count = (l: RiskLevel) => all.filter((x) => x.risk.level === l).length;

  return (
    <div className="results">
      <div className="summary">
        <div className="stat total">
          <div className="label">open permissions</div>
          <div className="value">{all.length}</div>
          <div className="account mono">{shortAddress(r.account.evm)}</div>
        </div>
        {(["high", "medium", "low"] as const).map((l) => (
          <div className={`stat ${l}`} key={l}>
            <div className="label">
              <span className={`dot ${l}`} /> {l} risk
            </div>
            <div className="value">{count(l)}</div>
            <div className="meter">
              <span style={{ width: all.length ? `${(count(l) / all.length) * 100}%` : "0%" }} />
            </div>
          </div>
        ))}
      </div>

      {r.historyLimited && !example && (
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
          <h3>
            <span className="lane-tag evm">EVM</span> Token approvals
          </h3>
          <span className="mono">
            {example ? "example" : `blocks ${r.scannedFrom.toLocaleString("en-US")} → ${r.scannedTo.toLocaleString("en-US")}`}
          </span>
        </div>
        {r.evmError ? (
          <p className="error">Could not read the EVM lane: {r.evmError}</p>
        ) : evm.length === 0 ? (
          <p className="empty">No open token approvals found.</p>
        ) : (
          evm.map(({ item, risk }) => (
            <EvmRow key={`${item.kind}:${item.token}:${item.spender}`} a={item} risk={risk} example={example} />
          ))
        )}
      </div>

      <div className="lane">
        <div className="lane-head">
          <h3>
            <span className="lane-tag native">Native</span> Grants
          </h3>
          <span className="mono">authz · fee grants · 7702</span>
        </div>
        {r.nativeError ? (
          <p className="error">Could not read the native lane: {r.nativeError}</p>
        ) : native.length === 0 ? (
          <p className="empty">No open grants found.</p>
        ) : (
          native.map(({ item, risk }, i) => <NativeRow key={i} p={item} risk={risk} />)
        )}
      </div>
    </div>
  );
}

function RevokeButton() {
  return (
    <button type="button" className="revoke" disabled title="Revoking arrives in the next build">
      Revoke
    </button>
  );
}

function EvmRow({ a, risk, example }: { a: LiveApproval; risk: Risk; example: boolean }) {
  const sym = a.tokenInfo.symbol ?? shortAddress(a.token);
  const amount = a.kind === "operator" ? "Every NFT in this collection" : formatTokenAmount(a.amount, a.tokenInfo.decimals, sym);
  const balance =
    a.balance === undefined
      ? "balance unknown"
      : `you hold ${formatTokenAmount(a.balance, a.tokenInfo.decimals, a.kind === "operator" ? "NFTs" : sym)}`;
  return (
    <div className={`row ${risk.level}`}>
      <RiskTag level={risk.level} />
      <div className="token">
        <span className="token-badge" aria-hidden>
          {sym.slice(0, 1)}
        </span>
        <div>
          <div className="cell-title">{sym}</div>
          <div className="cell-sub mono">{shortAddress(a.token)}</div>
        </div>
      </div>
      <div>
        <div className="cell-title">{amount}</div>
        <div className="cell-sub">{balance}</div>
      </div>
      <div>
        <div className="cell-title mono">{shortAddress(a.spender)}</div>
        <div className="cell-sub">
          {a.spenderIsContract ? "contract" : "ordinary wallet"}
          {a.setInTx && !example && (
            <>
              {" · "}
              <a href={`${EXPLORER_TX}${a.setInTx}`} target="_blank" rel="noreferrer">
                block {a.setAtBlock.toLocaleString("en-US")}
              </a>
            </>
          )}
        </div>
      </div>
      <RevokeButton />
      <ul className="reasons">
        {risk.reasons.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function NativeRow({ p, risk }: { p: NativePermission; risk: Risk }) {
  const limit = (c?: { denom: string; amount: string }[]) =>
    c ? c.map((x) => (x.denom === "uqor" ? formatQor(x.amount) : `${x.amount} ${x.denom}`)).join(", ") : "no limit";
  const [title, sub, who, whoSub] =
    p.kind === "eip7702"
      ? ["7702 consent", p.live ? "active" : "expired", shortAddress(p.delegate), `expires at block ${p.expiryHeight.toLocaleString("en-US")}`]
      : p.kind === "authz"
        ? [
            "Authz grant",
            (p.msgTypeUrl ?? p.authorizationType).split(".").pop()!,
            shortAddress(p.grantee),
            `${p.spendLimit ? `up to ${limit(p.spendLimit)}` : "no spend limit"} · ${p.expiration ? `expires ${new Date(p.expiration).toLocaleDateString()}` : "never expires"}`,
          ]
        : ["Fee grant", limit(p.spendLimit), shortAddress(p.grantee), p.expiration ? `expires ${new Date(p.expiration).toLocaleDateString()}` : "never expires"];
  return (
    <div className={`row ${risk.level}`}>
      <RiskTag level={risk.level} />
      <div className="token">
        <span className="token-badge native" aria-hidden>
          {title.slice(0, 1)}
        </span>
        <div>
          <div className="cell-title">{title}</div>
          <div className="cell-sub mono">{sub}</div>
        </div>
      </div>
      <div>
        <div className="cell-title">granted to</div>
        <div className="cell-sub mono">{who}</div>
      </div>
      <div>
        <div className="cell-sub">{whoSub}</div>
      </div>
      <RevokeButton />
      <ul className="reasons">
        {risk.reasons.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
