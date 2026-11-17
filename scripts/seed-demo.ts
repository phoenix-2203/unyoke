/**
 * Creates realistic demo permissions on the QoreChain TESTNET so Unyoke has
 * something to find and clean up.
 *
 *   pnpm seed:demo
 *
 * Reads SEED_MNEMONIC from .env.seed (git-ignored). Use a THROWAWAY testnet
 * phrase: the script refuses mainnet and refuses accounts holding more than
 * 50 QOR, as a guard against using a real wallet by mistake.
 *
 * Before the first run, import that phrase into QoreX mobile as an Ethereum
 * account (coin 60), fund it with ~2 test QOR and send 0.01 QOR to itself:
 * that registers its post-quantum key, which the hybrid-signed steps need.
 *
 * What it creates (all on testnet):
 *   EVM lane (inside one window this script opens, limited to the 3 test tokens):
 *     - fUSD: UNLIMITED approval to a contract
 *     - fETH: 250 fETH approval to an ordinary wallet address (no code)
 *     - fBTC: 0.5 fBTC approval to a contract (limited, lower risk)
 *   Native lane (hybrid-signed):
 *     - authz SendAuthorization: the demo grantee may send up to 5 QOR for you
 *     - authz GenericAuthorization: the demo grantee may vote for you
 *     - fee grant with no limit
 */
