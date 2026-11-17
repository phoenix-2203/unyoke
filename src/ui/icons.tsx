/** Small line icons, drawn for Unyoke (24×24, stroke = currentColor). */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** ERC-20 allowance: a coin with an open tab. */
export const TokenIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="12" r="7" />
    <path d="M11 8.5v7M8.8 10.2c.4-1 1.3-1.5 2.3-1.5 1.3 0 2.2.7 2.2 1.7 0 2.2-4.6 1.1-4.6 3.3 0 1 1 1.7 2.4 1.7 1 0 1.9-.5 2.3-1.4" />
    <path d="M18 7l3-3M21 7V4h-3" />
  </Svg>
);

/** NFT approve-all: a grid of tiles. */
export const NftIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
);

/** Authz grant: a key handed over. */
export const KeyIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="3.5" />
    <path d="M11.5 12H20M17 12v3M20 12v2" />
  </Svg>
);

/** Fee grant: a fuel drop. */
export const FuelIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c3 3.7 5 6.6 5 9.3a5 5 0 0 1-10 0c0-2.7 2-5.6 5-9.3Z" />
    <path d="M10 14a2 2 0 0 0 2 2" />
  </Svg>
);

/** EIP-7702: code running as your account. */
export const CodeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />
  </Svg>
);

export const GitHubIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.6 2.6 5.6 2.9 5.6 2.9a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.2 9.3c0 4.6 2.9 5.7 5.6 6a3 3 0 0 0-.8 2.3V21" />
  </Svg>
);

export const BookIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
  </Svg>
);

export const TrophyIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v4M9 20h6M10 16h4v4h-4z" />
  </Svg>
);

export const WalletIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M16 12.5h2M3 9h15a3 3 0 0 0-3-3" />
  </Svg>
);

export const DropIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c3 3.7 5 6.6 5 9.3a5 5 0 0 1-10 0c0-2.7 2-5.6 5-9.3Z" />
  </Svg>
);

export const ArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);

export const ArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);
