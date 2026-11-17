/** A transaction link that works for both Cosmos and EVM hashes. */
import { useEffect, useState } from "react";
import { cosmosHashForEvmTx, explorerTxUrl, isEvmHash } from "../lib/explorer";

const REST = "/lcd-testnet";
const HINT = "Opens the QoreChain explorer. It starts on mainnet: choose Testnet at the top if the transaction isn't found.";

export function TxLink({ hash, children, className }: { hash: string; children?: React.ReactNode; className?: string }) {
  const [cosmos, setCosmos] = useState<string | undefined>(isEvmHash(hash) ? undefined : hash);
  useEffect(() => {
    if (!isEvmHash(hash)) return;
    let live = true;
    cosmosHashForEvmTx(REST, hash).then((h) => live && setCosmos(h));
    return () => {
      live = false;
    };
  }, [hash]);
  const label = children ?? `${hash.slice(0, 10)}…`;
  const href = cosmos && explorerTxUrl(cosmos);
  if (!href) {
    return (
      <span className={className} title={hash}>
        {label}
      </span>
    );
  }
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer" title={HINT}>
      {label}
    </a>
  );
}
