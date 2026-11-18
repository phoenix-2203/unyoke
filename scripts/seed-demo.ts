/**
 * Creates realistic demo permissions on the QoreChain TESTNET so Unyoke has
 * something to find and clean up.
 *
 *   pnpm seed:demo
 *
 * Reads SEED_MNEMONIC (or E2E_MNEMONIC) from .env.seed (git-ignored). Use a THROWAWAY testnet
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
import { evmWindowCost, toQorAddress } from "@qorechain/evm";
import { authz, feegrant, openEvmWindowMsg } from "@qorechain/sdk";
import { erc20Abi, parseUnits } from "viem";
import { basicAllowance, genericAuthorization, sendAuthorization } from "../src/lib/grantEncoding";
import { MAX_FEE_PER_GAS, loadTestAccount } from "./lib/testnet";

const TOKENS = {
  fUSD: "0x97143B771D34ddb9130b807b135Ae675A5a963CA",
  fETH: "0x02292293c13880a26242690eb70a0e42B8E91c28",
  fBTC: "0x4604e7E45b2ecdbfbDc157103f5B2b62cb16451A",
} as const;
/** A contract spender for the demo: the fBTC token contract (has code, holds no approvals itself). */
const CONTRACT_SPENDER = TOKENS.fBTC;
/** An ordinary-wallet spender for the demo: no code, nobody holds its key. */
const WALLET_SPENDER = "0x000000000000000000000000000000000000dEaD" as const;

async function main() {
  const t = await loadTestAccount();
  console.log(`Seed account: ${t.qor} / ${t.evm}`);
  const native = async (label: string, messages: { typeUrl: string; value: unknown }[]) =>
    console.log(`  ${label}: ${await t.native(label, messages, `unyoke demo seed: ${label}`)}`);

  // EVM lane: one window limited to the three test tokens, sized for three approvals.
  const maxFeePerGas = MAX_FEE_PER_GAS;
  const maxTxs = 3;
  const maxValue = evmWindowCost({ gas: 100_000n, maxFeePerGas }) * BigInt(maxTxs);
  console.log("Opening a window limited to fUSD, fETH and fBTC…");
  await native("window", [
    openEvmWindowMsg({ sender: t.qor, blocks: 300, maxTxs, maxValue: maxValue.toString(), allowedTargets: Object.values(TOKENS) }),
  ]);

  const { wallet, pub } = t;
  const approvals = [
    { label: "fUSD unlimited -> contract", token: TOKENS.fUSD, spender: CONTRACT_SPENDER, amount: (1n << 256n) - 1n },
    { label: "250 fETH -> ordinary wallet", token: TOKENS.fETH, spender: WALLET_SPENDER, amount: parseUnits("250", 18) },
    { label: "0.5 fBTC -> contract", token: TOKENS.fBTC, spender: CONTRACT_SPENDER, amount: parseUnits("0.5", 8) },
  ] as const;
  for (const a of approvals) {
    const hash = await wallet.writeContract({
      account: wallet.account!,
      chain: wallet.chain,
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
    authz.grant({ granter: t.qor, grantee, grant: { authorization: sendAuthorization("uqor", "5000000"), expiration: in30Days } }),
  ]);
  await native("authz: vote", [
    authz.grant({ granter: t.qor, grantee, grant: { authorization: genericAuthorization("/cosmos.gov.v1.MsgVote") } }),
  ]);
  await native("fee grant: no limit", [feegrant.grant({ granter: t.qor, grantee, allowance: basicAllowance() })]);

  console.log(`\nDone. Scan ${t.evm} in Unyoke.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
