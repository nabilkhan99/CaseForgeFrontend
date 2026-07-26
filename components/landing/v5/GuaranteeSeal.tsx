/** Scalloped seal edge — precomputed (28 scallops) so there is no render-time
 *  Math and therefore no SSR/client hydration mismatch. */
const SEAL_POINTS =
  '156.00,80.00 147.57,87.61 154.09,96.91 144.18,102.46 148.47,112.98 137.58,116.18 139.42,127.39 128.08,128.08 127.39,139.42 116.18,137.58 112.98,148.47 102.46,144.18 96.91,154.09 87.61,147.57 80.00,156.00 72.39,147.57 63.09,154.09 57.54,144.18 47.02,148.47 43.82,137.58 32.61,139.42 31.92,128.08 20.58,127.39 22.42,116.18 11.53,112.98 15.82,102.46 5.91,96.91 12.43,87.61 4.00,80.00 12.43,72.39 5.91,63.09 15.82,57.54 11.53,47.02 22.42,43.82 20.58,32.61 31.92,31.92 32.61,20.58 43.82,22.42 47.02,11.53 57.54,15.82 63.09,5.91 72.39,12.43 80.00,4.00 87.61,12.43 96.91,5.91 102.46,15.82 112.98,11.53 116.18,22.42 127.39,20.58 128.08,31.92 139.42,32.61 137.58,43.82 148.47,47.02 144.18,57.54 154.09,63.09 147.57,72.39';

/**
 * Decorative £500 guarantee seal — scalloped orange medallion.
 *
 * Shared by the landing guarantee section and the portfolio-tool banner, so the
 * medallion is drawn once rather than diverging between the two.
 * `className` sets the size; callers pass their own h-/w- pair.
 */
export default function GuaranteeSeal({
  className = 'h-28 w-28 flex-shrink-0 sm:h-36 sm:w-36',
}: {
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 160 160" aria-label="£500 guarantee seal">
      <polygon points={SEAL_POINTS} fill="#B45309" />
      <circle cx="80" cy="80" r="60" fill="#B45309" />
      <circle
        cx="80"
        cy="80"
        r="58"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <text x="80" y="34" textAnchor="middle" fontSize="11" fill="#FFFFFF" fillOpacity="0.8">
        ★ ★ ★
      </text>
      <text
        x="80"
        y="86"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fill="#FFFFFF"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        £500
      </text>
      <text
        x="80"
        y="106"
        textAnchor="middle"
        fontSize="12"
        letterSpacing="2"
        fill="#FFFFFF"
        fillOpacity="0.9"
      >
        GUARANTEE
      </text>
      <text x="80" y="130" textAnchor="middle" fontSize="11" fill="#FFFFFF" fillOpacity="0.8">
        ★ ★ ★
      </text>
    </svg>
  );
}
