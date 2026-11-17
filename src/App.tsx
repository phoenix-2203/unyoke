import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBlockNumber } from "wagmi";
import { WindowSpike } from "./spike/WindowSpike";
import { LogoMark } from "./ui/Logo";
import { ScanPage } from "./ui/ScanPage";

/** The day-1 wallet test page stays reachable at ?spike for re-testing QoreX. */
const showSpike = new URLSearchParams(window.location.search).has("spike");

export function App() {
  const { data: block } = useBlockNumber({ watch: true });
  return (
    <main>
      <nav className="nav">
        <div className="brand">
          <LogoMark size={24} />
          unyoke
        </div>
        <div className="nav-right">
          <span className="chip hide-sm">
            <span className="dot" /> testnet · {block ? block.toLocaleString("en-US") : "…"}
          </span>
          <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" />
        </div>
      </nav>
      <ScanPage />
      {showSpike && (
        <div className="spike">
          <WindowSpike />
        </div>
      )}
      <footer className="footer">
        <span>Unyoke · built for Build Before Q-Day on QoreChain</span>
        <span>MIT · reads public data · signing happens in your wallet</span>
      </footer>
    </main>
  );
}
