import { changeClass, dateTime, num, signedWon } from '../format.ts';
import type { Trade } from '../game/account.ts';
import { STOCK_BY_ID } from '../game/stocks.ts';

const SIDE_LABEL = { buy: '구매', sell: '판매' } as const;

export function TradeRow({ trade }: { trade: Trade }) {
    const stock = STOCK_BY_ID.get(trade.stockId);

    return (
        <li className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0">
                <p className="truncate font-medium">
                    <span className={trade.side === 'buy' ? 'text-up' : 'text-down'}>{SIDE_LABEL[trade.side]}</span>{' '}
                    {stock?.name ?? trade.stockId}
                </p>
                <p className="text-xs text-faint">
                    {trade.kind === 'limit' ? '지정가' : '시장가'} · {dateTime(trade.time)}
                </p>
            </div>
            <div className="shrink-0 text-right tabular-nums">
                <p>
                    {num(trade.price)}원 · {num(trade.qty)}주
                </p>
                {trade.realizedPnl !== null && (
                    <p className={`text-xs ${changeClass(trade.realizedPnl)}`}>수익 {signedWon(trade.realizedPnl)}</p>
                )}
            </div>
        </li>
    );
}
