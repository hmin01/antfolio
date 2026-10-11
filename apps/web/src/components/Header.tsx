import { useEffect, useState } from 'react';

import { TICK_MS, tickStartTime } from '@gaemigul/queen';

import { changeClass, signedPercent, won } from '../format.ts';
import { START_CASH, totalValue } from '../game/account.ts';
import { game, useGame } from '../game/store.ts';
import { HOME_HREF, useRoute } from '../router.ts';

function Countdown({ tick }: { tick: number }) {
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(id);
    }, []);

    const remaining = Math.max(0, tickStartTime(tick + 1, game.epoch) - now);
    const progress = 1 - remaining / TICK_MS;

    return (
        <div
            className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-muted"
            aria-live="off"
        >
            <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-up" />
            </span>
            <span className="hidden sm:inline">다음 움직임</span>
            <span className="w-7 text-right font-semibold whitespace-nowrap text-fg tabular-nums">
                {Math.ceil(remaining / 1000)}초
            </span>
            <span className="h-1 w-12 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full bg-primary" style={{ width: `${progress * 100}%` }} />
            </span>
        </div>
    );
}

function confirmReset() {
    if (window.confirm('계좌와 시장을 모두 처음부터 다시 시작할까요? 되돌릴 수 없어요.')) game.reset();
}

export function Header() {
    const { tick, account } = useGame();
    const route = useRoute();
    const value = totalValue(account, (id) => game.market.price(id));
    const profit = value / START_CASH - 1;
    const upcoming = game.upcomingVersion;

    return (
        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4">
                <a href={HOME_HREF} className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
                    <span aria-hidden>🐜</span>개미굴
                </a>
                <nav aria-label="메뉴" className="text-[15px]">
                    <a
                        href={HOME_HREF}
                        aria-current={route.page === 'home' ? 'page' : undefined}
                        className="font-semibold text-muted hover:text-fg aria-[current=page]:text-fg"
                    >
                        홈
                    </a>
                </nav>
                <div className="ml-auto flex items-center gap-3">
                    {upcoming && (
                        <span className="hidden text-xs text-warn md:inline">
                            곧 새 시장 설정({upcoming.versionId})이 적용돼요
                        </span>
                    )}
                    <a href={HOME_HREF} className="hidden text-right leading-tight sm:block">
                        <span className="block text-[11px] text-faint">총자산</span>
                        <span className="text-sm font-semibold tabular-nums">
                            {won(value)}{' '}
                            <span className={`text-xs ${changeClass(profit)}`}>{signedPercent(profit)}</span>
                        </span>
                    </a>
                    <Countdown tick={tick} />
                    <button
                        type="button"
                        onClick={confirmReset}
                        className="rounded-lg px-2 py-1.5 text-xs text-faint hover:bg-surface-2 hover:text-muted"
                    >
                        처음부터
                    </button>
                </div>
            </div>
        </header>
    );
}
