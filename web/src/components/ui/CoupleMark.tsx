/** Two hearts leaning into each other, one for each of us. */
export function CoupleMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const heart = "M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z";
  return (
    <svg width={size} height={size * 0.8} viewBox="1 3 30 24" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="couple-left" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b794ff" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="couple-right" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <path d={heart} fill="url(#couple-left)" transform="rotate(-14 12 14)" />
      <path
        d={heart}
        fill="url(#couple-right)"
        stroke="var(--surface)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        transform="translate(8.5 1.5) rotate(14 12 14)"
      />
    </svg>
  );
}
