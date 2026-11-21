/**
 * The landing page ("/"). Every icon and card goes somewhere useful: the scanner,
 * the matching check, or the source docs.
 */
import { type ReactNode, useState } from "react";
import { LINKS, Link, navigate } from "../router";
import { LiveStrip } from "./LiveStrip";
import { PermissionGraph } from "./PermissionGraph";
import { Results } from "./Results";
import { ArrowRight, ArrowUpRight, BookIcon, CodeIcon, FuelIcon, KeyIcon, NftIcon, SearchIcon, TokenIcon } from "./icons";
import { SAMPLE_SCAN } from "./sampleScan";
import { useReveal } from "./useReveal";

/** The demo account: open permissions on both lanes (all to 0x…dEaD) plus a revoke history made through Unyoke. */
export const DEMO_ADDRESS = import.meta.env.VITE_DEMO_ADDRESS || "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu";

type Check = { id: string; lane: "EVM" | "Native"; icon: ReactNode; title: string; body: string; doc: string; docLabel: string };

export const CHECKS: Check[] = [
  {
    id: "check-erc20",
    lane: "EVM",
    icon: <TokenIcon size={22} />,
    title: "Token approvals",
    body: "ERC-20 allowances, including unlimited ones that cover everything you'll ever hold.",
    doc: "https://docs.qorechain.io/developer-guide/evm-development",
    docLabel: "QoreChain EVM docs",
  },
  {
    id: "check-nft",
    lane: "EVM",
    icon: <NftIcon size={22} />,
    title: "NFT approve-all",
    body: "Operators allowed to move every NFT you own in a collection.",
    doc: "https://eips.ethereum.org/EIPS/eip-721",
    docLabel: "ERC-721 standard",
  },
  {
    id: "check-authz",
    lane: "Native",
    icon: <KeyIcon size={22} />,
    title: "Authz grants",
    body: "Accounts allowed to send messages for you, including moving your funds.",
    doc: "https://docs.cosmos.network/main/build/modules/authz",
    docLabel: "Cosmos SDK authz",
  },
  {
    id: "check-feegrant",
    lane: "Native",
    icon: <FuelIcon size={22} />,
    title: "Fee grants",
    body: "Accounts allowed to spend your QOR on their own transaction fees.",
    doc: "https://docs.cosmos.network/main/build/modules/feegrant",
    docLabel: "Cosmos SDK feegrant",
  },
  {
    id: "check-7702",
    lane: "Native",
    icon: <CodeIcon size={22} />,
    title: "EIP-7702 consent",
    body: "Contract code allowed to run as your EVM account.",
    doc: "https://docs.qorechain.io/developer-guide/evm-window-reference",
    docLabel: "QoreChain window docs",
  },
];

function openApp(address?: string) {
  navigate(address ? `/app?address=${encodeURIComponent(address)}` : "/app");
}

