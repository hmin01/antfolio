import { useEffect, useRef } from 'react';

import { TICK_MS } from '@antfolio/queen';

import { changeClass, duration, signedPercent, signedWon, won } from '../format.ts';
import { game, useGame } from '../game/store.ts';
import { TradeRow } from './TradeRow.tsx';

/** 자리를 비웠다 돌아오면 그동안 시장과 계좌에 무슨 일이 있었는지 보여준다. */
export function AwaySummary() {
    const { away } = useGame();
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current!;
        if (away && !dialog.open) dialog.showModal();
        if (!away && dialog.open) dialog.close();
    }, [away]);

    const diff = away ? away.afterValue - away.beforeValue : 0;

    return (
        <dialog
            ref={dialogRef}
            onClose={game.dismissAway}
            className="m-auto w-[min(92vw,420px)] rounded-2xl bg-surface p-0 text-fg shadow-xl backdrop:bg-black/50"
        >
            {away && (
                <div className="space-y-4 p-6">
                    <div>
                        <h2 className="text-lg font-bold">자리 비운 동안</h2>
                        <p className="text-sm text-muted">
                            {duration((away.toTick - away.fromTick) * TICK_MS)} 동안 시장이 움직였어요
                        </p>
                    </div>

                    <div className="rounded-xl bg-surface-2 p-4">
                        <div className="text-xs text-faint">총자산</div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{won(away.afterValue)}</div>
                        <div className={`text-sm font-medium tabular-nums ${changeClass(diff)}`}>
                            {signedWon(diff)} ({signedPercent(away.afterValue / away.beforeValue - 1)})
                        </div>
                        {away.dividends > 0 && (
                            <div className="mt-2 border-t border-line pt-2 text-sm text-muted">
                                그동안 받은 배당{' '}
                                <span className="font-semibold text-up tabular-nums">+{won(away.dividends)}</span>
                            </div>
                        )}
                    </div>

                    {away.trades.length > 0 ? (
                        <div>
                            <h3 className="text-sm font-semibold">체결된 주문 {away.trades.length}건</h3>
                            <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                                {away.trades.map((t) => (
                                    <TradeRow key={t.id} trade={t} />
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-sm text-faint">그동안 체결된 주문은 없어요</p>
                    )}

                    <form method="dialog">
                        <button
                            type="submit"
                            className="h-12 w-full rounded-xl bg-primary font-bold text-white hover:bg-primary-hover"
                        >
                            확인
                        </button>
                    </form>
                </div>
            )}
        </dialog>
    );
}
