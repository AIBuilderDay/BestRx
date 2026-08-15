/**
 * The BestRx logo — the capsule lockup from mockups/logo.html.
 *
 * This is the one brand mark for the whole app; never hand-roll another wordmark or dot.
 * The capsule fills with `currentColor` and the wordmark knocks out to the page background,
 * so it works on any surface in light and dark: set the text color, not a fill.
 * Static copies for docs/mockups/favicons live in public/images/brand/.
 */
export function Logo({ height = 26, className }: { height?: number; className?: string }) {
  const width = (height * 300) / 110;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 300 110"
      role="img"
      aria-label="BestRx"
      className={className}
    >
      <rect x="5" y="5" width="290" height="100" rx="50" fill="currentColor" />
      <text
        x="80"
        y="74"
        fill="var(--bg)"
        fontFamily="var(--font-sans)"
        fontSize="52"
        fontWeight="700"
        letterSpacing="-2"
      >
        best
      </text>
      <text
        x="187"
        y="46"
        fill="var(--bg)"
        fontFamily="var(--font-sans)"
        fontSize="21"
        fontWeight="700"
        letterSpacing="0.5"
      >
        RX
      </text>
    </svg>
  );
}
