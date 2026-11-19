/**
 * Standing permissions on QoreChain's native (Cosmos) lane that an account has
 * handed to someone else, read over the public REST API:
 *
 * - authz grants: another account may send certain messages on your behalf
 *   GET /cosmos/authz/v1beta1/grants/granter/{granter}
 * - fee grants: another account may spend your QOR on its fees
 *   GET /cosmos/feegrant/v1beta1/issued/{granter}
 * - EIP-7702 delegation consent: lets your EVM account run a contract's code
 *   GET /qorechain/pqc/v1/evm_delegation_consent/{address}
 *
 * Each comes with the native message that removes it. Those are signed by
 * QoreX directly (hybrid signature); no EVM window is involved.
 * Linked keys (authenticators) are out of scope: they are keys linked to act
 * for the account, managed by the wallet, not permissions handed to an app.
 */
import { authz, clearEvmDelegationMsg, feegrant } from "@qorechain/sdk";
import type { EncodeObjectLike } from "./qorexMessage";

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface AuthzGrant {
  kind: "authz";
  granter: string;
  grantee: string;
  /** The authorization type, e.g. /cosmos.authz.v1beta1.GenericAuthorization. */
  authorizationType: string;
  /** For a generic grant: the message type the grantee may send. */
  msgTypeUrl?: string;
  /** For a send grant: the spend limit, e.g. [{ denom: "uqor", amount: "5000000" }]. */
  spendLimit?: { denom: string; amount: string }[];
  /** ISO time, or null when the grant never expires. */
  expiration: string | null;
}

export interface FeeGrant {
  kind: "feegrant";
  granter: string;
  grantee: string;
  allowanceType: string;
  spendLimit?: { denom: string; amount: string }[];
  expiration: string | null;
}

export interface DelegationConsent {
  kind: "eip7702";
  account: string;
  /** 0x contract the consent names. */
  delegate: string;
  live: boolean;
  /** Delegation currently installed on the account (empty when none). */
  currentDelegate: string;
  expiryHeight: bigint;
}

export type NativePermission = AuthzGrant | FeeGrant | DelegationConsent;

/** The authz MsgRevoke needs the message type: send grants authorize MsgSend. */
const AUTHORIZATION_MSG: Record<string, string> = {
  "/cosmos.bank.v1beta1.SendAuthorization": "/cosmos.bank.v1beta1.MsgSend",
};
/** A stake grant covers one staking message, named by its authorization_type. */
const STAKE_MSG: Record<string, string> = {
  AUTHORIZATION_TYPE_DELEGATE: "/cosmos.staking.v1beta1.MsgDelegate",
  AUTHORIZATION_TYPE_UNDELEGATE: "/cosmos.staking.v1beta1.MsgUndelegate",
  AUTHORIZATION_TYPE_REDELEGATE: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
  AUTHORIZATION_TYPE_CANCEL_UNBONDING_DELEGATION: "/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation",
};

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
/** A coin list, or undefined when there is none. The chain returns `spend_limit: []` for "no limit". */
const coins = (v: unknown) =>
  Array.isArray(v) && v.length > 0 ? v.map((c) => ({ denom: String((c as Json).denom), amount: String((c as Json).amount) })) : undefined;

/** Which message type an authz grant covers (needed to revoke it). */
export function authzMsgTypeUrl(authorization: Json): string | undefined {
  const type = str(authorization["@type"]);
  if (!type) return undefined;
  if (type === "/cosmos.authz.v1beta1.GenericAuthorization") return str(authorization.msg);
  if (type === "/cosmos.staking.v1beta1.StakeAuthorization") return STAKE_MSG[str(authorization.authorization_type) ?? ""];
  return AUTHORIZATION_MSG[type];
}

export function parseAuthzGrants(body: unknown): AuthzGrant[] {
  const grants = ((body as Json)?.grants as Json[] | undefined) ?? [];
  return grants.map((g) => {
    const auth = (g.authorization as Json) ?? {};
    return {
      kind: "authz" as const,
      granter: String(g.granter),
      grantee: String(g.grantee),
      authorizationType: str(auth["@type"]) ?? "unknown",
      msgTypeUrl: authzMsgTypeUrl(auth),
      spendLimit: coins(auth.spend_limit),
      expiration: str(g.expiration) ?? null,
    };
  });
}

