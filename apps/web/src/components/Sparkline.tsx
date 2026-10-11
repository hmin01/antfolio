interface SparklineProps {
    points: number[];
    width?: number;
    height?: number;
}

/** 24시간 흐름을 보여주는 작은 선 그래프. 시작보다 오르면 빨강, 내리면 파랑. */
export function Sparkline({ points, width = 80, height = 28 }: SparklineProps) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const path = points
        .map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = height - 2 - ((p - min) / span) * (height - 4);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join('');
    const up = points.at(-1)! >= points[0]!;
    const baseY = height - 2 - ((points[0]! - min) / span) * (height - 4);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
            <line x1={0} x2={width} y1={baseY} y2={baseY} stroke="var(--line)" strokeDasharray="2 2" />
            <path d={path} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth={1.5} />
        </svg>
    );
}
