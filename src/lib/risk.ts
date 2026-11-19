/**
 * Plain-language risk for each permission. One place, tested, so the rules are
 * easy to read and argue with.
 *
 * Levels: high / medium / low. "Low" never means safe: it means "no strong
 * warning signs found". Reasons are short sentences shown next to the item.
 */
import type { LiveApproval } from "./evmApprovalState";
import { isUnlimited } from "./format";
import type { NativePermission } from "./nativePermissions";

export type RiskLevel = "high" | "medium" | "low";

export interface Risk {
  level: RiskLevel;
  /** Most important reason first. */
  reasons: string[];
}

/** About a week of testnet blocks at ~1.3 s each. */
export const OLD_APPROVAL_BLOCKS = 465_000n;

const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const max = (a: RiskLevel, b: RiskLevel): RiskLevel => (rank[a] >= rank[b] ? a : b);

export function evmApprovalRisk(a: LiveApproval, headBlock: bigint): Risk {
  let level: RiskLevel = "low";
  const reasons: string[] = [];

  if (!a.spenderIsContract) {
    level = "high";
    reasons.push("The spender is an ordinary wallet: whoever holds its key can take these tokens, and on Q-Day that key can be broken.");
  }
  if (a.kind === "operator") {
    level = max(level, "high");
    reasons.push("It can move every NFT you hold in this collection, now and in future.");
  } else if (isUnlimited(a.amount)) {
    level = max(level, "high");
    reasons.push("Unlimited: it covers all of this token you hold now and anything you receive later.");
  } else if (a.balance !== undefined && a.balance > 0n && a.amount >= a.balance) {
    level = max(level, "medium");
    reasons.push("It covers your whole current balance of this token.");
  }
  if (a.balance === 0n) {
    reasons.push("You hold none of this token right now, but anything you receive is covered.");
  }
  if (headBlock - a.setAtBlock > OLD_APPROVAL_BLOCKS) {
    reasons.push("Set more than a week ago: if you no longer use this app, remove it.");
    if (level === "low") level = "medium";
  }
  if (reasons.length === 0) reasons.push("Limited amount to a contract. No strong warning signs found.");
  return { level, reasons };
}

const SEND_LIKE = new Set(["/cosmos.bank.v1beta1.MsgSend", "/cosmos.bank.v1beta1.MsgMultiSend", "/ibc.applications.transfer.v1.MsgTransfer"]);
const STAKE_LIKE = /^\/cosmos\.staking\.v1beta1\./;

/** Messages that hand over more than their name suggests, with the reason shown to the user. */
const POWERFUL: [RegExp, string][] = [
  [/^\/cosmos\.authz\.v1beta1\.MsgGrant$/, "It can create new grants from your account, including ones that move funds."],
  [/^\/cosmos\.authz\.v1beta1\.MsgExec$/, "It can run messages as you through other grants."],
  [/^\/cosmos\.feegrant\.v1beta1\.MsgGrantAllowance$/, "It can hand your QOR out as fee allowances to anyone."],
  [/^\/cosmos\.distribution\.v1beta1\.MsgSetWithdrawAddress$/, "It can send all your future staking rewards to another address."],
  [/\.MsgConvert(Coin|ERC20)$/, "It can move your tokens between the native and EVM lanes, to a receiver it picks."],
  [/^\/cosmos\.evm\.vm\.v1\.MsgEthereumTx$/, "It can send EVM transactions as you."],
];

export function nativePermissionRisk(p: NativePermission): Risk {
  switch (p.kind) {
    case "authz": {
      const reasons: string[] = [];
      let level: RiskLevel;
      if (p.msgTypeUrl && SEND_LIKE.has(p.msgTypeUrl)) {
        level = "high";
        reasons.push(p.spendLimit ? "It can send your funds, up to its limit." : "It can send your funds with no limit.");
      } else if (p.msgTypeUrl && POWERFUL.some(([re]) => re.test(p.msgTypeUrl!))) {
        level = "high";
        reasons.push(POWERFUL.find(([re]) => re.test(p.msgTypeUrl!))![1]);
      } else if (p.msgTypeUrl === undefined) {
        level = "high";
        reasons.push("Unyoke can't tell what this grant allows. Treat it as dangerous.");
      } else if (STAKE_LIKE.test(p.msgTypeUrl)) {
        level = "medium";
        reasons.push("It can move your stake.");
      } else if (p.msgTypeUrl === "/cosmos.gov.v1.MsgVote" || p.msgTypeUrl === "/cosmos.gov.v1beta1.MsgVote") {
        level = "low";
        reasons.push("It can vote in your name, but not move funds.");
      } else {
        level = "medium";
        reasons.push(`It can send ${p.msgTypeUrl.split(".").pop()} messages for you.`);
      }
      if (!p.expiration) reasons.push("It never expires.");
      return { level, reasons };
    }
    case "feegrant": {
      const reasons = [p.spendLimit ? "It can spend your QOR on its fees, up to its limit." : "It can spend your QOR on its fees with no limit."];
      if (!p.expiration) reasons.push("It never expires.");
      return { level: p.spendLimit ? "low" : "medium", reasons };
    }
    case "eip7702":
      return p.live
        ? { level: "high", reasons: ["A contract's code can run as your EVM account. Only keep this if you know the contract."] }
        : { level: "low", reasons: ["Expired consent. Clearing it tidies up your account."] };
  }
}

export function sortByRisk<T>(items: readonly T[], riskOf: (t: T) => Risk): { item: T; risk: Risk }[] {
  return items
    .map((item) => ({ item, risk: riskOf(item) }))
    .sort((a, b) => rank[b.risk.level] - rank[a.risk.level]);
}
