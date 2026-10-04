/** A few soft hearts drifting up behind the page. Purely decorative. */
const hearts = [
  { left: "4%", size: 18, dur: 26, delay: 0, alpha: 0.16 },
  { left: "14%", size: 12, dur: 19, delay: 7, alpha: 0.2 },
  { left: "27%", size: 22, dur: 31, delay: 3, alpha: 0.12 },
  { left: "41%", size: 14, dur: 23, delay: 12, alpha: 0.16 },
  { left: "56%", size: 10, dur: 18, delay: 5, alpha: 0.22 },
  { left: "67%", size: 20, dur: 28, delay: 15, alpha: 0.13 },
  { left: "78%", size: 13, dur: 21, delay: 9, alpha: 0.18 },
  { left: "89%", size: 24, dur: 34, delay: 1, alpha: 0.12 },
  { left: "95%", size: 11, dur: 20, delay: 17, alpha: 0.2 },
];

export function FloatingHearts() {
  return (
    <div className="floating-hearts" aria-hidden="true">
      {hearts.map((h, i) => (
        <span
          key={i}
          style={
            {
              left: h.left,
              "--dur": `${h.dur}s`,
              "--delay": `-${h.delay}s`,
              "--alpha": h.alpha,
            } as React.CSSProperties
          }
        >
          <svg width={h.size} height={h.size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
