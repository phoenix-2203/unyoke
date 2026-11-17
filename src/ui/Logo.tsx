/**
 * Unyoke's mark: an unlocked shackle that doubles as a "U". The right arm is
 * lifted out of its socket, so the yoke is open.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Unyoke logo">
      <rect width="32" height="32" rx="8" fill="var(--text, #ece8e1)" />
      {/* socket */}
      <rect x="7" y="20" width="18" height="6" rx="2" fill="var(--bg, #0a0b0d)" />
      {/* shackle: left arm in the socket, right arm lifted out */}
      <path
        d="M10.5 21V13a5.5 5.5 0 0 1 11 0v1.5"
        fill="none"
        stroke="var(--bg, #0a0b0d)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="21.5" cy="18" r="1.4" fill="var(--bg, #0a0b0d)" />
    </svg>
  );
}