export function LandingPage() {
  const [input, setInput] = useState("");
  useReveal([]);

  return (
    <>
      <section className="hero">
        <Link href="#checks" className="pill mono pill-link">
          <span className="dot" /> Built for QoreChain · see what it checks <ArrowRight size={14} />
        </Link>
        <h1>
          Take back every <span className="hl">permission</span>
          <br />
          you've <em>handed out.</em>
        </h1>
        <p className="lede">
          Forgotten token approvals and grants are the open door on Q-Day. Unyoke finds every one on both lanes of QoreChain,
          explains the risk, and helps you shut it.
        </p>
        <form
          className="scanbar"
          onSubmit={(e) => {
            e.preventDefault();
            openApp(input.trim() || undefined);
          }}
        >
          <SearchIcon className="scan-icon" size={18} />
          <label htmlFor="addr" className="sr-only">
            Account address
          </label>
          <input
            id="addr"
            value={input}
            placeholder="Paste a qor1… or 0x… address"
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit">{input.trim() ? "Scan" : "Launch app"}</button>
        </form>
        <div className="hero-actions">
          <span className="mono">read-only · no wallet needed</span>
          <button type="button" className="linkish" onClick={() => openApp(DEMO_ADDRESS)}>
            or try a sample account →
          </button>
        </div>
      </section>

      <div className="stage">
        <PermissionGraph />
        <p className="stage-hint mono">tap a permission to see what it is · tap your account to scan one</p>
      </div>

      <LiveStrip />

      <section className="section reveal" id="checks">
        <div className="section-head">
          <span className="kicker mono">01 · what it checks</span>
          <h2>
            Five kinds of permission. <em>Two lanes.</em>
          </h2>
          <p>Each one is something you, or an app you used, handed to someone else. Each one outlives the moment you gave it.</p>
        </div>
        <div className="checks">
          {CHECKS.map((c) => (
            <article className="check" id={c.id} key={c.id}>
              <div className="check-top">
                <span className={`check-icon ${c.lane === "EVM" ? "evm" : "native"}`}>{c.icon}</span>
                <span className={`lane-tag ${c.lane === "EVM" ? "evm" : "native"}`}>{c.lane}</span>
              </div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <div className="check-links">
                <a href={c.doc} target="_blank" rel="noreferrer" className="icon-link" title={c.docLabel}>
                  <BookIcon size={15} /> Docs <ArrowUpRight size={13} />
                </a>
                <button type="button" className="icon-link as-button" onClick={() => openApp()}>
                  Scan <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section reveal" id="result">
        <div className="section-head">
          <span className="kicker mono">02 · the result</span>
          <h2>
            Every permission, ranked. <em>In plain words.</em>
          </h2>
          <p>One scan reads both lanes of QoreChain and sorts what it finds by how much damage it could do.</p>
        </div>
        <div className="shot">
          <div className="shot-bar">
            <span className="shot-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="mono">unyoke · example scan</span>
            <button type="button" className="shot-open mono" onClick={() => openApp(DEMO_ADDRESS)}>
              open a real one <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="shot-body">
            <Results r={SAMPLE_SCAN} example />
          </div>
        </div>
      </section>

      <section className="section reveal" id="different">
        <div className="section-head">
          <span className="kicker mono">03 · why it's different</span>
          <h2>
            Built for how QoreChain <em>actually</em> works.
          </h2>
        </div>
        <div className="bento">
          <article className="tile tile-wide">
            <span className="kicker mono">tested with the real QoreX wallet</span>
            <h3>One window per revoke. Used up instantly.</h3>
            <p>
              A revoke is an EVM transaction, so it needs an open window. QoreX opens one for each revoke: that token only, one
              transaction, about two minutes. Cleaning up never opens a new hole.
            </p>
            <div className="timeline" aria-hidden>
              <div className="tl-step">
                <span className="tl-dot" />
                <b>window opens</b>
                <span className="mono">fUSD only · 1 tx · 100 blocks</span>
              </div>
              <div className="tl-line" />
              <div className="tl-step">
                <span className="tl-dot accent" />
                <b>approve(spender, 0)</b>
                <span className="mono">allowance → 0</span>
              </div>
              <div className="tl-line" />
              <div className="tl-step">
                <span className="tl-dot muted" />
                <b>window used up</b>
                <span className="mono">0 tx left</span>
              </div>
            </div>
            <a className="icon-link tile-link" href={`${LINKS.github}/blob/main/docs/SPIKE_RESULTS.md`} target="_blank" rel="noreferrer">
              See the testnet receipts <ArrowUpRight size={13} />
            </a>
          </article>

          <Link className="tile tile-link-card" href="#checks">
            <span className="kicker mono">both lanes</span>
            <h3>EVM and native, in one list.</h3>
            <ul className="tags">
              <li className="evm">ERC-20 approvals</li>
              <li className="evm">NFT approve-all</li>
              <li className="native">authz grants</li>
              <li className="native">fee grants</li>
              <li className="native">7702 consent</li>
            </ul>
          </Link>

          <article className="tile">
            <span className="kicker mono">honest by default</span>
            <h3>It tells you what it can't see.</h3>
            <p>
              The public testnet node keeps only recent history. Unyoke says exactly where its view starts, instead of pretending
              you're clean.
            </p>
          </article>

          <article className="tile">
            <span className="kicker mono">receipts</span>
            <h3>Proof you cleaned up.</h3>
            <p>Before and after, every transaction hash, and the window QoreX used for each revoke, on one shareable page.</p>
          </article>

          <a className="tile tile-link-card" href={LINKS.qorex} target="_blank" rel="noreferrer">
            <span className="kicker mono">no keys, ever</span>
            <h3>Read-only until you sign.</h3>
            <p>
              Scanning reads public data. Every revoke is approved in your own QoreX wallet <ArrowUpRight size={13} />
            </p>
          </a>
        </div>
      </section>

      <section className="band reveal" id="why">
        <span className="kicker mono">04 · why it matters</span>
        <blockquote>
          “A permit or approval granted inside a window <mark>stays after the window closes</mark>, so review and revoke
          approvals when the session ends.”
        </blockquote>
        <cite>
          <a href={LINKS.docs} target="_blank" rel="noreferrer">
            QoreChain docs · EVM development ↗
          </a>
        </cite>
        <p>
          Windows cap how many transactions and how much QOR a stolen classical key can move. They don't cap token amounts or
          approvals you already gave. On Q-Day, those forgotten approvals are the open door.
        </p>
      </section>

      <section className="cta reveal">
        <h2>
          What have <em>you</em> handed out?
        </h2>
        <button type="button" className="big" onClick={() => openApp()}>
          Launch Unyoke
        </button>
      </section>
    </>
  );
}
