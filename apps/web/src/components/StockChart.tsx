import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
    CandlestickSeries,
    ColorType,
    createChart,
    TickMarkType,
    type IChartApi,
    type IPriceLine,
    type ISeriesApi,
    type Time,
    type UTCTimestamp,
} from 'lightweight-charts';

import { tickStartTime, TIMEFRAMES, toCandles, type Candle, type TimeframeId } from '@gaemigul/queen';

import { dateTime, num } from '../format.ts';
import { roundPrice } from '../game/market.ts';
import { game, useGame } from '../game/store.ts';
import { Panel } from './Panel.tsx';

/** 처음 열거나 단위를 바꿨을 때 보여줄 캔들 수 */
const VISIBLE_CANDLES = 120;
const MIN_VISIBLE_SLOTS = 30;

const toChartTime = (ms: number) => (ms / 1000) as UTCTimestamp;
const toDate = (time: Time) => new Date((time as number) * 1000);
const toBar = (c: Candle) => ({
    time: toChartTime(c.time),
    open: roundPrice(c.open),
    high: roundPrice(c.high),
    low: roundPrice(c.low),
    close: roundPrice(c.close),
});

const DARK_QUERY = '(prefers-color-scheme: dark)';
const subscribeScheme = (listener: () => void) => {
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
};
/** 기기 테마가 바뀌면 다시 그리도록 지금 테마를 구독한다. */
const useDarkScheme = () => useSyncExternalStore(subscribeScheme, () => window.matchMedia(DARK_QUERY).matches);

/** index.css의 색 토큰. 차트는 캔버스라 CSS 클래스를 못 쓰고 값을 직접 넘긴다. */
function themeColors() {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(`--${name}`).trim();
    return {
        surface: token('surface'),
        faint: token('faint'),
        line: token('line'),
        up: token('up'),
        down: token('down'),
        warn: token('warn'),
    };
}

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

