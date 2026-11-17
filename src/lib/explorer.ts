/**
 * Links to the QoreChain explorer.
 *
 * The explorer finds transactions by their Cosmos hash (64 hex characters, no
 * 0x). EVM transactions also have an Ethereum hash (0x…), which the explorer
 * can't open, so those are looked up first through the REST API's
 * `ethereum_tx.ethereumTxHash` event index.
 */
export const EXPLORER = "https://explore.qore.network";

const COSMOS_HASH = /^[0-9A-Fa-f]{64}$/;
const EVM_HASH = /^0x[0-9A-Fa-f]{64}$/;

export const isCosmosHash = (h: string) => COSMOS_HASH.test(h);
export const isEvmHash = (h: string) => EVM_HASH.test(h);

/** The explorer page for a Cosmos tx hash, or undefined for anything else. */
export function explorerTxUrl(hash: string): string | undefined {
  return isCosmosHash(hash) ? `${EXPLORER}/tx/${hash.toUpperCase()}` : undefined;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** The Cosmos hash of the transaction that carried an EVM tx, if the node still has it. */
export async function cosmosHashForEvmTx(rest: string, evmHash: string, fetchFn: FetchLike = fetch): Promise<string | undefined> {
  if (!isEvmHash(evmHash)) return undefined;
  const query = encodeURIComponent(`ethereum_tx.ethereumTxHash='${evmHash.toLowerCase()}'`);
  try {
    const res = await fetchFn(`${rest.replace(/\/$/, "")}/cosmos/tx/v1beta1/txs?query=${query}&pagination.limit=1`);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { tx_responses?: { txhash?: string }[] };
    const h = body.tx_responses?.[0]?.txhash;
    return h && isCosmosHash(h) ? h.toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}
