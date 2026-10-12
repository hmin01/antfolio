import { useEffect } from 'react';

import { TICK_MS } from '@antfolio/queen';

import { OrderPanel } from '../components/OrderPanel.tsx';
import { Panel } from '../components/Panel.tsx';
import { StockAvatar } from '../components/StockAvatar.tsx';
import { StockChart } from '../components/StockChart.tsx';
import { TradeRow } from '../components/TradeRow.tsx';
import {
    bigWon,
    changeClass,
    changeText,
    duration,
    num,
    percent,
    sharePercent,
    signedPercent,
    signedWon,
    won,
} from '../format.ts';
import { buyableShares } from '../game/account.ts';
import { DIVIDEND_PERIOD_TICKS, MAX_DIVIDEND_YIELD, nextDividend } from '../game/dividends.ts';
import { quoteOf } from '../game/quotes.ts';
import { sizeClass, STOCK_BY_ID } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';
import { HOME_HREF } from '../router.ts';

/** 24시간 저가~고가 사이 현재가 위치 막대 */
function RangeBar({ low, high, price }: { low: number; high: number; price: number }) {
    const position = high === low ? 0.5 : (price - low) / (high - low);
    return (
        <div className="min-w-40">
            <div className="flex justify-between text-xs text-faint">
                <span>24시간 범위</span>
            </div>
            <div className="relative mt-2 h-1 rounded-full bg-surface-3">
                <span
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
                    style={{ left: `${position * 100}%` }}
                />
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums">
                <span className="text-down">{num(low)}</span>
                <span className="text-up">{num(high)}</span>
            </div>
        </div>
    );
}

/** 시가총액, 규모 구분, 발행 주식 수 */
function MarketCapSummary({ stockId, marketCap }: { stockId: string; marketCap: number }) {
    const stock = STOCK_BY_ID.get(stockId)!;
    return (
        <div className="leading-tight">
            <p className="text-xs text-faint">시가총액 · {sizeClass(marketCap)}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{bigWon(marketCap)}</p>
            <p className="text-xs text-muted tabular-nums">발행 {num(stock.shares)}주</p>
        </div>
    );
}

/** 현재 주가 기준 배당률, 주당 배당금, 최근 배당 공시 */
function DividendSummary({ stockId }: { stockId: string }) {
    const info = game.dividendOf(stockId);
    const changed = Math.round(info.lastChange * 100);

    return (
        <div className="leading-tight">
            <p className="text-xs text-faint">배당률 · 3시간마다</p>
            <p className="mt-1 text-lg font-bold text-primary tabular-nums">
                {percent(info.yield)}
                {info.capped && <span className="ml-1 text-xs font-medium text-faint">상한</span>}
            </p>
            <p className="text-xs text-muted tabular-nums">
                주당 {won(info.dps)}
                {changed !== 0 && (
                    <span className={changed > 0 ? 'text-up' : 'text-down'}>
                        {' '}
                        {changed > 0 ? '▲' : '▼'}
                        {Math.abs(changed)}% 공시
                    </span>
                )}
            </p>
        </div>
    );
}

function StockHeader({ stockId }: { stockId: string }) {
    useGame();
    const stock = STOCK_BY_ID.get(stockId)!;
    const quote = quoteOf(game.market, stockId);

    return (
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="flex items-start gap-3">
                <a
                    href={HOME_HREF}
                    aria-label="홈으로"
                    className="-ml-2 flex size-9 items-center justify-center rounded-full text-xl text-muted hover:bg-surface-3"
                >
                    ‹
                </a>
                <StockAvatar stock={stock} size="lg" />
                <div>
                    <h1 className="text-[15px] font-semibold">
                        {stock.name} <span className="font-normal text-faint">{stock.sector}</span>
                    </h1>
                    <p className="text-[28px] leading-tight font-bold tabular-nums">{won(quote.price)}</p>
                    <p className={`text-sm font-medium tabular-nums ${changeClass(quote.change)}`}>
                        {changeText(quote.change, quote.changeRate)}
                        <span className="ml-1 font-normal text-faint">24시간 전보다</span>
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <MarketCapSummary stockId={stockId} marketCap={quote.marketCap} />
                <DividendSummary stockId={stockId} />
                <RangeBar low={quote.low} high={quote.high} price={quote.price} />
            </div>
        </div>
    );
}

