import { useState } from 'react';

import { TICK_MS } from '@antfolio/queen';

import { changeClass, duration, num, signedPercent, signedWon, won } from '../format.ts';
import { nextDividend } from '../game/dividends.ts';
import { STOCK_BY_ID } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';
import { stockHref } from '../router.ts';
import { Panel } from './Panel.tsx';
import { StockAvatar } from './StockAvatar.tsx';
import { DividendRow, TradeRow } from './TradeRow.tsx';

const TABS = [
    { id: 'holdings', label: '보유' },
    { id: 'orders', label: '미체결' },
    { id: 'trades', label: '거래 내역' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Empty({ children }: { children: string }) {
    return <p className="py-10 text-center text-sm text-faint">{children}</p>;
}

function Holdings() {
    const { account } = useGame();
    const rows = Object.entries(account.holdings);
    if (rows.length === 0) return <Empty>아직 가진 주식이 없어요. 아래 종목을 눌러 구매해 보세요</Empty>;

    return (
        <ul className="-mx-2">
            {rows.map(([id, h]) => {
                const stock = STOCK_BY_ID.get(id)!;
                const price = game.market.price(id);
                const value = price * h.qty;
                const pnl = (price - h.avgPrice) * h.qty;
                const dividend = nextDividend(
                    h,
                    account.dividendTick ?? game.market.tick,
                    game.market.tick,
                    game.dividendOf(id).dps,
                    price,
                );
                return (
                    <li key={id}>
                        <a
                            href={stockHref(id)}
                            className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2"
                        >
                            <StockAvatar stock={stock} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-medium">{stock.name}</span>
                                <span className="text-xs text-faint tabular-nums">
                                    {num(h.qty)}주 · 평균 {num(h.avgPrice)}원
                                    <span className="block text-primary">
                                        배당 {won(dividend.expected)} ·{' '}
                                        <span className="whitespace-nowrap">
                                            {duration(dividend.ticksLeft * TICK_MS)} 후
                                        </span>
                                    </span>
                                </span>
                            </span>
                            <span className="text-right tabular-nums">
                                <span className="block text-[15px] font-semibold">{won(value)}</span>
                                <span className={`text-xs ${changeClass(pnl)}`}>
                                    {signedWon(pnl)} ({signedPercent(price / h.avgPrice - 1)})
                                </span>
                            </span>
                        </a>
                    </li>
                );
            })}
        </ul>
    );
}

function Orders() {
    const { account } = useGame();
    if (account.orders.length === 0) return <Empty>걸어 둔 주문이 없어요</Empty>;

    return (
        <ul className="divide-y divide-line">
            {account.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <a href={stockHref(o.stockId)} className="min-w-0 hover:underline">
                        <span className={o.side === 'buy' ? 'text-up' : 'text-down'}>
                            {o.side === 'buy' ? '구매' : '판매'}
                        </span>{' '}
                        {STOCK_BY_ID.get(o.stockId)?.name}
                        <span className="block text-xs text-faint tabular-nums">
                            {num(o.limitPrice)}원 · {num(o.qty)}주
                        </span>
                    </a>
                    <button
                        type="button"
                        onClick={() => game.cancelOrder(o.id)}
                        className="shrink-0 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-3"
                    >
                        취소
                    </button>
                </li>
            ))}
        </ul>
    );
}

/** 거래와 배당을 시간순으로 섞어 보여준다. */
function Trades() {
    const { account } = useGame();
    const rows = [
        ...account.trades.map((trade) => ({ time: trade.time, trade, payout: null })),
        ...account.dividends.map((payout) => ({ time: payout.time, trade: null, payout })),
    ]
        .toSorted((a, b) => b.time - a.time)
        .slice(0, 50);
    if (rows.length === 0) return <Empty>아직 거래한 적이 없어요</Empty>;

    return (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {rows.map(({ trade, payout }) =>
                trade ? <TradeRow key={trade.id} trade={trade} /> : <DividendRow key={payout.id} payout={payout} />,
            )}
        </ul>
    );
}

export function MyStocks() {
    const { account } = useGame();
    const [tab, setTab] = useState<TabId>('holdings');
    const counts: Record<TabId, number> = {
        holdings: Object.keys(account.holdings).length,
        orders: account.orders.length,
        trades: 0,
    };

    return (
        <Panel title="내 주식">
            <div role="tablist" aria-label="내 주식" className="mb-2 flex gap-1 rounded-xl bg-surface-2 p-1">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className="flex-1 rounded-lg py-1.5 text-sm font-medium text-faint aria-selected:bg-surface aria-selected:text-fg aria-selected:shadow-sm"
                    >
                        {t.label}
                        {counts[t.id] > 0 && <span className="ml-1 text-primary">{counts[t.id]}</span>}
                    </button>
                ))}
            </div>
            <div role="tabpanel">
                {tab === 'holdings' && <Holdings />}
                {tab === 'orders' && <Orders />}
                {tab === 'trades' && <Trades />}
            </div>
        </Panel>
    );
}
