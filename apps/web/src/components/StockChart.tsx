import { useEffect, useMemo, useRef, useState } from 'react';
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

import { TICKS_PER_DAY, TIMEFRAMES, toCandles, type Candle, type TimeframeId } from '@gaemigul/queen';

import { changeClass, dateTime, DOWN_COLOR, num, signedPercent, UP_COLOR } from '../format.ts';
import { roundPrice } from '../game/market.ts';
import { STOCK_BY_ID } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';

/** 처음 열거나 단위를 바꿨을 때 보여줄 캔들 수 */
const VISIBLE_CANDLES = 120;

const toChartTime = (ms: number) => (ms / 1000) as UTCTimestamp;
const toDate = (time: Time) => new Date((time as number) * 1000);
const toBar = (c: Candle) => ({
    time: toChartTime(c.time),
    open: roundPrice(c.open),
    high: roundPrice(c.high),
    low: roundPrice(c.low),
    close: roundPrice(c.close),
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

export function StockChart({ stockId }: { stockId: string }) {
    const { tick, account } = useGame();
    const [timeframeId, setTimeframeId] = useState<TimeframeId>('1m');
    const [hovered, setHovered] = useState<ReturnType<typeof toBar> | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    /** 지금 차트에 올라가 있는 데이터가 어떤 종목·단위의 몇 개 캔들인지 */
    const loadedRef = useRef<{ key: string; length: number } | null>(null);

    const timeframe = TIMEFRAMES.find((t) => t.id === timeframeId)!;
    const stock = STOCK_BY_ID.get(stockId)!;

    useEffect(() => {
        const chart = createChart(containerRef.current!, {
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: '#09090b' },
                textColor: '#a1a1aa',
                attributionLogo: false,
            },
            grid: { vertLines: { color: '#18181b' }, horzLines: { color: '#18181b' } },
            rightPriceScale: { borderColor: '#27272a' },
            timeScale: {
                borderColor: '#27272a',
                timeVisible: true,
                secondsVisible: true,
                tickMarkFormatter: formatTickMark,
            },
            localization: { locale: 'ko-KR', timeFormatter: (time: Time) => dateTime(toDate(time).getTime()) },
        });
        const series = chart.addSeries(CandlestickSeries, {
            upColor: UP_COLOR,
            downColor: DOWN_COLOR,
            borderVisible: false,
            wickUpColor: UP_COLOR,
            wickDownColor: DOWN_COLOR,
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

    // 종목이나 단위가 바뀌면 전체를 다시 올리고, 틱만 지나면 새로 생기거나 바뀐 캔들만 갱신한다.
    useEffect(() => {
        const series = seriesRef.current!;
        const candles = toCandles(game.market.byId.get(stockId)!.prices, timeframe.ticks, game.epoch);
        const key = `${stockId}-${timeframe.id}`;
        const loaded = loadedRef.current;

        if (loaded?.key === key) {
            for (let i = Math.max(0, loaded.length - 1); i < candles.length; i++) series.update(toBar(candles[i]!));
        } else {
            series.setData(candles.map(toBar));
            chartRef.current!.timeScale().setVisibleLogicalRange({
                from: candles.length - VISIBLE_CANDLES,
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
        const lines: IPriceLine[] = [];
        if (holding) {
            lines.push(
                series.createPriceLine({
                    price: holding.avgPrice,
                    color: '#f59e0b',
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
                    color: o.side === 'buy' ? UP_COLOR : DOWN_COLOR,
                    lineWidth: 1,
                    lineStyle: 1,
                    title: `${o.side === 'buy' ? '매수' : '매도'} ${o.qty}주`,
                }),
            );
        }
        return () => lines.forEach((line) => series.removePriceLine(line));
    }, [holding, orders]);

    const price = game.market.price(stockId);
    const change = price / game.market.price(stockId, tick - TICKS_PER_DAY) - 1;

    return (
        <section aria-label={`${stock.name} 차트`} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-sm text-zinc-400">
                        {stock.name} <span className="text-zinc-600">· {stock.sector}</span>
                    </h2>
                    <p className="font-mono text-2xl font-semibold tabular-nums">
                        {num(price)}
                        <span className={`ml-2 text-sm ${changeClass(change)}`}>{signedPercent(change)}</span>
                    </p>
                </div>
                <fieldset className="flex rounded-md border border-zinc-700 p-0.5 text-sm">
                    <legend className="sr-only">캔들 단위</legend>
                    {TIMEFRAMES.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            aria-pressed={t.id === timeframeId}
                            onClick={() => setTimeframeId(t.id)}
                            className={`rounded px-2.5 py-1 ${t.id === timeframeId ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </fieldset>
            </div>

            <div className="relative h-[360px] overflow-hidden rounded-lg border border-zinc-800 lg:h-[440px]">
                <div ref={containerRef} className="absolute inset-0" />
                {hovered && (
                    <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-wrap gap-x-3 font-mono text-xs text-zinc-400 tabular-nums">
                        <span>{dateTime(hovered.time * 1000)}</span>
                        <span>
                            시 <span className="text-zinc-100">{num(hovered.open)}</span>
                        </span>
                        <span>
                            고 <span className="text-zinc-100">{num(hovered.high)}</span>
                        </span>
                        <span>
                            저 <span className="text-zinc-100">{num(hovered.low)}</span>
                        </span>
                        <span>
                            종 <span className="text-zinc-100">{num(hovered.close)}</span>
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}