import { evmWindowCost, qorechainTestnet, toQorAddress } from "@qorechain/evm";
import { EthNativeSigner, authz, deriveUnifiedAccount, feegrant, openEvmWindowMsg } from "@qorechain/sdk";
import { createPublicClient, createWalletClient, erc20Abi, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { basicAllowance, genericAuthorization, sendAuthorization } from "../src/lib/grantEncoding";

const CHAIN_ID = "qorechain-diana";
const REST = "https://api-testnet.qore.host";
const TOKENS = {
  fUSD: "0x97143B771D34ddb9130b807b135Ae675A5a963CA",
  fETH: "0x02292293c13880a26242690eb70a0e42B8E91c28",
  fBTC: "0x4604e7E45b2ecdbfbDc157103f5B2b62cb16451A",
} as const;
/** A contract spender for the demo: the fBTC token contract (has code, holds no approvals itself). */
const CONTRACT_SPENDER = TOKENS.fBTC;
/** An ordinary-wallet spender for the demo: no code, nobody holds its key. */
const WALLET_SPENDER = "0x000000000000000000000000000000000000dEaD" as const;
const FEE = { amount: [{ denom: "uqor", amount: "90000" }], gas: "600000" };

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${REST}${path}`, init);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

/** Broadcast a signed native tx over REST and wait for inclusion. */
const transport = {
  async broadcastTx(tx: Uint8Array) {
    const res = await rest<{ tx_response: { code: number; txhash: string; raw_log: string } }>("/cosmos/tx/v1beta1/txs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx_bytes: Buffer.from(tx).toString("base64"), mode: "BROADCAST_MODE_SYNC" }),
    });
    const { code, txhash, raw_log } = res.tx_response;
    if (code !== 0) return { code, transactionHash: txhash, rawLog: raw_log };
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const got = await fetch(`${REST}/cosmos/tx/v1beta1/txs/${txhash}`);
      if (got.ok) {
        const j = (await got.json()) as { tx_response: { code: number; height: string; raw_log: string } };
        return { code: j.tx_response.code, transactionHash: txhash, height: Number(j.tx_response.height), rawLog: j.tx_response.raw_log };
      }
    }
    throw new Error(`Not included after 45 s: ${txhash}`);
  },
};

async function main() {
  const mnemonic = process.env.SEED_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("Set SEED_MNEMONIC in .env.seed (a THROWAWAY testnet phrase).");

  const acc = await deriveUnifiedAccount(mnemonic);
  console.log(`Seed account: ${acc.cosmos} / ${acc.evm}`);

  const bal = await rest<{ balance: { amount: string } }>(`/cosmos/bank/v1beta1/balances/${acc.cosmos}/by_denom?denom=uqor`);
  const uqor = BigInt(bal.balance?.amount ?? "0");
  if (uqor > 50_000_000n) throw new Error("This account holds more than 50 QOR. Use a throwaway testnet account.");
  if (uqor < 500_000n) throw new Error("Fund the seed account with at least 0.5 test QOR first.");

  const pqc = await rest<{ found: boolean }>(`/qorechain/pqc/v1/account/${acc.cosmos}`);
  if (!pqc.found) {
    throw new Error("No post-quantum key registered. Import the phrase in QoreX mobile and send 0.01 QOR to yourself once.");
  }

  const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: REST });
  async function native(label: string, messages: { typeUrl: string; value: unknown }[]) {
    const a = await rest<{ account: { account_number: string; sequence: string } }>(`/cosmos/auth/v1beta1/accounts/${acc.cosmos}`);
    const res = await signer.signAndBroadcast(transport, {
      chainId: CHAIN_ID,
      accountNumber: BigInt(a.account.account_number),
      sequence: BigInt(a.account.sequence),
      fee: FEE,
      messages: messages as never,
      memo: `unyoke demo seed: ${label}`,
    });
    if (res.code !== 0) throw new Error(`${label} failed (code ${res.code}): ${res.rawLog}`);
    console.log(`  ${label}: ${res.transactionHash}`);
  }

  // EVM lane: one window limited to the three test tokens, sized for three approvals.
  const maxFeePerGas = 250_000_000_000n;
  const maxTxs = 3;
  const maxValue = evmWindowCost({ gas: 100_000n, maxFeePerGas }) * BigInt(maxTxs);
  console.log("Opening a window limited to fUSD, fETH and fBTC…");
  await native("window", [
    openEvmWindowMsg({ sender: acc.cosmos, blocks: 300, maxTxs, maxValue: maxValue.toString(), allowedTargets: Object.values(TOKENS) }),
  ]);

  const wallet = createWalletClient({ account: privateKeyToAccount(acc.privateKey as `0x${string}`), chain: qorechainTestnet, transport: http() });
  const pub = createPublicClient({ chain: qorechainTestnet, transport: http() });
  const approvals = [
    { label: "fUSD unlimited -> contract", token: TOKENS.fUSD, spender: CONTRACT_SPENDER, amount: (1n << 256n) - 1n },
    { label: "250 fETH -> ordinary wallet", token: TOKENS.fETH, spender: WALLET_SPENDER, amount: parseUnits("250", 18) },
    { label: "0.5 fBTC -> contract", token: TOKENS.fBTC, spender: CONTRACT_SPENDER, amount: parseUnits("0.5", 8) },
  ] as const;
  for (const a of approvals) {
    const hash = await wallet.writeContract({
      address: a.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [a.spender, a.amount],
      gas: 100_000n,
      maxFeePerGas,
      maxPriorityFeePerGas: 1_000_000_000n,
    });
    const r = await pub.waitForTransactionReceipt({ hash });
    console.log(`  ${a.label}: ${hash} (${r.status})`);
  }

  // Native lane.
  const grantee = toQorAddress(WALLET_SPENDER);
  const in30Days = { seconds: BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400), nanos: 0 };
  console.log(`Native grants to ${grantee}…`);
  await native("authz: send up to 5 QOR", [
    authz.grant({ granter: acc.cosmos, grantee, grant: { authorization: sendAuthorization("uqor", "5000000"), expiration: in30Days } }),
  ]);
  await native("authz: vote", [
    authz.grant({ granter: acc.cosmos, grantee, grant: { authorization: genericAuthorization("/cosmos.gov.v1.MsgVote") } }),
  ]);
  await native("fee grant: no limit", [feegrant.grant({ granter: acc.cosmos, grantee, allowance: basicAllowance() })]);

  console.log(`\nDone. Scan ${acc.evm} in Unyoke.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
