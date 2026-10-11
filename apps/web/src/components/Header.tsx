import { TICK_MS, tickStartTime } from '@gaemigul/queen';
import { useEffect, useState } from 'react';
import { START_CASH, totalValue } from '../game/account.ts';
import { game, useGame } from '../game/store.ts';
import { changeClass, signedPercent, won } from '../format.ts';

function Countdown({ tick }: { tick: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, tickStartTime(tick + 1, game.epoch) - now);
  const progress = 1 - remaining / TICK_MS;

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400" aria-live="off">
      <span className="hidden sm:inline">다음 움직임까지</span>
      <span className="w-6 text-right font-mono text-zinc-200 tabular-nums">{Math.ceil(remaining / 1000)}초</span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
        <span className="block h-full bg-zinc-400" style={{ width: `${progress * 100}%` }} />
      </span>
    </div>
  );
}

function confirmReset() {
  if (window.confirm('계좌와 시장을 모두 처음부터 다시 시작할까요? 되돌릴 수 없어요.')) game.reset();
}

export function Header() {
  const { tick, account } = useGame();
  const value = totalValue(account, (id) => game.market.price(id));
  const profit = value / START_CASH - 1;

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <h1 className="text-lg font-bold">🐜 개미굴</h1>
        <dl className="flex gap-5 text-sm">
          <div>
            <dt className="text-xs text-zinc-400">총자산</dt>
            <dd className="font-mono tabular-nums">{won(value)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">수익률</dt>
            <dd className={`font-mono tabular-nums ${changeClass(profit)}`}>{signedPercent(profit)}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs text-zinc-400">현금</dt>
            <dd className="font-mono tabular-nums">{won(account.cash)}</dd>
          </div>
        </dl>
        <div className="ml-auto flex items-center gap-4">
          <Countdown tick={tick} />
          <button type="button" onClick={confirmReset} className="text-xs text-zinc-500 hover:text-zinc-300">
            처음부터
          </button>
        </div>
      </div>
    </header>
  );
}