/** Fee allowances can be wrapped (allowed-message, periodic); find the spend limit and expiry inside. */
function unwrapAllowance(a: Json): { spendLimit?: { denom: string; amount: string }[]; expiration: string | null } {
  if (a.allowance && typeof a.allowance === "object") return unwrapAllowance(a.allowance as Json);
  if (a.basic && typeof a.basic === "object") return unwrapAllowance(a.basic as Json);
  return { spendLimit: coins(a.spend_limit), expiration: str(a.expiration) ?? null };
}

export function parseFeeGrants(body: unknown): FeeGrant[] {
  const list = ((body as Json)?.allowances as Json[] | undefined) ?? [];
  return list.map((g) => {
    const allowance = (g.allowance as Json) ?? {};
    return {
      kind: "feegrant" as const,
      granter: String(g.granter),
      grantee: String(g.grantee),
      allowanceType: str(allowance["@type"]) ?? "unknown",
      ...unwrapAllowance(allowance),
    };
  });
}

export function parseDelegationConsent(account: string, body: unknown): DelegationConsent | null {
  const b = (body as Json) ?? {};
  if (b.found !== true) return null;
  return {
    kind: "eip7702",
    account,
    delegate: String(b.delegate ?? ""),
    live: b.live === true,
    currentDelegate: String(b.current_delegate ?? ""),
    expiryHeight: BigInt(String(b.expiry_height ?? "0")),
  };
}

async function getJson(fetchFn: FetchLike, url: string): Promise<unknown> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`QoreChain REST answered ${res.status} for ${url}`);
  return res.json();
}

/**
 * Follow `pagination.next_key` so an account with many grants is read in full
 * (a first page alone would make the rest look absent). Capped as a safety net.
 */
async function getAllPages(fetchFn: FetchLike, url: string, listKey: string, maxPages = 50): Promise<unknown> {
  const all: unknown[] = [];
  let key: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const body = (await getJson(fetchFn, key ? `${url}&pagination.key=${encodeURIComponent(key)}` : url)) as Json;
    all.push(...(((body?.[listKey] as unknown[]) ?? [])));
    key = str((body?.pagination as Json | undefined)?.next_key) || undefined;
    if (!key) return { [listKey]: all };
  }
  throw new Error(`This account has more than ${maxPages} pages of ${listKey}; Unyoke stopped rather than show a partial list.`);
}

/** Read every native-lane permission `qorAddress` has granted. */
export async function readNativePermissions(rest: string, qorAddress: string, fetchFn: FetchLike = fetch): Promise<NativePermission[]> {
  const base = rest.replace(/\/$/, "");
  const [authzBody, feeBody, consentBody] = await Promise.all([
    getAllPages(fetchFn, `${base}/cosmos/authz/v1beta1/grants/granter/${qorAddress}?pagination.limit=200`, "grants"),
    getAllPages(fetchFn, `${base}/cosmos/feegrant/v1beta1/issued/${qorAddress}?pagination.limit=200`, "allowances"),
    getJson(fetchFn, `${base}/qorechain/pqc/v1/evm_delegation_consent/${qorAddress}`),
  ]);
  const consent = parseDelegationConsent(qorAddress, consentBody);
  return [...parseAuthzGrants(authzBody), ...parseFeeGrants(feeBody), ...(consent ? [consent] : [])];
}

/** The native message that removes a permission. */
export function revokeMessageFor(p: NativePermission): EncodeObjectLike {
  switch (p.kind) {
    case "authz":
      if (!p.msgTypeUrl) {
        throw new Error(`Unyoke can't tell which message type this grant (${p.authorizationType}) covers, so it can't build the revoke.`);
      }
      return authz.revoke({ granter: p.granter, grantee: p.grantee, msgTypeUrl: p.msgTypeUrl });
    case "feegrant":
      return feegrant.revoke({ granter: p.granter, grantee: p.grantee });
    case "eip7702":
      return clearEvmDelegationMsg(p.account);
  }
}
