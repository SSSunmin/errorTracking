/** 의존성 없는 인라인 SVG 차트 — 번들 경량 유지 */

/** 이슈 목록 행의 미니 스파크라인 (24개 막대) */
export function Sparkline({
  data,
  width = 88,
  height = 24,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0 || data.every((v) => v === 0)) {
    return <div className="spark-empty" style={{ width, height }} />;
  }
  const max = Math.max(...data, 1);
  const gap = 1;
  const barW = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      {data.map((v, i) => {
        const h = v === 0 ? 1 : Math.max(1, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            fill={v === 0 ? "var(--border-strong)" : "var(--accent)"}
          />
        );
      })}
    </svg>
  );
}

/** 발생 추이 막대 그래프 (24h=24개 / 14d=14개) */
export function TrendBars({
  data,
  height = 120,
}: {
  data: number[];
  height?: number;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="trend" style={{ height }}>
      {data.map((v, i) => {
        const h = v === 0 ? 0 : Math.max(2, (v / max) * (height - 18));
        return (
          <div className="trend-col" key={i} title={`${v}건`}>
            <div className="trend-bar" style={{ height: h }} />
          </div>
        );
      })}
    </div>
  );
}
