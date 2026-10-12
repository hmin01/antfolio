import { TICKS_PER_DAY, tickStartTime } from '@antfolio/queen';

import { changeClass, signedPercent, signedWon, won } from '../format.ts';
import { availableCash, START_CASH, totalValue } from '../game/account.ts';
import { game, useGame } from '../game/store.ts';
import { Panel } from './Panel.tsx';

export function AssetSummary() {
    const { account, tick } = useGame();
    const value = totalValue(account, (id) => game.market.price(id));
    const stockValue = value - account.cash;
    const profit = value - START_CASH;
    const dayAgo = tickStartTime(tick - TICKS_PER_DAY, game.epoch);
    const recentDividends = account.dividends.filter((d) => d.time >= dayAgo).reduce((sum, d) => sum + d.amount, 0);

    return (
        <Panel>
            <p className="text-sm text-muted">내 총자산</p>
            <p className="mt-1 text-[28px] leading-tight font-bold tabular-nums">{won(value)}</p>
            <p className={`mt-1 text-sm font-medium tabular-nums ${changeClass(profit)}`}>
                {signedWon(profit)} ({signedPercent(value / START_CASH - 1)})
                <span className="ml-1 font-normal text-faint">시작 금액 대비</span>
            </p>
            {recentDividends > 0 && (
                <p className="mt-0.5 text-sm text-muted tabular-nums">
                    최근 24시간 배당 <span className="font-semibold text-up">+{won(recentDividends)}</span>
                </p>
            )}

            <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center">
                {[
                    { label: '주식', amount: stockValue },
                    { label: '현금', amount: account.cash },
                    { label: '주문 가능', amount: availableCash(account) },
                ].map(({ label, amount }) => (
                    <div key={label}>
                        <dt className="text-xs text-faint">{label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">{won(amount)}</dd>
                    </div>
                ))}
            </dl>
        </Panel>
    );
}
