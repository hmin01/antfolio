import { useState } from 'react';

import { changeClass, dateTime, num, signedPercent, signedWon, won } from '../format.ts';
import { availableCash, type Trade } from '../game/account.ts';
import { STOCK_BY_ID } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';

const TABS = [
    { id: 'holdings', label: '보유 종목' },
    { id: 'orders', label: '미체결' },
    { id: 'trades', label: '거래 내역' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const nameOf = (stockId: string) => STOCK_BY_ID.get(stockId)?.name ?? stockId;

function Empty({ children }: { children: string }) {
    return <p className="py-8 text-center text-sm text-zinc-500">{children}</p>;
}

function Holdings({ onSelect }: { onSelect: (id: string) => void }) {
    const { account } = useGame();
    const rows = Object.entries(account.holdings);
    if (rows.length === 0) return <Empty>아직 가진 주식이 없어요</Empty>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
                <thead className="text-xs text-zinc-400">
                    <tr className="text-right">
                        <th className="py-2 text-left font-normal">종목</th>
                        <th className="font-normal">수량</th>
                        <th className="font-normal">평단가</th>
                        <th className="font-normal">현재가</th>
                        <th className="font-normal">평가금액</th>
                        <th className="font-normal">평가손익</th>
                    </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                    {rows.map(([id, h]) => {
                        const price = game.market.price(id);
                        const pnl = (price - h.avgPrice) * h.qty;
                        return (
                            <tr key={id} className="border-t border-zinc-800 text-right">
                                <td className="py-2 text-left font-sans">
                                    <button type="button" onClick={() => onSelect(id)} className="hover:underline">
                                        {nameOf(id)}
                                    </button>
                                </td>
                                <td>{num(h.qty)}</td>
                                <td>{num(h.avgPrice)}</td>
                                <td>{num(price)}</td>
                                <td>{num(price * h.qty)}</td>
                                <td className={changeClass(pnl)}>
                                    {signedWon(pnl)}
                                    <span className="block text-xs">{signedPercent(price / h.avgPrice - 1)}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Orders() {
    const { account } = useGame();
    if (account.orders.length === 0) return <Empty>걸어 둔 주문이 없어요</Empty>;

    return (
        <ul className="divide-y divide-zinc-800 text-sm">
            {account.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                        <span className={o.side === 'buy' ? 'text-red-400' : 'text-blue-400'}>
                            {o.side === 'buy' ? '매수' : '매도'}
                        </span>{' '}
                        {nameOf(o.stockId)}
                        <span className="ml-2 font-mono text-zinc-400">
                            {num(o.limitPrice)}원 × {num(o.qty)}주
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => game.cancelOrder(o.id)}
                        className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                        취소
                    </button>
                </li>
            ))}
        </ul>
    );
}

export function TradeRow({ trade }: { trade: Trade }) {
    return (
        <li className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
                <span className={trade.side === 'buy' ? 'text-red-400' : 'text-blue-400'}>
                    {trade.side === 'buy' ? '매수' : '매도'}
                </span>{' '}
                {nameOf(trade.stockId)}
                <span className="ml-2 font-mono text-zinc-400">
                    {num(trade.price)}원 × {num(trade.qty)}주
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                    {trade.kind === 'limit' ? '지정가' : '시장가'} · {dateTime(trade.time)}
                </span>
            </span>
            {trade.realizedPnl !== null && (
                <span className={`shrink-0 font-mono whitespace-nowrap ${changeClass(trade.realizedPnl)}`}>
                    {signedWon(trade.realizedPnl)}
                </span>
            )}
        </li>
    );
}

function Trades() {
    const { account } = useGame();
    if (account.trades.length === 0) return <Empty>아직 거래한 적이 없어요</Empty>;

    return (
        <ul className="divide-y divide-zinc-800">
            {account.trades.slice(0, 50).map((t) => (
                <TradeRow key={t.id} trade={t} />
            ))}
        </ul>
    );
}

export function AccountTabs({ onSelect }: { onSelect: (id: string) => void }) {
    const { account } = useGame();
    const [tab, setTab] = useState<TabId>('holdings');

    return (
        <section aria-label="내 계좌" className="rounded-lg border border-zinc-800">
            <div role="tablist" className="flex border-b border-zinc-800 px-2">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${tab === t.id ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                    >
                        {t.label}
                        {t.id === 'orders' && account.orders.length > 0 && (
                            <span className="ml-1 text-xs text-zinc-500">{account.orders.length}</span>
                        )}
                    </button>
                ))}
                <span className="ml-auto self-center text-xs text-zinc-500">
                    주문 가능 {won(availableCash(account))}
                </span>
            </div>
            <div role="tabpanel" className="px-4 pb-2">
                {tab === 'holdings' && <Holdings onSelect={onSelect} />}
                {tab === 'orders' && <Orders />}
                {tab === 'trades' && <Trades />}
            </div>
        </section>
    );
}
