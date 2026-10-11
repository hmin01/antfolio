import { TICKS_PER_DAY } from '@gaemigul/queen';
import { STOCKS } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';
import { changeClass, num, signedPercent } from '../format.ts';

interface StockListProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function StockList({ selectedId, onSelect }: StockListProps) {
  const { tick, account } = useGame();

  return (
    <nav aria-label="종목">
      <h2 className="px-2 pb-2 text-xs font-semibold text-zinc-400">종목 · 24시간 대비</h2>
      <ul className="grid grid-cols-2 gap-1 lg:grid-cols-1">
        {STOCKS.map((stock) => {
          const price = game.market.price(stock.id);
          const change = price / game.market.price(stock.id, tick - TICKS_PER_DAY) - 1;
          const held = account.holdings[stock.id];
          const selected = stock.id === selectedId;
          return (
            <li key={stock.id}>
              <button
                type="button"
                aria-current={selected}
                aria-label={`${stock.name} ${num(price)}원 ${signedPercent(change)}${held ? ' 보유 중' : ''}`}
                onClick={() => onSelect(stock.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left ${selected ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {stock.name}
                    {held && <span className="ml-1.5 text-xs text-amber-400">보유</span>}
                  </span>
                  <span className="text-xs text-zinc-500">{stock.sector}</span>
                </span>
                <span className="text-right font-mono text-sm tabular-nums">
                  <span className="block">{num(price)}</span>
                  <span className={`text-xs ${changeClass(change)}`}>{signedPercent(change)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