/** 이 종목의 보유 현황, 미체결 주문, 거래 내역 */
function StockActivity({ stockId }: { stockId: string }) {
    const { account } = useGame();
    const holding = account.holdings[stockId];
    const orders = account.orders.filter((o) => o.stockId === stockId);
    const trades = account.trades.filter((t) => t.stockId === stockId).slice(0, 20);
    const price = game.market.price(stockId);
    const stock = STOCK_BY_ID.get(stockId)!;
    const info = game.dividendOf(stockId);
    const dividend = holding
        ? nextDividend(holding, account.dividendTick ?? game.market.tick, game.market.tick, info.dps, price)
        : null;

    return (
        <Panel title="내 투자">
            <p className="mb-3 rounded-xl border border-line px-4 py-3 text-sm">
                <span className="text-muted">
                    보유 {duration(DIVIDEND_PERIOD_TICKS * TICK_MS)}마다 1주당{' '}
                    <span className="font-semibold text-fg">{won(info.dps)}</span>을 받아요. 배당률은 주가에 따라
                    달라지고 최대 {percent(MAX_DIVIDEND_YIELD)}까지예요
                </span>
                {dividend && (
                    <span className="mt-1 block text-muted tabular-nums">
                        다음 배당 {duration(dividend.ticksLeft * TICK_MS)} 후 · 예상{' '}
                        <span className="font-semibold text-up">+{won(dividend.expected)}</span>
                    </span>
                )}
            </p>
            <p className="mb-3 text-sm text-muted tabular-nums">
                지분율 <span className="font-semibold text-fg">{sharePercent((holding?.qty ?? 0) / stock.shares)}</span>
                <span className="text-faint">
                    {' '}
                    · 유통 주식 {num(stock.floatShares)}주까지 가질 수 있고, 지금 {num(buyableShares(account, stockId))}
                    주 더 살 수 있어요
                </span>
            </p>
            {holding ? (
                <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-4">
                    {[
                        { label: '보유 수량', value: `${num(holding.qty)}주` },
                        { label: '평균 구매가', value: won(holding.avgPrice) },
                        { label: '평가 금액', value: won(price * holding.qty) },
                    ].map(({ label, value }) => (
                        <div key={label}>
                            <dt className="text-xs text-faint">{label}</dt>
                            <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
                        </div>
                    ))}
                    <div>
                        <dt className="text-xs text-faint">평가 손익</dt>
                        <dd className={`mt-0.5 font-semibold tabular-nums ${changeClass(price - holding.avgPrice)}`}>
                            {signedWon((price - holding.avgPrice) * holding.qty)}
                            <span className="ml-1 text-xs">{signedPercent(price / holding.avgPrice - 1)}</span>
                        </dd>
                    </div>
                </dl>
            ) : (
                <p className="rounded-xl bg-surface-2 p-4 text-sm text-faint">아직 이 종목을 갖고 있지 않아요</p>
            )}

            {orders.length > 0 && (
                <>
                    <h3 className="mt-5 text-sm font-semibold text-muted">미체결 {orders.length}건</h3>
                    <ul className="divide-y divide-line">
                        {orders.map((o) => (
                            <li key={o.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                                <span className="tabular-nums">
                                    <span className={o.side === 'buy' ? 'text-up' : 'text-down'}>
                                        {o.side === 'buy' ? '구매' : '판매'}
                                    </span>{' '}
                                    {num(o.limitPrice)}원 · {num(o.qty)}주
                                </span>
                                <button
                                    type="button"
                                    onClick={() => game.cancelOrder(o.id)}
                                    className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-3"
                                >
                                    취소
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <h3 className="mt-5 text-sm font-semibold text-muted">거래 내역</h3>
            {trades.length > 0 ? (
                <ul className="divide-y divide-line">
                    {trades.map((t) => (
                        <TradeRow key={t.id} trade={t} />
                    ))}
                </ul>
            ) : (
                <p className="py-6 text-center text-sm text-faint">아직 이 종목을 거래한 적이 없어요</p>
            )}
        </Panel>
    );
}

/** 종목 상세. 넓은 화면에서는 차트 옆에 주문 패널 배치 */
export function StockPage({ stockId }: { stockId: string }) {
    const stock = STOCK_BY_ID.get(stockId)!;

    useEffect(() => {
        window.scrollTo(0, 0);
        document.title = `${stock.name} · Antfolio`;
        return () => {
            document.title = 'Antfolio';
        };
    }, [stock.name]);

    return (
        <div className="space-y-4">
            <StockHeader stockId={stockId} />
            {/* 모바일은 차트 → 주문 → 내 주문 순서, 넓은 화면은 주문을 오른쪽 열에 배치 */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
                <div className="min-w-0">
                    <StockChart stockId={stockId} />
                </div>
                <div className="lg:sticky lg:top-[72px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                    <OrderPanel key={stockId} stockId={stockId} />
                </div>
                <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                    <StockActivity stockId={stockId} />
                </div>
            </div>
        </div>
    );
}
