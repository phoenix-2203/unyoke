import type { LiveApproval } from "../lib/evmApprovalState";
import { type LinkedKeys, QOREX_LINKED_SIGNERS_URL, describeLinkedKeys } from "../lib/linkedKeys";
import { type PqcKeyStatus, describePqcKey } from "../lib/pqcKey";
import { formatQor, formatTokenAmount, shortAddress } from "../lib/format";
import type { NativePermission } from "../lib/nativePermissions";
import { type Risk, type RiskLevel, evmApprovalRisk, nativePermissionRisk, sortByRisk } from "../lib/risk";
import { permissionKey } from "../lib/revoke";
import type { ScanResult } from "../lib/scanAccount";
import type { RevokeStatus } from "./useRevoke";
import { TxLink } from "./TxLink";


export interface RevokeActions {
  status: Record<string, RevokeStatus>;
  /** Set when EVM revokes can't be sent yet (e.g. wrong wallet connected). */
  evmBlocker?: string;
  onRevokeEvm: (a: LiveApproval) => void;
  onRevokeNative: (p: NativePermission) => void;
}

function RiskTag({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk ${level}`}>
      <span className={`dot ${level}`} />
      {level}
    </span>
  );
}

function PqcKeyNote({ k }: { k: PqcKeyStatus }) {
  const line = describePqcKey(k);
  return (
    <div className={`pq-key ${line.tone}`}>
      <span className={`dot ${line.tone === "ok" ? "low" : "medium"}`} />
      <span>
        <b>{line.title}.</b> {line.detail}{" "}
        <span className="pq-key-src mono">read on chain by PqcKeyCheck</span>
      </span>
    </div>
  );
}

function LinkedKeysNote({ k }: { k: LinkedKeys }) {
  const line = describeLinkedKeys(k);
  if (!line) return null;
  return (
    <div className={`pq-key ${line.tone}`}>
      <span className={`dot ${line.tone === "high" ? "high" : "medium"}`} />
      <span>
        <b>{line.title}.</b> {line.detail}{" "}
        <a href={QOREX_LINKED_SIGNERS_URL} target="_blank" rel="noreferrer" className="pq-key-link">
          Linked signers in QoreX ↗
        </a>{" "}
        <span className="pq-key-src mono">removing them in QoreX is coming · read on chain</span>
      </span>
    </div>
  );
}

/** The results view. `example` renders it as a static showcase (no links, no actions). */
export function Results({ r, example = false, actions }: { r: ScanResult; example?: boolean; actions?: RevokeActions }) {
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

      {r.pqcKey && !example && <PqcKeyNote k={r.pqcKey} />}
      {r.linkedKeys && !example && <LinkedKeysNote k={r.linkedKeys} />}

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
          <p className="empty">
            No open token approvals found.
            {r.accountKind === "cosmos" && (
              <span className="empty-note">
                {" "}
                This is a Cosmos-style account (QoreX's default kind), which can't sign EVM transactions, so it can't give token
                approvals at all. To use tokens, add an Ethereum-style account in QoreX (<i>Add an Ethereum account</i>).
              </span>
            )}
          </p>
        ) : (
          evm.map(({ item, risk }) => (
            <EvmRow key={`${item.kind}:${item.token}:${item.spender}`} a={item} risk={risk} example={example} actions={actions} />
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
          native.map(({ item, risk }, i) => <NativeRow key={i} p={item} risk={risk} actions={actions} />)
        )}
      </div>
    </div>
  );
}

const LABEL: Record<RevokeStatus["state"], string> = {
  idle: "Revoke",
  signing: "Confirm in wallet…",
  confirming: "Confirming…",
  verifying: "Checking…",
  done: "Revoked ✓",
  failed: "Try again",
};

function RevokeButton({ st, blocked, onClick }: { st?: RevokeStatus; blocked?: string; onClick?: () => void }) {
  const state = st?.state ?? "idle";
  const busy = state === "signing" || state === "confirming" || state === "verifying";
  if (!onClick) {
    return (
      <button type="button" className="revoke" disabled title="Example only">
        Revoke
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`revoke ${state}`}
      disabled={busy || state === "done" || !!blocked}
      title={blocked}
      onClick={onClick}
    >
      {LABEL[state]}
    </button>
  );
}

function StatusLine({ st, blocked }: { st?: RevokeStatus; blocked?: string }) {
  if (st?.state === "failed") return <p className="status-line error">{st.error}</p>;
  if (st?.txHash) {
    return (
      <p className={`status-line ${st.state === "done" ? "ok" : ""}`}>
        <TxLink hash={st.txHash} className="mono">
          tx {st.txHash.slice(0, 10)}…
        </TxLink>
        {st.evidence?.found && (
          <span>
            {" · "}
            {st.evidence.tight
              ? `QoreX window: this token only, ${st.evidence.maxTxs} tx, used up ✓`
              : `window: ${st.evidence.allowedTargets.length || "any"} contract(s), ${st.evidence.maxTxs} tx`}
          </span>
        )}
      </p>
    );
  }
  if (blocked) return <p className="status-line muted">{blocked}</p>;
  return null;
}

function EvmRow({ a, risk, example, actions }: { a: LiveApproval; risk: Risk; example: boolean; actions?: RevokeActions }) {
  const st = actions?.status[permissionKey(a)];
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
              <TxLink hash={a.setInTx}>block {a.setAtBlock.toLocaleString("en-US")}</TxLink>
            </>
          )}
        </div>
      </div>
      <RevokeButton st={st} blocked={actions?.evmBlocker} onClick={actions ? () => actions.onRevokeEvm(a) : undefined} />
      <ul className="reasons">
        {risk.reasons.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <StatusLine st={st} blocked={actions && st?.state !== "done" ? actions.evmBlocker : undefined} />
    </div>
  );
}

function NativeRow({ p, risk, actions }: { p: NativePermission; risk: Risk; actions?: RevokeActions }) {
  const st = actions?.status[permissionKey(p)];
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
      <RevokeButton st={st} onClick={actions ? () => actions.onRevokeNative(p) : undefined} />
      <ul className="reasons">
        {risk.reasons.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <StatusLine st={st} />
    </div>
  );
}
