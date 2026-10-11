import { TICK_MS } from '@gaemigul/queen';
import { useEffect, useRef } from 'react';
import { game, useGame } from '../game/store.ts';
import { changeClass, duration, signedPercent, signedWon, won } from '../format.ts';
import { TradeRow } from './AccountTabs.tsx';

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
      className="m-auto w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/60"
    >
      {away && (
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">자리 비운 동안</h2>
            <p className="text-sm text-zinc-400">
              {duration((away.toTick - away.fromTick) * TICK_MS)} 동안 시장이 움직였어요
            </p>
          </div>

          <div className="rounded-lg bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">총자산</div>
            <div className="mt-1 font-mono text-xl tabular-nums">{won(away.afterValue)}</div>
            <div className={`font-mono text-sm tabular-nums ${changeClass(diff)}`}>
              {signedWon(diff)} ({signedPercent(away.afterValue / away.beforeValue - 1)})
            </div>
          </div>

          {away.trades.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">체결된 주문 {away.trades.length}건</h3>
              <ul className="max-h-48 divide-y divide-zinc-800 overflow-y-auto">
                {away.trades.map((t) => (
                  <TradeRow key={t.id} trade={t} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">그동안 체결된 주문은 없어요</p>
          )}

          <form method="dialog">
            <button type="submit" className="w-full rounded-md bg-zinc-100 py-2.5 font-semibold text-zinc-900 hover:bg-white">
              확인
            </button>
          </form>
        </div>
      )}
    </dialog>
  );
}
