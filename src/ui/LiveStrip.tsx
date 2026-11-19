/**
 * Real numbers from the chain, so the page is about QoreChain right now:
 * the latest block, and how many approvals were set in roughly the last day,
 * how many of them unlimited. Fails quietly to dashes.
 */
import { qorechainTestnet } from "@qorechain/evm";
import { useQuery } from "@tanstack/react-query";
import { useBlockNumber, usePublicClient } from "wagmi";
import { APPROVAL_TOPIC, decodeApprovalLog, getLogsFrom } from "../lib/evmApprovalLogs";
import { isUnlimited } from "../lib/format";
import type { EvmClient } from "../lib/scanAccount";

/** ~22 hours of testnet blocks (6 calls of 10,000). */
const WINDOW = 60_000n;

export function LiveStrip() {
  const client = usePublicClient({ chainId: qorechainTestnet.id });
  const { data: block } = useBlockNumber({ chainId: qorechainTestnet.id, watch: true });
  const { data } = useQuery({
    queryKey: ["approvals-last-day"],
    enabled: !!client,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const getLogs = getLogsFrom(client as unknown as EvmClient);
      const head = await client!.getBlockNumber();
      let total = 0;
      let unlimited = 0;
      const owners = new Set<string>();
      for (let to = head; to > head - WINDOW; to -= 10_000n) {
        const logs = await getLogs({ fromBlock: to - 9_999n, toBlock: to, topics: [APPROVAL_TOPIC] });
        for (const l of logs) {
          const ev = decodeApprovalLog(l);
          if (!ev || ev.value === 0n) continue;
          total++;
          owners.add(ev.owner);
          if (isUnlimited(ev.value)) unlimited++;
        }
      }
      return { total, unlimited, owners: owners.size };
    },
  });
  const n = (v?: number | bigint) => (v === undefined ? "—" : v.toLocaleString("en-US"));
  return (
    <section className="live reveal" aria-label="Live numbers from the QoreChain testnet">
      <div className="live-item">
        <span className="live-k mono">
          <span className="dot" /> latest block
        </span>
        <span className="live-v">{n(block)}</span>
      </div>
      <div className="live-item">
        <span className="live-k mono">approvals set · last ~22h</span>
        <span className="live-v">{n(data?.total)}</span>
      </div>
      <div className="live-item">
        <span className="live-k mono">of them unlimited</span>
        <span className="live-v t-high">{n(data?.unlimited)}</span>
      </div>
      <div className="live-item">
        <span className="live-k mono">accounts that gave them</span>
        <span className="live-v">{n(data?.owners)}</span>
      </div>
    </section>
  );
}
