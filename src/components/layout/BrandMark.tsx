/** Original orbital-ring brand mark (tilted ring + core + satellite). Server-safe (no hooks). */
export function BrandMark({ size = 30, gradientId = 'bm' }: { size?: number; gradientId?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="3" y1="26" x2="29" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7EF7C9" />
          <stop offset="0.55" stopColor="#52C7EA" />
          <stop offset="1" stopColor="#8B7CFF" />
        </linearGradient>
      </defs>
      <ellipse
        cx="16"
        cy="16"
        rx="13.2"
        ry="5.6"
        transform="rotate(-28 16 16)"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
      />
      <circle cx="16" cy="16" r="5" stroke={`url(#${gradientId})`} strokeWidth="1.6" />
      <circle cx="16" cy="16" r="1.7" fill="#7EF7C9" />
      <circle cx="26.6" cy="10.1" r="1.6" fill="#C9D1D9" />
    </svg>
  );
}
