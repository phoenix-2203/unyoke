/**
 * Turn a REST transaction (GET /cosmos/tx/v1beta1/txs/{hash}) into what a
 * person needs to see: did it work, what did it do, and which post-quantum
 * protection let it through (a hybrid ML-DSA-87 signature on the native lane,
 * or an EVM window on the EVM lane).
 *
 * Unyoke shows this on its own /tx page because the public explorer opens on
 * mainnet and has no link that lands on testnet.
 */
import { type Hex, decodeFunctionData, erc20Abi, formatUnits, parseTransaction } from "viem";
import { approvalForAllAbi } from "./evmApprovalState";
import { formatQor, isUnlimited, shortAddress } from "./format";

export interface TxMessage {
  /** Short name, e.g. MsgRevoke. */
  type: string;
  /** One plain sentence. */
  summary: string;
  /** Label/value pairs worth showing. */
  fields: [string, string][];
}

export interface TxDetails {
  hash: string;
  height: number;
  time?: string;
  ok: boolean;
  error?: string;
  memo: string;
  fee?: string;
  gasUsed?: number;
  gasWanted?: number;
  messages: TxMessage[];
  /** Native lane: the ML-DSA-87 half of the hybrid signature, as the chain judged it. */
  hybrid?: { attached: boolean; verified: boolean; algorithm?: string };
  /** EVM lane: the window that admitted this transaction. */
  windowUsed?: { openHeight: number; usedTxs: number; usedValue: string };
  /** EVM lane: the Ethereum-style hash. */
  evmHash?: string;
}

type Attr = { key: string; value: string };
type Ev = { type: string; attributes?: Attr[] };

const attrs = (ev?: Ev) => Object.fromEntries((ev?.attributes ?? []).map((a) => [a.key, a.value]));
const short = (typeUrl: string) => typeUrl.split(".").pop() ?? typeUrl;
const addr = (s: unknown) => (typeof s === "string" && s ? shortAddress(s) : "—");

function feeText(fee: { amount?: { denom: string; amount: string }[] } | undefined): string | undefined {
  const c = fee?.amount?.[0];
  if (!c) return undefined;
  if (c.denom === "uqor") return formatQor(BigInt(c.amount));
  if (c.denom === "aqor") return `${formatUnits(BigInt(c.amount), 18)} QOR`;
  return `${c.amount} ${c.denom}`;
}

function describeEvm(raw: string): TxMessage {
  try {
    const tx = parseTransaction(raw as Hex);
    const to = tx.to ?? undefined;
    const fields: [string, string][] = [["Contract", to ?? "—"]];
    if (tx.data && tx.data !== "0x") {
      for (const abi of [erc20Abi, approvalForAllAbi] as const) {
        try {
          const call = decodeFunctionData({ abi, data: tx.data });
          if (call.functionName === "approve") {
            const [spender, amount] = call.args as [Hex, bigint];
            fields.push(["Spender", spender], ["Amount", amount === 0n ? "0" : isUnlimited(amount) ? "unlimited" : amount.toString()]);
            return {
              type: "approve",
              summary: amount === 0n ? `Revoked the allowance for ${shortAddress(spender)} (set to 0).` : `Approved ${shortAddress(spender)} to spend tokens.`,
              fields,
            };
          }
          if (call.functionName === "setApprovalForAll") {
            const [operator, on] = call.args as [Hex, boolean];
            fields.push(["Operator", operator], ["Approved", String(on)]);
            return {
              type: "setApprovalForAll",
              summary: on ? `Let ${shortAddress(operator)} move every NFT in this collection.` : `Turned off approve-all for ${shortAddress(operator)}.`,
              fields,
            };
          }
          return { type: call.functionName, summary: `Called ${call.functionName} on ${addr(to)}.`, fields };
        } catch {
          /* try the next ABI */
        }
      }
    }
    return { type: "EVM transaction", summary: to ? `EVM transaction to ${shortAddress(to)}.` : "EVM contract creation.", fields };
  } catch {
    return { type: "EVM transaction", summary: "EVM transaction.", fields: [] };
  }
}

