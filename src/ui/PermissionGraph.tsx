/**
 * The hero visual: your account in the middle, every permission it handed out
 * as a line to the spender. Risky lines glow; one by one they get cut
 * ("unyoked") and the spender greys out. Pure SVG + CSS. Each spender links to
 * the matching "what it checks" card; your account opens the scanner.
 */
import { navigate } from "../router";

type Edge = {
  id: string;
  x: number;
  y: number;
  label: string;
  sub: string;
  level: "high" | "medium" | "low";
  cut?: 1 | 2 | 3;
  /** Where tapping the node goes: the matching "what it checks" card. */
  href: string;
  title: string;
};

const CX = 450;
const CY = 215;

const EDGES: Edge[] = [
  { id: "a", x: 120, y: 80, label: "fUSD", sub: "unlimited", level: "high", cut: 1, href: "#check-erc20", title: "Token approvals" },
  { id: "b", x: 780, y: 70, label: "authz", sub: "send · no limit", level: "high", cut: 2, href: "#check-authz", title: "Authz grants" },
  { id: "c", x: 95, y: 330, label: "NFT", sub: "approve all", level: "high", cut: 3, href: "#check-nft", title: "NFT approve-all" },
  { id: "d", x: 810, y: 345, label: "fee grant", sub: "no limit", level: "medium", href: "#check-feegrant", title: "Fee grants" },
  { id: "e", x: 300, y: 390, label: "fETH", sub: "250", level: "medium", href: "#check-erc20", title: "Token approvals" },
  { id: "f", x: 625, y: 395, label: "vote", sub: "gov only", level: "low", href: "#check-authz", title: "Authz grants" },
];

/** A gentle curve from the account to the spender. */
function curve(e: Edge) {
  const mx = (CX + e.x) / 2;
  const my = (CY + e.y) / 2 - 40;
  return `M ${CX} ${CY} Q ${mx} ${my} ${e.x} ${e.y}`;
}

export function PermissionGraph() {
  return (
    <div className="graph">
      <svg viewBox="0 0 900 440" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Your account and the permissions it has handed out">
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="var(--core-glow)" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* orbit rings */}
        <ellipse cx={CX} cy={CY} rx="210" ry="120" className="ring" />
        <ellipse cx={CX} cy={CY} rx="330" ry="185" className="ring faint" />

        {EDGES.map((e) => (
          <g key={e.id} className={`edge ${e.level}${e.cut ? ` cut cut-${e.cut}` : ""}`}>
            <path d={curve(e)} className="glow" filter="url(#soft)" />
            <path d={curve(e)} className="line" />
            <path d={curve(e)} className="flow" />
            <a
              href={e.href}
              className="node-link"
              aria-label={`${e.title}: what this permission is`}
              onClick={(ev) => {
                ev.preventDefault();
                navigate(e.href);
              }}
            >
            <title>{`${e.title}: tap to learn more`}</title>
            <g className="node" transform={`translate(${e.x} ${e.y})`}>
              <rect x="-70" y="-22" width="140" height="44" rx="12" />
              <circle cx="-52" cy="0" r="4" className="pip" />
              <text x="-40" y="-3" className="n-label">
                {e.label}
              </text>
              <text x="-40" y="12" className="n-sub">
                {e.sub}
              </text>
              {e.cut && (
                <text x="0" y="40" textAnchor="middle" className="n-cut">
                  revoked ✓
                </text>
              )}
            </g>
            </a>
          </g>
        ))}

        {/* your account */}
        <circle cx={CX} cy={CY} r="90" fill="url(#core)" />
        <a
          href="/app"
          className="me-link"
          aria-label="Open the scanner"
          onClick={(ev) => {
            ev.preventDefault();
            navigate("/app");
          }}
        >
        <title>Scan an account</title>
        <g transform={`translate(${CX} ${CY})`} className="me">
          <circle r="34" />
          {/* the Unyoke "U", from the logo */}
          <g transform="translate(-19 -19) scale(0.032)" className="me-u">
            <path d="M282 317H537V657A229.5 229.5 0 0 0 766.5 886.5L797 884A318 318 0 0 1 282 637Z" />
            <path d="M615 317H918V657A151.5 151.5 0 0 1 615 657Z" />
          </g>
          <text y="58" textAnchor="middle" className="me-label">
            your account · scan
          </text>
        </g>
        </a>
      </svg>
    </div>
  );
}
