/**
 * One list of permissions across both lanes, shaped for a compact table:
 * one row each, ranked by risk, with search, a lane filter and a sort.
 */
import type { LiveApproval } from "./evmApprovalState";
import { formatQor, formatTokenAmount, shortAddress } from "./format";
import type { NativePermission } from "./nativePermissions";
import { type RiskLevel, evmApprovalRisk, nativePermissionRisk } from "./risk";
import { permissionKey } from "./revoke";

export interface PermissionRow {
  key: string;
  lane: "evm" | "native";
  level: RiskLevel;
  reasons: string[];
  /** What was handed out: the token, or the kind of grant. */
  title: string;
  /** Second line: the token contract, or the grant's message type. */
  sub: string;
  /** How much: "Unlimited fUSD", "up to 5 QOR", "every NFT in the collection". */
  allowance: string;
  allowanceSub: string;
  /** Who holds it, shortened, and in full for search. */
  holder: string;
  holderFull: string;
  holderSub: string;
  source: { lane: "evm"; item: LiveApproval } | { lane: "native"; item: NativePermission };
}

const RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

const limit = (c?: { denom: string; amount: string }[]) =>
  c ? c.map((x) => (x.denom === "uqor" ? formatQor(x.amount) : `${x.amount} ${x.denom}`)).join(", ") : "no limit";

export function evmRow(a: LiveApproval, headBlock: bigint): PermissionRow {
  const risk = evmApprovalRisk(a, headBlock);
  const sym = a.tokenInfo.symbol ?? shortAddress(a.token);
  return {
    key: permissionKey(a),
    lane: "evm",
    level: risk.level,
    reasons: risk.reasons,
    title: sym,
    sub: a.kind === "operator" ? "NFT approve-all" : "Token approval",
    allowance: a.kind === "operator" ? "Every NFT in the collection" : formatTokenAmount(a.amount, a.tokenInfo.decimals, sym),
    allowanceSub:
      a.balance === undefined
        ? "balance unknown"
        : `you hold ${formatTokenAmount(a.balance, a.tokenInfo.decimals, a.kind === "operator" ? "NFTs" : sym)}`,
    holder: shortAddress(a.spender),
    holderFull: a.spender,
    holderSub: a.spenderIsContract ? "contract" : "ordinary wallet",
    source: { lane: "evm", item: a },
  };
}

export function nativeRow(p: NativePermission): PermissionRow {
  const risk = nativePermissionRisk(p);
  const base = { key: permissionKey(p), lane: "native" as const, level: risk.level, reasons: risk.reasons, source: { lane: "native" as const, item: p } };
  if (p.kind === "eip7702") {
    return {
      ...base,
      title: "EIP-7702 consent",
      sub: p.live ? "active" : "expired",
      allowance: "Run code as your account",
      allowanceSub: `until block ${p.expiryHeight.toLocaleString("en-US")}`,
      holder: shortAddress(p.delegate),
      holderFull: p.delegate,
      holderSub: "delegate contract",
    };
  }
  const expires = p.expiration ? `expires ${new Date(p.expiration).toLocaleDateString("en-GB")}` : "never expires";
  if (p.kind === "authz") {
    const msg = (p.msgTypeUrl ?? p.authorizationType).split(".").pop()!;
    return {
      ...base,
      title: "Authz grant",
      sub: msg,
      allowance: p.spendLimit ? `up to ${limit(p.spendLimit)}` : msg === "MsgSend" ? "no spend limit" : "acts for you",
      allowanceSub: expires,
      holder: shortAddress(p.grantee),
      holderFull: p.grantee,
      holderSub: "grantee",
    };
  }
  return {
    ...base,
    title: "Fee grant",
    sub: "pays their fees",
    allowance: limit(p.spendLimit),
    allowanceSub: expires,
    holder: shortAddress(p.grantee),
    holderFull: p.grantee,
    holderSub: "grantee",
  };
}

export type LaneFilter = "all" | "evm" | "native" | "high";
export type SortBy = "risk" | "holder" | "lane";

export interface RowQuery {
  text?: string;
  lane?: LaneFilter;
  sort?: SortBy;
}

/** Search (token, grant, holder, amount), a lane or high-risk filter, then sort (risk first by default). */
export function selectRows(rows: PermissionRow[], q: RowQuery = {}): PermissionRow[] {
  const text = (q.text ?? "").trim().toLowerCase();
  const lane = q.lane ?? "all";
  const out = rows.filter((r) => {
    if (lane === "evm" || lane === "native") { if (r.lane !== lane) return false; }
    if (lane === "high" && r.level !== "high") return false;
    if (!text) return true;
    return [r.title, r.sub, r.allowance, r.holder, r.holderFull, r.holderSub].some((s) => s.toLowerCase().includes(text));
  });
  const by = q.sort ?? "risk";
  const cmp = (a: PermissionRow, b: PermissionRow) => {
    if (by === "holder") return a.holderFull.localeCompare(b.holderFull) || RANK[a.level] - RANK[b.level];
    if (by === "lane") return a.lane.localeCompare(b.lane) || RANK[a.level] - RANK[b.level];
    return RANK[a.level] - RANK[b.level] || a.lane.localeCompare(b.lane);
  };
  return [...out].sort(cmp);
}