function describeMessage(m: Record<string, unknown>): TxMessage {
  const typeUrl = String(m["@type"] ?? "");
  switch (typeUrl) {
    case "/cosmos.authz.v1beta1.MsgRevoke":
      return {
        type: "MsgRevoke",
        summary: `Revoked the authz grant that let ${addr(m.grantee)} send ${short(String(m.msg_type_url ?? ""))} messages for ${addr(m.granter)}.`,
        fields: [["Granter", String(m.granter)], ["Grantee", String(m.grantee)], ["Covered", String(m.msg_type_url)]],
      };
    case "/cosmos.authz.v1beta1.MsgGrant":
      return { type: "MsgGrant", summary: `Gave ${addr(m.grantee)} an authz grant.`, fields: [["Granter", String(m.granter)], ["Grantee", String(m.grantee)]] };
    case "/cosmos.feegrant.v1beta1.MsgRevokeAllowance":
      return {
        type: "MsgRevokeAllowance",
        summary: `Revoked the fee grant that let ${addr(m.grantee)} spend ${addr(m.granter)}'s QOR on fees.`,
        fields: [["Granter", String(m.granter)], ["Grantee", String(m.grantee)]],
      };
    case "/cosmos.feegrant.v1beta1.MsgGrantAllowance":
      return { type: "MsgGrantAllowance", summary: `Gave ${addr(m.grantee)} a fee grant.`, fields: [["Granter", String(m.granter)], ["Grantee", String(m.grantee)]] };
    case "/qorechain.pqc.v1.MsgClearEVMDelegation":
      return { type: "MsgClearEVMDelegation", summary: `Cleared the EIP-7702 consent of ${addr(m.sender)}.`, fields: [["Account", String(m.sender)]] };
    case "/qorechain.pqc.v1.MsgOpenEVMWindow": {
      const targets = Array.isArray(m.allowed_targets) ? (m.allowed_targets as string[]) : [];
      return {
        type: "MsgOpenEVMWindow",
        summary: `Opened an EVM window: ${targets.length ? `only ${targets.map(shortAddress).join(", ")}` : "any contract"}, ${m.max_txs} tx, ${m.blocks} blocks.`,
        fields: [
          ["Account", String(m.sender)],
          ["Allowed contracts", targets.join(", ") || "any"],
          ["Max transactions", String(m.max_txs)],
          ["Blocks", String(m.blocks)],
          ["Value cap", formatQor(BigInt(String(m.max_value ?? "0")))],
        ],
      };
    }
    case "/cosmos.evm.vm.v1.MsgEthereumTx":
      return describeEvm(String(m.raw ?? ""));
    default:
      return { type: short(typeUrl), summary: `${short(typeUrl)} message.`, fields: [] };
  }
}

export function parseTxDetails(body: unknown): TxDetails {
  const b = (body ?? {}) as {
    tx?: {
      body?: { memo?: string; messages?: Record<string, unknown>[]; extension_options?: Record<string, unknown>[] };
      auth_info?: { fee?: { amount?: { denom: string; amount: string }[] } };
    };
    tx_response?: { txhash?: string; height?: string; timestamp?: string; code?: number; raw_log?: string; gas_used?: string; gas_wanted?: string; events?: Ev[] };
  };
  const r = b.tx_response ?? {};
  const events = r.events ?? [];
  const find = (type: string) => events.find((e) => e.type === type);
  const ext = b.tx?.body?.extension_options ?? [];
  const hybridExt = ext.some((e) => e["@type"] === "/qorechain.pqc.v1.PQCHybridSignature");
  const verify = attrs(find("pqc_hybrid_verify"));
  const used = find("pqc_evm_window_used");
  const usedA = attrs(used);
  const eth = attrs(find("ethereum_tx"));

  return {
    hash: (r.txhash ?? "").toUpperCase(),
    height: Number(r.height ?? 0),
    time: r.timestamp,
    ok: (r.code ?? 0) === 0,
    error: (r.code ?? 0) === 0 ? undefined : r.raw_log || `code ${r.code}`,
    memo: b.tx?.body?.memo ?? "",
    fee: feeText(b.tx?.auth_info?.fee),
    gasUsed: r.gas_used ? Number(r.gas_used) : undefined,
    gasWanted: r.gas_wanted ? Number(r.gas_wanted) : undefined,
    messages: (b.tx?.body?.messages ?? []).map(describeMessage),
    hybrid: hybridExt || verify.status ? { attached: hybridExt, verified: verify.status === "verified", algorithm: verify.algorithm_id } : undefined,
    windowUsed: used ? { openHeight: Number(usedA.window_open_height ?? 0), usedTxs: Number(usedA.used_txs ?? 0), usedValue: usedA.used_value ?? "0" } : undefined,
    evmHash: eth.ethereumTxHash,
  };
}
