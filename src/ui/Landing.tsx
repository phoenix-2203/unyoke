/**
 * Everything below the hero: live chain numbers, a product shot (the real
 * results view with an example scan), a bento of what makes Unyoke different,
 * the docs quote, and a closing call to action.
 */
import { LiveStrip } from "./LiveStrip";
import { Results } from "./Results";
import { SAMPLE_SCAN } from "./sampleScan";

export function Landing({ onScanClick }: { onScanClick: () => void }) {
  return (
    <>
      <LiveStrip />

      <section className="section reveal">
        <div className="section-head">
          <span className="kicker mono">01 · the result</span>
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
            <span />
          </div>
          <div className="shot-body">
            <Results r={SAMPLE_SCAN} example />
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="section-head">
          <span className="kicker mono">02 · why it's different</span>
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
          </article>

          <article className="tile">
            <span className="kicker mono">both lanes</span>
            <h3>EVM and native, in one list.</h3>
            <ul className="tags">
              <li className="evm">ERC-20 approvals</li>
              <li className="evm">NFT approve-all</li>
              <li className="native">authz grants</li>
              <li className="native">fee grants</li>
              <li className="native">7702 consent</li>
            </ul>
          </article>

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

          <article className="tile">
            <span className="kicker mono">no keys, ever</span>
            <h3>Read-only until you sign.</h3>
            <p>Scanning reads public data. Every revoke is approved in your own wallet. Unyoke never sees a key or a phrase.</p>
          </article>
        </div>
      </section>

      <section className="band reveal">
        <span className="kicker mono">03 · why it matters</span>
        <blockquote>
          “A permit or approval granted inside a window <mark>stays after the window closes</mark>, so review and revoke
          approvals when the session ends.”
        </blockquote>
        <cite>
          <a href="https://docs.qorechain.io/developer-guide/evm-development" target="_blank" rel="noreferrer">
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
        <button type="button" className="big" onClick={onScanClick}>
          Scan an account
        </button>
      </section>
    </>
  );
}
