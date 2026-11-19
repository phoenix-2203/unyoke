/**
 * Swap a little test QOR in a pool of QoreChain's native AMM, on the TESTNET,
 * from the throwaway account in .env.seed:
 *
 *   pnpm amm:swap            (0.01 QOR)
 *   pnpm amm:swap 50000      (amount in uqor)
 *
 * Picks the active pool with the most uqor (so a small swap barely moves its
 * price), asks the chain for a quote, and sends a
 * hybrid-signed MsgSwapExactIn that refuses anything more than 1% below that
 * quote. Testnet tokens only; they have no value.
 */
import { amm } from "@qorechain/sdk";
import { REST, loadTestAccount, rest } from "./lib/testnet";

/** As the testnet REST answers it (the denoms are plain strings). */
interface Pool {
  id: string;
  token_a: string;
  token_b: string;
  reserve_a: string;
  reserve_b: string;
  status: string;
}

const amountIn = process.argv[2] ?? "10000";
if (!/^\d+$/.test(amountIn)) throw new Error("The amount is in uqor, as a whole number (1 QOR = 1000000).");

const { pools } = await rest<{ pools: Pool[] }>("/qorechain/amm/v1/pools");
const uqorReserve = (p: Pool) => BigInt(p.token_a === "uqor" ? p.reserve_a : p.reserve_b);
const pool = pools
  .filter((p) => (p.token_a === "uqor" || p.token_b === "uqor") && p.status === "active")
  .sort((a, b) => (uqorReserve(b) > uqorReserve(a) ? 1 : -1))[0];
if (!pool) throw new Error(`No active pool with uqor on the testnet right now (${REST}/qorechain/amm/v1/pools).`);
const denomOut = pool.token_a === "uqor" ? pool.token_b : pool.token_a;

const quote = await rest<{ amount_out: string; fee: string; impact_bps: number }>(
  `/qorechain/amm/v1/quote/exact_in?pool_id=${pool.id}&denom_in=uqor&amount_in=${amountIn}`,
);
const out = BigInt(quote.amount_out);
if (out === 0n) throw new Error(`The quote for ${amountIn} uqor is 0; try a larger amount.`);
const minOut = (out * 99n) / 100n;

const t = await loadTestAccount({ refuseDemo: true });
console.log(`Pool ${pool.id}: ${amountIn} uqor -> about ${out} ${denomOut} (at least ${minOut})`);
const hash = await t.native("amm swap", [
  amm.swapExactIn({ sender: t.qor, poolId: pool.id, tokenIn: { denom: "uqor", amount: amountIn }, denomOut, minOut: minOut.toString() }),
]);
console.log(`
Swapped in native AMM pool ${pool.id}
  account: ${t.qor}
  tx:      ${hash}
Then press Check on "First swap in a pool" at build.qorechain.io/me`);
