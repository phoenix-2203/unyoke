import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBlockNumber } from "wagmi";
import { WindowSpike } from "./spike/WindowSpike";
import { ScanPage } from "./ui/ScanPage";

/** The day-1 wallet test page stays reachable at ?spike for re-testing QoreX. */
const showSpike = new URLSearchParams(window.location.search).has("spike");

export function App() {
  const { data: block } = useBlockNumber({ watch: true });
  return (
    <main>
      <header className="top">
        <div>
          <h1>Unyoke</h1>
          <p className="tagline">Find and remove every permission your QoreChain account has handed out, on both lanes.</p>
        </div>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>
      <p className="muted small">QoreChain testnet · latest block {block?.toLocaleString("en-US") ?? "…"}</p>
      <ScanPage />
      {showSpike && <WindowSpike />}
    </main>
  );
}
