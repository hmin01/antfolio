import { useState } from 'react';

import { changeClass, num, percent, signedPercent, signedWon } from '../format.ts';
import { quoteOf } from '../game/quotes.ts';
import { STOCKS } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';
import { stockHref } from '../router.ts';
import { Panel } from './Panel.tsx';
import { Sparkline } from './Sparkline.tsx';
import { StockAvatar } from './StockAvatar.tsx';

const SORTS = [
    { id: 'default', label: '기본' },
    { id: 'rise', label: '상승' },
    { id: 'fall', label: '하락' },
    { id: 'dividend', label: '배당' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

const ROW_GRID =
    'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_4rem_4rem_5.5rem_5.5rem]';

/** 1·2시간 등락은 비율만 짧게 보여준다. 24시간 등락은 금액까지 따로 보여준다 */
function RateCell({ rate }: { rate: number }) {
    return (
        <span className={`hidden text-right text-sm font-semibold tabular-nums sm:block ${changeClass(rate)}`}>
            {signedPercent(rate)}
        </span>
    );
}

export function StockTable() {
    const { account } = useGame();
    const [sort, setSort] = useState<SortId>('default');

    const rows = STOCKS.map((stock) => ({
        stock,
        quote: quoteOf(game.market, stock.id),
        dividend: game.dividendOf(stock.id),
    }));
    if (sort === 'rise') rows.sort((a, b) => b.quote.changeRate - a.quote.changeRate);
    if (sort === 'fall') rows.sort((a, b) => a.quote.changeRate - b.quote.changeRate);
    if (sort === 'dividend') rows.sort((a, b) => b.dividend.yield - a.dividend.yield);

    return (
        <Panel
            title="전체 종목"
            action={
                <fieldset className="flex gap-1">
                    <legend className="sr-only">정렬</legend>
                    {SORTS.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            aria-pressed={sort === s.id}
                            onClick={() => setSort(s.id)}
                            className="rounded-lg px-2.5 py-1 text-sm text-faint hover:bg-surface-2 aria-pressed:bg-surface-2 aria-pressed:font-semibold aria-pressed:text-fg"
                        >
                            {s.label}
                        </button>
                    ))}
                </fieldset>
            }
        >
            <div className={`${ROW_GRID} border-b border-line px-2 pb-2 text-xs text-faint`}>
                <span className="text-center">#</span>
                <span>종목</span>
                <span className="text-right">현재가</span>
                <span className="hidden text-right sm:block">1시간</span>
                <span className="hidden text-right sm:block">2시간</span>
                <span className="hidden text-right sm:block">24시간</span>
                <span className="hidden text-right sm:block">24시간 흐름</span>
            </div>
            <ol className="-mx-2 mt-1">
                {rows.map(({ stock, quote, dividend }, i) => {
                    const held = stock.id in account.holdings;
                    return (
                        <li key={stock.id}>
                            <a
                                href={stockHref(stock.id)}
                                className={`${ROW_GRID} rounded-xl px-4 py-3 hover:bg-surface-2`}
                            >
                                <span className="text-center text-sm font-semibold text-primary">{i + 1}</span>
                                <span className="flex min-w-0 items-center gap-3">
                                    <StockAvatar stock={stock} />
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1.5">
                                            <span className="truncate text-[15px] font-semibold">{stock.name}</span>
                                            {held && (
                                                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                                    보유
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-faint">
                                            {stock.sector}
                                            <span className="text-primary"> · 배당 {percent(dividend.yield)}</span>
                                        </span>
                                    </span>
                                </span>
                                <span className="text-right tabular-nums">
                                    <span className="block text-[15px] font-semibold">{num(quote.price)}원</span>
                                    <span className={`text-xs sm:hidden ${changeClass(quote.change)}`}>
                                        {signedPercent(quote.changeRate)}
                                    </span>
                                </span>
                                <RateCell rate={quote.changeRate1h} />
                                <RateCell rate={quote.changeRate2h} />
                                <span
                                    className={`hidden text-right tabular-nums sm:block ${changeClass(quote.change)}`}
                                >
                                    <span className="block text-[15px] font-semibold">
                                        {signedPercent(quote.changeRate)}
                                    </span>
                                    <span className="text-xs">{signedWon(quote.change)}</span>
                                </span>
                                <span className="hidden justify-end sm:flex">
                                    <Sparkline points={quote.spark} />
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </Panel>
    );
}
