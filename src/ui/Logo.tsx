/**
 * Unyoke's mark: a "U" whose right arm has come free of the bowl around it,
 * like a yoke lifted off. Lime on near-black; the same drawing as favicon.svg.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1200 1200" role="img" aria-label="Unyoke logo">
      <rect width="1200" height="1200" rx="300" fill="#0e0f11" />
      <path fill="var(--accent, #d8ff5c)" d="M282 317H537V657A229.5 229.5 0 0 0 766.5 886.5L797 884A318 318 0 0 1 282 637Z" />
      <path fill="var(--accent, #d8ff5c)" d="M615 317H918V657A151.5 151.5 0 0 1 615 657Z" />
    </svg>
  );
}
