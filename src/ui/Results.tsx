import { useMemo, useState } from "react";
import type { LiveApproval } from "../lib/evmApprovalState";
import { type PqcKeyStatus, describePqcKey } from "../lib/pqcKey";
import { shortAddress } from "../lib/format";
import type { NativePermission } from "../lib/nativePermissions";
import { type LaneFilter, type PermissionRow, type SortBy, evmRow, nativeRow, selectRows } from "../lib/permissionRows";
import type { RiskLevel } from "../lib/risk";
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

/** The results view. `example` renders it as a static showcase (no links, no actions). */
export function Results({ r, example = false, actions, evmProgress }: { r: ScanResult; example?: boolean; actions?: RevokeActions; evmProgress?: string }) {
  const pending = r.evmPending === true;
  const rows = useMemo(
    () => [...(pending ? [] : r.evm.map((a) => evmRow(a, r.scannedTo))), ...r.native.map(nativeRow)],
    [r, pending],
  );
  const [text, setText] = useState("");
  const [lane, setLane] = useState<LaneFilter>("all");
  const [sort, setSort] = useState<SortBy>("risk");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const shown = selectRows(rows, { text, lane, sort });
  const count = (l: RiskLevel) => rows.filter((x) => x.level === l).length;
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const chips: [LaneFilter, string, number][] = [
    ["all", "All", rows.length],
    ["high", "High risk", count("high")],
    ["evm", "EVM", rows.filter((x) => x.lane === "evm").length],
    ["native", "Native", rows.filter((x) => x.lane === "native").length],
  ];

  return (
    <div className="results">
      <div className="summary">
        <div className="stat total">
          <div className="label">open permissions</div>
          <div className="value">{pending ? `${rows.length}+` : rows.length}</div>
          <div className="account mono">{shortAddress(r.account.evm)}</div>
        </div>
        {(["high", "medium", "low"] as const).map((l) => (
          <div className={`stat ${l}`} key={l}>
            <div className="label">
              <span className={`dot ${l}`} /> {l} risk
            </div>
            <div className="value">{count(l)}</div>
            <div className="meter">
              <span style={{ width: rows.length ? `${(count(l) / rows.length) * 100}%` : "0%" }} />
            </div>
          </div>
        ))}
      </div>

      {r.pqcKey && !example && <PqcKeyNote k={r.pqcKey} />}

      {r.historyLimited && !example && !pending && (
        <div className="notice">
          <span className="dot medium" />
          <span>
            The public testnet node keeps history only from block {r.scannedFrom.toLocaleString("en-US")}. Approvals made before
            that can't be found from history by anyone using this node.
          </span>
        </div>
      )}
      {r.evmError && <p className="error">Could not read the EVM lane: {r.evmError}</p>}
      {r.nativeError && <p className="error">Could not read the native lane: {r.nativeError}</p>}

      <div className="ptable" role="table" aria-label="Open permissions">
        <div className="ptools">
          <div className="chips" role="group" aria-label="Show">
            {chips.map(([k, label, n]) => (
              <button key={k} type="button" className={`chip${lane === k ? " on" : ""}`} aria-pressed={lane === k} onClick={() => setLane(k)}>
                {label} <span className="mono">{n}</span>
              </button>
            ))}
          </div>
          <div className="ptools-right">
            <label className="sr-only" htmlFor={`find-${example ? "ex" : "app"}`}>Search permissions</label>
            <input
              id={`find-${example ? "ex" : "app"}`}
              className="find"
              placeholder="Search token, grant or address"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <label className="sr-only" htmlFor={`sort-${example ? "ex" : "app"}`}>Sort by</label>
            <select id={`sort-${example ? "ex" : "app"}`} className="sort" value={sort} onChange={(e) => setSort(e.target.value as SortBy)}>
              <option value="risk">Risk first</option>
              <option value="lane">Lane</option>
              <option value="holder">Who holds it</option>
            </select>
          </div>
        </div>

        <div className="prow phead" role="row">
          <span role="columnheader">Risk</span>
          <span role="columnheader">Permission</span>
          <span role="columnheader">Lane</span>
          <span role="columnheader">Allowance</span>
          <span role="columnheader">Held by</span>
          <span role="columnheader"><span className="sr-only">Action</span></span>
        </div>

        {shown.map((row) => (
          <PermissionLine
            key={row.key}
            row={row}
            open={open.has(row.key)}
            onToggle={() => toggle(row.key)}
            example={example}
            actions={actions}
          />
        ))}

        {pending && <PendingRows label={evmProgress ?? "reading EVM approval history"} />}

        {!pending && shown.length === 0 && (
          <p className="empty">
            {rows.length === 0 ? "No open permissions found on either lane." : "Nothing matches this filter."}
            {rows.length === 0 && r.accountKind === "cosmos" && (
              <span className="empty-note">
                {" "}
                This is a Cosmos-style account (QoreX's default kind), which can't sign EVM transactions, so it can't give token
                approvals at all. To use tokens, add an Ethereum-style account in QoreX (<i>Add an Ethereum account</i>).
              </span>
            )}
          </p>
        )}
        <div className="pfoot mono">
          {example ? "example scan" : pending ? "native lane read · EVM lane still loading" : `EVM blocks ${r.scannedFrom.toLocaleString("en-US")} → ${r.scannedTo.toLocaleString("en-US")} · native: authz, fee grants, 7702`}
        </div>
      </div>
    </div>
  );
}

/** Placeholder rows while the EVM history is still being read. */
function PendingRows({ label }: { label: string }) {
  return (
    <div className="pending" aria-live="polite">
      {[0, 1].map((i) => (
        <div className="prow skeleton" key={i} aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
      ))}
      <p className="pending-label mono">EVM lane: {label}…</p>
    </div>
  );
}

function PermissionLine({ row, open, onToggle, example, actions }: { row: PermissionRow; open: boolean; onToggle: () => void; example: boolean; actions?: RevokeActions }) {
  const st = actions?.status[row.key];
  const evm = row.source.lane === "evm" ? row.source.item : undefined;
  const native = row.source.lane === "native" ? row.source.item : undefined;
  const blocked = evm ? actions?.evmBlocker : undefined;
  const onRevoke = actions ? () => (evm ? actions.onRevokeEvm(evm) : actions.onRevokeNative(native!)) : undefined;
  const detailsId = `why-${row.key.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className={`prow ${row.level}${open ? " open" : ""}`} role="row">
      <span role="cell"><RiskTag level={row.level} /></span>
      <span role="cell" className="pcell-main">
        <button type="button" className="pwhy" aria-expanded={open} aria-controls={detailsId} onClick={onToggle}>
          <span className={`token-badge ${row.lane === "native" ? "native" : ""}`} aria-hidden>{row.title.slice(0, 1)}</span>
          <span>
            <span className="cell-title">{row.title}</span>
            <span className="cell-sub">{row.sub}</span>
          </span>
          <span className="chev" aria-hidden>›</span>
        </button>
      </span>
      <span role="cell"><span className={`lane-tag ${row.lane}`}>{row.lane === "evm" ? "EVM" : "Native"}</span></span>
      <span role="cell">
        <span className="cell-title">{row.allowance}</span>
        <span className="cell-sub">{row.allowanceSub}</span>
      </span>
      <span role="cell">
        <span className="cell-title mono" title={row.holderFull}>{row.holder}</span>
        <span className="cell-sub">
          {row.holderSub}
          {evm?.setInTx && !example && (
            <>
              {" · "}
              <TxLink hash={evm.setInTx}>block {evm.setAtBlock.toLocaleString("en-US")}</TxLink>
            </>
          )}
        </span>
      </span>
      <span role="cell" className="pcell-act">
        <RevokeButton st={st} blocked={blocked} onClick={onRevoke} />
      </span>
      <div className="pdetail" id={detailsId} hidden={!open}>
        <ul className="reasons">
          {row.reasons.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <StatusLine st={st} blocked={actions && st?.state !== "done" ? blocked : undefined} />
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
