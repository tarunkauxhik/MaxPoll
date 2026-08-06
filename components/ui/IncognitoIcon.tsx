/**
 * A hand-drawn hat-and-glasses silhouette — not a copy of any trademarked
 * asset — used everywhere chat's anonymity needs a glance-only signal.
 */
export function IncognitoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 15c0-3.5 3.2-6 8-6s8 2.5 8 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="15.5" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="15.5" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.8 15.5h4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M3 13.5c1-2.8 2-5 3.5-6.2C8 6 9.8 5.3 12 5.3s4 .7 5.5 2c1.5 1.2 2.5 3.4 3.5 6.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
