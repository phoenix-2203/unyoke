/**
 * Linked keys (authenticators): foreign keys, such as a MetaMask (secp256k1)
 * or Phantom (ed25519) key, that an account has linked so they can act for it
 * (x/abstractaccount, enabled on the testnet). They hold classical keys, the
 * kind a quantum computer could break, yet act for a post-quantum account.
 *
 * Unyoke summarises them in one line and does not revoke them: removing them
 * belongs to the wallet (QoreX's linked-signer settings).
 *
 *   GET /qorechain/abstractaccount/v1/accounts/{address}/authenticators  (404: none)
 *   GET /qorechain/abstractaccount/v1/accounts/{address}/spending_rules
 */
import type { FetchLike } from "./nativePermissions";

/** Where QoreX documents linked signers (removing them in QoreX is marked "coming"). */
export const QOREX_LINKED_SIGNERS_URL = "https://docs.qorechain.io/qorex/security-and-recovery#linked-signers";

/** Permissions that can move value (the chain requires a spending rule for them from v3.2.8). */
const VALUE_PERMISSIONS = new Set(["all", "send", "evm", "svm", "wasm", "ibc", "amm", "deploy"]);

export interface LinkedKey {
  scheme: string;
  pubkeyHex: string;
  permissions: string[];
  /** Unix seconds. */
  expiryUnix: number;
  label: string;
  hasOwnRule: boolean;
}

export interface LinkedKeys {
  /** Not revoked and not expired. */
  live: LinkedKey[];
  /** Not revoked but past their expiry: they can no longer act. */
  expired: number;
  /** An enabled account-level spending rule bounds keys without their own rule. */
  accountRule: boolean;
}

type Json = Record<string, unknown>;

export function parseLinkedKeys(authBody: unknown, rulesBody: unknown, nowUnix: number): LinkedKeys {
  const all = (((authBody ?? {}) as Json).authenticators as Json[] | undefined) ?? [];
  const keys: LinkedKey[] = all
    .filter((k) => k.revoked !== true)
    .map((k) => ({
      scheme: String(k.scheme ?? ""),
      pubkeyHex: String(k.pubkey_hex ?? ""),
      permissions: Array.isArray(k.permissions) ? k.permissions.map(String) : [],
      expiryUnix: Number(k.expiry_unix ?? 0),
      label: String(k.label ?? ""),
      hasOwnRule: k.has_spend_rule === true,
    }));
  const rules = (((rulesBody ?? {}) as Json).rules as Json[] | undefined) ?? [];
  return {
    live: keys.filter((k) => k.expiryUnix > nowUnix),
    expired: keys.filter((k) => k.expiryUnix <= nowUnix).length,
    accountRule: rules.some((r) => r.enabled === true),
  };
}

/** Read the account's linked keys. Undefined when they can't be read (the scan carries on without them). */
export async function readLinkedKeys(rest: string, qor: string, fetchFn: FetchLike = fetch, nowUnix = Date.now() / 1000): Promise<LinkedKeys | undefined> {
  const base = `${rest.replace(/\/$/, "")}/qorechain/abstractaccount/v1/accounts/${qor}`;
  try {
    const res = await fetchFn(`${base}/authenticators`);
    if (res.status === 404) return { live: [], expired: 0, accountRule: false }; // never used the module
    if (!res.ok) return undefined;
    const authBody = await res.json();
    const rulesRes = await fetchFn(`${base}/spending_rules`);
    return parseLinkedKeys(authBody, rulesRes.ok ? await rulesRes.json() : {}, nowUnix);
  } catch {
    return undefined;
  }
}

export function keyKind(k: Pick<LinkedKey, "scheme" | "pubkeyHex">): string {
  if (k.scheme === "ed25519") return "Phantom-style (ed25519)";
  if (k.scheme === "secp256k1" && k.pubkeyHex.length === 40) return "MetaMask-style";
  return k.scheme === "secp256k1" ? "secp256k1" : k.scheme;
}

export interface LinkedKeysLine {
  tone: "high" | "warn";
  title: string;
  detail: string;
}

const PERMISSION_WORDS: Record<string, string> = {
  all: "do anything a linked key may",
  send: "send QOR",
  evm: "send EVM transactions",
  svm: "run Solana-style programs",
  wasm: "call contracts",
  ibc: "send tokens to other chains",
  amm: "trade in AMM pools",
  deploy: "deploy contracts",
  delegate: "move stake",
  withdraw: "withdraw rewards",
  vote: "vote",
};

function listWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** One line for the results, or undefined when no linked key can act. */
export function describeLinkedKeys(k: LinkedKeys): LinkedKeysLine | undefined {
  if (k.live.length === 0) return undefined;
  const n = k.live.length;
  const kinds = [...new Set(k.live.map(keyKind))];
  const perms = [...new Set(k.live.flatMap((x) => x.permissions))];
  const valueKeys = k.live.filter((x) => x.permissions.some((p) => VALUE_PERMISSIONS.has(p)));
  const unbounded = valueKeys.filter((x) => !x.hasOwnRule && !k.accountRule);
  const anyAll = k.live.some((x) => x.permissions.includes("all"));
  const until = new Date(Math.max(...k.live.map((x) => x.expiryUnix)) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const who = n === 1 ? `It is a ${kinds[0]} key` : kinds.length === 1 ? `All are ${kinds[0]} keys` : `They are ${listWords(kinds)} keys`;
  const can = `${n === 1 ? "It" : "They"} can ${listWords(perms.map((p) => PERMISSION_WORDS[p] ?? p))}`;
  const bound =
    valueKeys.length === 0 ? "" : unbounded.length === 0 ? ", capped by a spending rule" : unbounded.length === valueKeys.length ? ", with no spending limit" : `; ${unbounded.length} of them with no spending limit`;
  return {
    tone: unbounded.length > 0 || anyAll ? "high" : "warn",
    title: `${n} linked key${n === 1 ? "" : "s"} can act for this account`,
    detail: `${who}: an old-style lock a quantum computer could pick, linked to a post-quantum account. ${can}${bound}, until ${until}.`,
  };
}
