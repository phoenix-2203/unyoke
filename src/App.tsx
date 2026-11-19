import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBlockNumber } from "wagmi";
import { LINKS, Link, txHashFromPath, useRoute } from "./router";
import { WindowSpike } from "./spike/WindowSpike";
import { AppPage } from "./ui/AppPage";
import { LandingPage } from "./ui/LandingPage";
import { LogoMark } from "./ui/Logo";
import { TxPage, TxPathError } from "./ui/TxPage";
import { ArrowRight, BookIcon, GitHubIcon, MoonIcon, SunIcon, TrophyIcon } from "./ui/icons";
import type { Theme } from "./ui/theme";

/** The day-1 wallet test page stays reachable at ?spike for re-testing QoreX. */
const showSpike = new URLSearchParams(window.location.search).has("spike");

function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a className="icon-btn" href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>
      {children}
    </a>
  );
}

export function App({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { route, search } = useRoute();
  const { data: block } = useBlockNumber({ watch: true });
  const address = search.get("address") ?? undefined;
  const txHash = route === "tx" ? txHashFromPath(window.location.pathname) : undefined;

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="brand" aria-label="Unyoke home">
          <LogoMark size={26} />
          unyoke
        </Link>
        <div className="nav-links">
          <Link href="/#checks">What it checks</Link>
          <Link href="/#different">Why it's different</Link>
          <Link href="/app">Scanner</Link>
        </div>
        <div className="nav-right">
          <span className="chip hide-sm" title="Latest QoreChain testnet block">
            <span className="dot" /> testnet {block ? `#${block.toLocaleString("en-US")}` : "…"}
          </span>
          <div className="icon-group hide-sm">
            <IconLink href={LINKS.docs} label="QoreChain docs">
              <BookIcon size={17} />
            </IconLink>
            <IconLink href={LINKS.github} label="Unyoke on GitHub">
              <GitHubIcon size={17} />
            </IconLink>
          </div>
          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
          </button>
          {route === "app" ? (
            <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" />
          ) : (
            <Link href="/app" className="btn-link">
              Launch app <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </nav>

      {route === "app" ? (
        <AppPage key={address ?? ""} initialAddress={address} />
      ) : route === "tx" ? (
        txHash ? <TxPage key={txHash} hash={txHash} /> : <TxPathError />
      ) : (
        <LandingPage />
      )}

      {showSpike && (
        <div className="spike">
          <WindowSpike />
        </div>
      )}

      <footer className="footer">
        <Link href="/" className="brand">
          <LogoMark size={20} /> unyoke
        </Link>
        <div className="footer-links">
          <a href={LINKS.github} target="_blank" rel="noreferrer">
            <GitHubIcon size={15} /> GitHub
          </a>
          <a href={LINKS.docs} target="_blank" rel="noreferrer">
            <BookIcon size={15} /> QoreChain docs
          </a>
          <a href={LINKS.fest} target="_blank" rel="noreferrer">
            <TrophyIcon size={15} /> Build Before Q-Day
          </a>
        </div>
        <span>MIT · reads public data, never your keys</span>
      </footer>
    </main>
  );
}
