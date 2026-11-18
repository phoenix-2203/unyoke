/** Revoke history for the scanned account, read from the chain. */
import { shortAddress } from "../lib/format";
import type { Revocation } from "../lib/history";
import type { ScanResult } from "../lib/scanAccount";
import { TxLink } from "./TxLink";

const lastPart = (typeUrl?: string) => (typeUrl ? typeUrl.split(".").pop() : undefined);

function describe(r: Revocation): string {
  if (r.lane === "EVM") {
    const token = r.tokenSymbol ?? shortAddress(r.token);
    return r.kind === "erc20"
      ? `${token}: allowance for ${shortAddress(r.spender)} set to 0`
      : `${token}: approve-all for ${shortAddress(r.spender)} turned off`;
  }
  if (r.kind === "authz") {
    const what = lastPart(r.msgTypeUrl);
    return `authz grant to ${shortAddress(r.grantee)}${what ? ` (${what})` : ""} revoked`;
  }
  if (r.kind === "feegrant") return `fee grant to ${shortAddress(r.grantee)} revoked`;
  return "EIP-7702 consent cleared";
}

const height = (r: Revocation) => (r.lane === "EVM" ? Number(r.blockNumber) : r.height);

export function History({ r }: { r: ScanResult }) {
  const items: Revocation[] = [...r.history.evm, ...r.history.native].sort((a, b) => height(b) - height(a));
  const viaUnyoke = r.history.native.filter((n) => n.viaUnyoke).length;

  return (
    <section className="history" aria-label="Revoke history">
      <div className="history-head">
        <div>
          <span className="kicker mono">revoke history</span>
          <h3>
            {items.length === 0
              ? "No revokes found"
              : `${items.length} permission${items.length === 1 ? "" : "s"} removed from this account`}
          </h3>
        </div>
        {viaUnyoke > 0 && <span className="history-badge">{viaUnyoke} through Unyoke</span>}
      </div>
      <p className="muted history-note">
        Read from the chain, so it includes revokes made with any tool, and anyone scanning this address sees the same list. It
        reaches back to block {r.scannedFrom.toLocaleString("en-US")}, as far as the public node keeps history. Revokes you make now
        show here on your next scan.
      </p>
      {r.history.nativeError && <p className="status-line error">Couldn't read native-lane history: {r.history.nativeError}</p>}
      {items.length > 0 && (
        <ol>
          {items.map((it, i) => (
            <li key={`${it.lane}-${it.txHash ?? i}-${i}`}>
              <span className={`lane-tag ${it.lane === "EVM" ? "evm" : "native"}`}>{it.lane}</span>
              <span className="history-what">{describe(it)}</span>
              {it.lane === "Native" && it.viaUnyoke && <span className="history-via">via Unyoke</span>}
              <span className="history-when mono">
                {it.lane === "Native" && it.time
                  ? new Date(it.time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                  : `block ${height(it).toLocaleString("en-US")}`}
              </span>
              {it.txHash && (
                <TxLink className="mono history-tx" hash={it.txHash}>
                  {it.txHash.slice(0, 10)}…
                </TxLink>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
