/**
 * A link to Unyoke's own transaction page (/tx/<hash>), which reads testnet
 * directly. The public explorer opens on mainnet and can't be linked to testnet,
 * so its links showed "Transaction not found". Works for Cosmos and EVM hashes.
 */
import { Link } from "../router";

export function TxLink({ hash, children, className }: { hash: string; children?: React.ReactNode; className?: string }) {
  return (
    <Link className={className} href={`/tx/${hash}`} title="Open this transaction" target="_blank" rel="noreferrer">
      {children ?? `${hash.slice(0, 10)}…`}
    </Link>
  );
}