export function StockChart({ stockId }: { stockId: string }) {
    const { tick, account } = useGame();
    const dark = useDarkScheme();
    const [timeframeId, setTimeframeId] = useState<TimeframeId>('1m');
    const [hovered, setHovered] = useState<ReturnType<typeof toBar> | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    /** 지금 차트에 올라가 있는 데이터가 어떤 종목·단위의 몇 개 캔들인지 */
    const loadedRef = useRef<{ key: string; length: number } | null>(null);

    const timeframe = TIMEFRAMES.find((t) => t.id === timeframeId)!;

    useEffect(() => {
        const chart = createChart(containerRef.current!, {
            autoSize: true,
            layout: { attributionLogo: false, fontFamily: getComputedStyle(document.body).fontFamily },
            timeScale: {
                timeVisible: true,
                secondsVisible: true,
                tickMarkFormatter: formatTickMark,
            },
            localization: { locale: 'ko-KR', timeFormatter: (time: Time) => dateTime(toDate(time).getTime()) },
        });
        const series = chart.addSeries(CandlestickSeries, {
            borderVisible: false,
            priceFormat: { type: 'price', precision: 0, minMove: 1 },
        });

        chart.subscribeCrosshairMove((param) => {
            const bar = param.seriesData.get(series);
            setHovered(
                param.time && bar && 'open' in bar
                    ? {
                          time: param.time as UTCTimestamp,
                          open: bar.open,
                          high: bar.high,
                          low: bar.low,
                          close: bar.close,
                      }
                    : null,
            );
        });

        chartRef.current = chart;
        seriesRef.current = series;
        loadedRef.current = null;
        return () => chart.remove();
    }, []);

    useEffect(() => {
        const c = themeColors();
        chartRef.current!.applyOptions({
            layout: { background: { type: ColorType.Solid, color: c.surface }, textColor: c.faint },
            grid: { vertLines: { color: c.line }, horzLines: { color: c.line } },
            rightPriceScale: { borderColor: c.line },
            timeScale: { borderColor: c.line },
        });
        seriesRef.current!.applyOptions({
            upColor: c.up,
            downColor: c.down,
            wickUpColor: c.up,
            wickDownColor: c.down,
        });
    }, [dark]);

    // 종목이나 단위가 바뀌면 전체를 다시 올리고, 틱만 지나면 새로 생기거나 바뀐 캔들만 갱신한다.
    useEffect(() => {
        const series = seriesRef.current!;
        // 이 종목의 지난 기록을 채운 뒤, 기록이 시작하는 틱의 시각을 기준으로 캔들을 묶는다.
        const { market } = game;
        market.ensureHistory(stockId);
        const { prices, startTick } = market.byId.get(stockId)!;
        const candles = toCandles(prices, timeframe.ticks, tickStartTime(startTick, game.epoch));
        // 기록의 시작이 바뀌면(오래된 기록 정리) 앞쪽 캔들이 달라지므로 전체를 다시 올린다.
        const key = `${stockId}-${timeframe.id}-${startTick}`;
        const loaded = loadedRef.current;

        if (loaded?.key === key) {
            for (let i = Math.max(0, loaded.length - 1); i < candles.length; i++) series.update(toBar(candles[i]!));
        } else {
            series.setData(candles.map(toBar));
            chartRef.current!.timeScale().setVisibleLogicalRange({
                // 캔들이 적을 때(1일봉 등) 120칸을 다 잡으면 오른쪽 끝에 몰리므로 최소 30칸만 잡는다.
                from: candles.length - Math.max(Math.min(candles.length, VISIBLE_CANDLES), MIN_VISIBLE_SLOTS),
                to: candles.length + 3,
            });
        }
        loadedRef.current = { key, length: candles.length };
        // 가격은 game.market에서 직접 읽으므로, 틱이 지날 때마다 다시 그리도록 tick을 의존성에 둔다.
        // oxlint-disable-next-line react/exhaustive-deps
    }, [stockId, timeframe, tick]);

    // 평단가와 미체결 주문을 가로선으로 보여준다.
    const holding = account.holdings[stockId];
    const orders = useMemo(() => account.orders.filter((o) => o.stockId === stockId), [account.orders, stockId]);
    useEffect(() => {
        const series = seriesRef.current!;
        const c = themeColors();
        const lines: IPriceLine[] = [];
        if (holding) {
            lines.push(
                series.createPriceLine({
                    price: holding.avgPrice,
                    color: c.warn,
                    lineWidth: 1,
                    lineStyle: 2,
                    title: '평단',
                }),
            );
        }
        for (const o of orders) {
            lines.push(
                series.createPriceLine({
                    price: o.limitPrice,
                    color: o.side === 'buy' ? c.up : c.down,
                    lineWidth: 1,
                    lineStyle: 1,
                    title: `${o.side === 'buy' ? '구매' : '판매'} ${o.qty}주`,
                }),
            );
        }
        return () => lines.forEach((line) => series.removePriceLine(line));
    }, [holding, orders, dark]);

    return (
        <Panel
            title="차트"
            action={
                <fieldset className="flex gap-0.5 rounded-lg bg-surface-2 p-0.5 text-sm">
                    <legend className="sr-only">캔들 단위</legend>
                    {TIMEFRAMES.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            aria-pressed={t.id === timeframeId}
                            onClick={() => setTimeframeId(t.id)}
                            className="rounded-md px-2.5 py-1 text-faint hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg aria-pressed:shadow-sm"
                        >
                            {t.label}
                        </button>
                    ))}
                </fieldset>
            }
        >
            <div className="relative h-[340px] lg:h-[420px]">
                <div ref={containerRef} className="absolute inset-0" />
                {hovered && (
                    <div className="pointer-events-none absolute top-1 left-1 z-10 flex flex-wrap gap-x-3 rounded-md bg-surface/80 px-1.5 text-xs text-faint tabular-nums">
                        <span>{dateTime(hovered.time * 1000)}</span>
                        <span>
                            시작 <span className="text-fg">{num(hovered.open)}</span>
                        </span>
                        <span>
                            고가 <span className="text-up">{num(hovered.high)}</span>
                        </span>
                        <span>
                            저가 <span className="text-down">{num(hovered.low)}</span>
                        </span>
                        <span>
                            종가 <span className="text-fg">{num(hovered.close)}</span>
                        </span>
                    </div>
                )}
            </div>
        </Panel>
    );
}
