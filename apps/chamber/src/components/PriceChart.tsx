import { useEffect, useRef, useState } from 'react';
import {
    CandlestickSeries,
    ColorType,
    createChart,
    HistogramSeries,
    TickMarkType,
    type IChartApi,
    type ISeriesApi,
    type Time,
    type UTCTimestamp,
} from 'lightweight-charts';

import type { Candle } from '@gaemigul/queen';

import { signedPercent, won } from '../format.ts';
import { DOWN_COLOR, UP_COLOR } from '../regimes.ts';

export interface RegimeBand {
    time: number;
    color: string;
}

interface PriceChartProps {
    candles: Candle[];
    /** 차트 하단 띠에 칠할 캔들별 국면 색 */
    regimeBands: RegimeBand[];
    /** 이 값이 바뀔 때만 전체 구간이 보이도록 줌을 되돌린다 */
    fitKey: string;
}

const toChartTime = (ms: number) => (ms / 1000) as UTCTimestamp;
const toDate = (time: Time) => new Date((time as number) * 1000);

const dateTimeFormat = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

// lightweight-charts는 시간을 UTC로 표시하므로 로컬 시간으로 직접 포맷한다.
function formatTickMark(time: Time, type: TickMarkType): string {
    const date = toDate(time);
    switch (type) {
        case TickMarkType.Year:
            return `${date.getFullYear()}년`;
        case TickMarkType.Month:
            return `${date.getMonth() + 1}월`;
        case TickMarkType.DayOfMonth:
            return `${date.getMonth() + 1}/${date.getDate()}`;
        case TickMarkType.Time:
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        case TickMarkType.TimeWithSeconds:
            return date.toLocaleTimeString('ko-KR', { hour12: false });
    }
}

export function PriceChart({ candles, regimeBands, fitKey }: PriceChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const bandSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const fittedKeyRef = useRef<string | null>(null);
    const [hovered, setHovered] = useState<Candle | null>(null);

    useEffect(() => {
        const chart = createChart(containerRef.current!, {
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: '#09090b' },
                textColor: '#a1a1aa',
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: '#18181b' },
                horzLines: { color: '#18181b' },
            },
            rightPriceScale: { borderColor: '#27272a', scaleMargins: { top: 0.08, bottom: 0.1 } },
            timeScale: {
                borderColor: '#27272a',
                timeVisible: true,
                secondsVisible: true,
                tickMarkFormatter: formatTickMark,
            },
            localization: { locale: 'ko-KR', timeFormatter: (time: Time) => dateTimeFormat.format(toDate(time)) },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: UP_COLOR,
            downColor: DOWN_COLOR,
            borderVisible: false,
            wickUpColor: UP_COLOR,
            wickDownColor: DOWN_COLOR,
            priceFormat: { type: 'price', precision: 0, minMove: 1 },
        });

        const bandSeries = chart.addSeries(HistogramSeries, {
            priceScaleId: 'regime',
            priceLineVisible: false,
            lastValueVisible: false,
        });
        chart.priceScale('regime').applyOptions({ visible: false, scaleMargins: { top: 0.95, bottom: 0 } });

        chart.subscribeCrosshairMove((param) => {
            const bar = param.seriesData.get(candleSeries);
            if (!param.time || !bar || !('open' in bar)) {
                setHovered(null);
                return;
            }
            setHovered({
                time: (param.time as number) * 1000,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
            });
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        bandSeriesRef.current = bandSeries;
        // 새로 만든 차트는 아직 줌을 맞춘 적이 없다.
        fittedKeyRef.current = null;
        return () => chart.remove();
    }, []);

    useEffect(() => {
        candleSeriesRef.current?.setData(
            candles.map((c) => ({ time: toChartTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })),
        );
        bandSeriesRef.current?.setData(
            regimeBands.map((b) => ({ time: toChartTime(b.time), value: 1, color: b.color })),
        );
        // 파라미터만 바뀌었을 때는 보고 있던 구간을 유지한다.
        if (fittedKeyRef.current !== fitKey) {
            chartRef.current?.timeScale().fitContent();
            fittedKeyRef.current = fitKey;
        }
    }, [candles, regimeBands, fitKey]);

    const shown = hovered ?? candles.at(-1);
    const change = shown ? shown.close / shown.open - 1 : 0;

    return (
        <div className="relative h-[480px] w-full overflow-hidden rounded-lg border border-zinc-800">
            <div ref={containerRef} className="absolute inset-0" />
            {shown && (
                <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-wrap gap-x-3 font-mono text-xs text-zinc-400 tabular-nums">
                    <span>{dateTimeFormat.format(new Date(shown.time))}</span>
                    <span>
                        시 <span className="text-zinc-100">{won(shown.open)}</span>
                    </span>
                    <span>
                        고 <span className="text-zinc-100">{won(shown.high)}</span>
                    </span>
                    <span>
                        저 <span className="text-zinc-100">{won(shown.low)}</span>
                    </span>
                    <span>
                        종 <span className="text-zinc-100">{won(shown.close)}</span>
                    </span>
                    <span style={{ color: change >= 0 ? UP_COLOR : DOWN_COLOR }}>{signedPercent(change, 2)}</span>
                </div>
            )}
        </div>
    );
}
