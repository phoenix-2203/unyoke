/**
 * What a visitor sees before (and below) a scan: a sample of the output, how it
 * works, what is checked, and why it matters on QoreChain.
 */
import type { RiskLevel } from "../lib/risk";

const EXAMPLE: { level: RiskLevel; token: string; what: string; who: string }[] = [
  { level: "high", token: "fUSD", what: "Unlimited", who: "contract 0x9714…63ca" },
  { level: "high", token: "Authz", what: "Send up to 5 QOR", who: "qor1qqq…zcuz" },
  { level: "medium", token: "fETH", what: "250 fETH · your whole balance", who: "contract 0x0229…1c28" },
  { level: "low", token: "Vote grant", what: "Vote in your name", who: "qor1qqq…zcuz" },
];

/** A static sample of a scan result, shown beside the hero. Clearly labelled as an example. */
export function PreviewCard() {
  return (
    <div className="preview" aria-label="Example of a scan result">
      <div className="preview-head">
        <span className="mono">example scan</span>
        <span className="preview-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="preview-stats">
        <div>
          <b>4</b>
          <span>open</span>
        </div>
        <div>
          <b className="t-high">2</b>
          <span>high</span>
        </div>
        <div>
          <b className="t-medium">1</b>
          <span>medium</span>
        </div>
        <div>
          <b className="t-low">1</b>
          <span>low</span>
        </div>
      </div>
      {EXAMPLE.map((r) => (
        <div className="preview-row" key={r.token}>
          <span className={`dot ${r.level}`} />
          <div>
            <div className="cell-title">
              {r.token} <span className="muted-inline">· {r.what}</span>
            </div>
            <div className="cell-sub mono">{r.who}</div>
          </div>
          <span className="preview-revoke">Revoke</span>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Scan",
    body: "Paste any qor1… or 0x… address. Unyoke reads both lanes from public data: no wallet, no sign-in.",
  },
  {
    n: "02",
    title: "See the risk",
    body: "Every permission gets a high, medium or low label and a one-line reason, risky ones first.",
  },
  {
    n: "03",
    title: "Take it back",
    body: "Revoke from your wallet. QoreX opens a one-transaction window for each EVM revoke, limited to that token, so cleaning up never opens a new hole.",
  },
];

const CHECKS = [
  { lane: "EVM", title: "Token approvals", body: "ERC-20 allowances, including unlimited ones." },
  { lane: "EVM", title: "NFT approve-all", body: "Operators that can move a whole collection." },
  { lane: "Native", title: "Authz grants", body: "Accounts allowed to send messages, or your funds, for you." },
  { lane: "Native", title: "Fee grants", body: "Accounts allowed to spend your QOR on their fees." },
  { lane: "Native", title: "EIP-7702 consent", body: "Contract code allowed to run as your EVM account." },
];

export function Landing() {
  return (
    <>
      <section className="section">
        <div className="section-label mono">How it works</div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <span className="step-n mono">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-label mono">What Unyoke checks</div>
        <div className="checks">
          {CHECKS.map((c) => (
            <div className="check" key={c.title}>
              <span className={`lane-tag ${c.lane === "EVM" ? "evm" : "native"}`}>{c.lane}</span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section why">
        <div className="section-label mono">Why it matters on QoreChain</div>
        <blockquote>
          “A permit or approval granted inside a window stays after the window closes, so review and revoke approvals when the
          session ends.”
          <cite>
            <a href="https://docs.qorechain.io/developer-guide/evm-development" target="_blank" rel="noreferrer">
              QoreChain docs · EVM development
            </a>
          </cite>
        </blockquote>
        <p>
          QoreChain's EVM window limits how many transactions and how much QOR a stolen classical key can move. It does not limit
          token amounts or approvals you already gave. Until now, nothing on the chain let you find and remove them.
        </p>
      </section>
    </>
  );
}
