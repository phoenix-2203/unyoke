import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  QORECHAIN_REST_ENDPOINTS,
  qorechainTestnet,
  evmWindowStatus,
} from "@qorechain/evm";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { useAccount, useBalance, useBlockNumber } from "wagmi";
import { WindowSpike } from "./spike/WindowSpike";

/**
 * The REST API of each chain, through the dev server's proxy (vite.config.ts):
 * the public REST endpoints send no CORS headers. Same chains as
 * QORECHAIN_REST_ENDPOINTS.
 */
const REST_PROXY: Record<number, string | undefined> = Object.fromEntries(
  Object.keys(QORECHAIN_REST_ENDPOINTS).map((id) => [
    Number(id),
    Number(id) === qorechainTestnet.id ? "/lcd-testnet" : "/lcd-mainnet",
  ]),
);

/** The account's EVM authorisation window, read over the native-lane REST API. */
function WindowStatus({ address, chainId }: { address: `0x${string}`; chainId: number }) {
  const rest = REST_PROXY[chainId];
  const { data, error, isLoading } = useQuery({
    queryKey: ["evm-window", chainId, address],
    queryFn: () => evmWindowStatus({ rest: rest!, address }),
    enabled: rest !== undefined,
    refetchInterval: 10_000,
  });
  if (!rest) return <p>Unknown network.</p>;
  if (isLoading) return <p>Reading the EVM window...</p>;
  if (error) return <p>Could not read the window: {error.message}</p>;
  if (!data?.found) {
    return <p>EVM window: none. Sending from this account is refused until one is opened.</p>;
  }
  return (
    <p>
      EVM window: {data.live ? "live" : "not usable"} ({data.remainingBlocks.toString()} blocks,{" "}
      {data.remainingTxs.toString()} transactions, {data.remainingValue.toString()} uqor left)
    </p>
  );
}

export function App() {
  const { address, chainId, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: block } = useBlockNumber({ watch: true });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>QoreChain EVM dApp</h1>
      <ConnectButton />
      <p>Latest block: {block?.toString() ?? "..."}</p>

      {isConnected && address && chainId ? (
        <section>
          <p>
            Account <code>{address}</code> on chain {chainId}
          </p>
          <p>Balance: {balance ? `${formatEther(balance.value)} QOR` : "..."}</p>
          <WindowStatus address={address} chainId={chainId} />
        </section>
      ) : (
        <p>Connect a wallet to read your account.</p>
      )}
      <WindowSpike />
    </main>
  );
}
