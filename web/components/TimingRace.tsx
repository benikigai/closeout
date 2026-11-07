"use client";

/* Timing race: firmware writes calibration at 50 ms. Cold driver is ready
   at 180 ms. Cold state drops the write. Fixed state waits, then writes. */
export default function TimingRace({ fixed }: { fixed: boolean }) {
  const W = 640, writeX = 60 + (50 / 200) * 520, readyX = 60 + (180 / 200) * 520;
  return (
    <figure aria-label="Driver timing race">
      <svg viewBox={`0 0 ${W} 120`} style={{ width: "100%", maxWidth: W }} role="img">
        <line x1={60} y1={60} x2={580} y2={60} stroke="#666" strokeWidth={2} />
        {[0, 50, 100, 150, 200].map((ms) => (
          <g key={ms}>
            <line x1={60 + (ms / 200) * 520} y1={54} x2={60 + (ms / 200) * 520} y2={66} stroke="#666" />
            <text x={60 + (ms / 200) * 520 - 10} y={84} fontSize={11} fill="#999">{ms} ms</text>
          </g>
        ))}
        <line x1={readyX} y1={22} x2={readyX} y2={98} stroke="#6FA8DC" strokeWidth={2} strokeDasharray="4 3" />
        <text x={readyX - 34} y={16} fontSize={11} fill="#6FA8DC">driver ready 180 ms</text>
        {fixed ? (
          <g>
            <line x1={writeX} y1={44} x2={readyX} y2={44} stroke="#7bc47f" strokeWidth={3} />
            <circle cx={readyX} cy={44} r={6} fill="#7bc47f" />
            <text x={readyX - 52} y={36} fontSize={11} fill="#7bc47f">wait, write, read back</text>
          </g>
        ) : (
          <g>
            <circle cx={writeX} cy={44} r={6} fill="#e05d4f" />
            <text x={writeX - 30} y={36} fontSize={11} fill="#e05d4f">write at 50 ms: dropped</text>
          </g>
        )}
      </svg>
      <figcaption>{fixed
        ? "Fixed firmware waits for the ready line. The write lands. The dome calibrates."
        : "Buggy firmware writes on a fixed clock. The cold driver is not ready. The write vanishes."}</figcaption>
    </figure>
  );
}
