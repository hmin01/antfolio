import { useState, type ReactNode } from 'react';

import { bigWon, changeClass, num, percent, signedPercent } from '../format.ts';
import { quoteOf } from '../game/quotes.ts';
import { SECTOR_NAMES, STOCKS } from '../game/stocks.ts';
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
    { id: 'cap', label: '시총' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

const ROW_GRID =
    'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_6rem_3.75rem_3.75rem_4.75rem_3.25rem_4.5rem]';

/** 종목 화면에 갔다 돌아와도 고른 업종이 남도록 탭을 닫기 전까지만 기억한다 */
const SECTOR_KEY = 'antfolio:sector';
function readSector(): string | null {
    try {
        const saved = sessionStorage.getItem(SECTOR_KEY);
        return saved && SECTOR_NAMES.includes(saved) ? saved : null;
    } catch {
        return null;
    }
}
function writeSector(sector: string | null) {
    try {
        if (sector) sessionStorage.setItem(SECTOR_KEY, sector);
        else sessionStorage.removeItem(SECTOR_KEY);
    } catch {
        // 저장이 막혀 있어도 탭은 그대로 동작한다.
    }
}

interface SectorTabProps {
    label: string;
    /** 업종 종목들의 24시간 등락률 평균. 전체 탭은 없음 */
    rate?: number;
    selected: boolean;
    onSelect: () => void;
}

function SectorTab({ label, rate, selected, onSelect }: SectorTabProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface-2 aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:font-semibold aria-pressed:text-surface"
        >
            {label}
            {rate !== undefined && (
                <span className={`ml-1 text-xs tabular-nums ${selected ? '' : changeClass(rate)}`}>
                    {signedPercent(rate, 1)}
                </span>
            )}
        </button>
    );
}

/** 넓은 화면에서만 보이는 숫자 칸 */
function Cell({ className = '', children }: { className?: string; children: ReactNode }) {
    return <span className={`hidden text-right text-sm tabular-nums sm:block ${className}`}>{children}</span>;
}

export function StockTable() {
    const { account } = useGame();
    const [sort, setSort] = useState<SortId>('default');
    const [sector, setSector] = useState<string | null>(readSector);

    const selectSector = (next: string | null) => {
        setSector(next);
        writeSector(next);
    };

    const allRows = STOCKS.map((stock) => ({
        stock,
        quote: quoteOf(game.market, stock.id),
        dividend: game.dividendOf(stock.id),
    }));
    /** 업종의 3시간 등락률. 실제 업종지수처럼 시가총액이 큰 회사의 등락을 더 크게 반영한다 */
    const sectorRate = (name: string) => {
        const members = allRows.filter((r) => r.stock.sector === name);
        const now = members.reduce((sum, r) => sum + r.quote.marketCap, 0);
        const before = members.reduce((sum, r) => sum + r.stock.shares * r.quote.price3hAgo, 0);
        return now / before - 1;
    };
    const rows = sector ? allRows.filter((r) => r.stock.sector === sector) : allRows;
    if (sort === 'rise') rows.sort((a, b) => b.quote.changeRate3h - a.quote.changeRate3h);
    if (sort === 'fall') rows.sort((a, b) => a.quote.changeRate3h - b.quote.changeRate3h);
    if (sort === 'dividend') rows.sort((a, b) => b.dividend.yield - a.dividend.yield);
    if (sort === 'cap') rows.sort((a, b) => b.quote.marketCap - a.quote.marketCap);

    return (
        <Panel
            title={sector ? `${sector} 종목` : '전체 종목'}
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
            <fieldset className="-mx-5 mb-3 flex min-w-0 [scrollbar-width:none] gap-1.5 overflow-x-auto px-5 pb-1 sm:flex-wrap sm:overflow-visible">
                <legend className="sr-only">업종</legend>
                <SectorTab label="전체" selected={sector === null} onSelect={() => selectSector(null)} />
                {SECTOR_NAMES.map((name) => (
                    <SectorTab
                        key={name}
                        label={name}
                        rate={sectorRate(name)}
                        selected={sector === name}
                        onSelect={() => selectSector(name)}
                    />
                ))}
            </fieldset>
            <div className={`${ROW_GRID} border-b border-line px-2 pb-2 text-xs text-faint`}>
                <span className="text-center">#</span>
                <span>종목</span>
                <span className="text-right">현재가</span>
                <span className="hidden text-right sm:block">1시간</span>
                <span className="hidden text-right sm:block">3시간</span>
                <span className="hidden text-right sm:block">시총</span>
                <span className="hidden text-right sm:block">배당</span>
                <span className="hidden text-right sm:block">3시간 흐름</span>
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
                                            <span className="text-primary sm:hidden">
                                                {' '}
                                                · 배당 {percent(dividend.yield)}
                                            </span>
                                        </span>
                                    </span>
                                </span>
                                <span className="text-right tabular-nums">
                                    <span className="block text-[15px] font-semibold">{num(quote.price)}원</span>
                                </span>
                                <Cell className={`font-semibold ${changeClass(quote.changeRate1h)}`}>
                                    {signedPercent(quote.changeRate1h)}
                                </Cell>
                                <Cell className={`font-semibold ${changeClass(quote.changeRate3h)}`}>
                                    {signedPercent(quote.changeRate3h)}
                                </Cell>
                                <Cell className="text-muted">{bigWon(quote.marketCap)}</Cell>
                                <Cell className="font-semibold text-primary">{percent(dividend.yield)}</Cell>
                                <span className="hidden justify-end sm:flex">
                                    <Sparkline points={quote.spark} width={64} />
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </Panel>
    );
}
