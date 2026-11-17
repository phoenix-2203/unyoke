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
          <LogoMark size={26} />
          unyoke
        </div>
        <div className="nav-links">
          <a href="https://docs.qorechain.io/developer-guide/evm-development" target="_blank" rel="noreferrer">
            Why
          </a>
          <a href="https://github.com/phoenix-2203/unyoke" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div className="nav-right">
          <span className="chip hide-sm">
            <span className="dot" /> testnet {block ? `#${block.toLocaleString("en-US")}` : "…"}
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
        <span className="brand">
          <LogoMark size={20} /> unyoke
        </span>
        <span>Built for Build Before Q-Day on QoreChain · MIT · reads public data, never your keys</span>
      </footer>
    </main>
  );
}
