import { useEffect } from 'react';

import { game, useGame } from '../game/store.ts';

const SHOW_MS = 4000;

/** 화면을 보는 동안 배당이 들어오거나 보유 종목의 배당이 바뀌면 아래쪽에 잠깐 띄운다. */
export function NoticeToast() {
    const { notice } = useGame();

    useEffect(() => {
        if (!notice) return;
        const id = window.setTimeout(game.dismissNotice, SHOW_MS);
        return () => window.clearTimeout(id);
    }, [notice]);

    if (!notice) return null;

    return (
        <output className="fixed inset-x-0 bottom-6 z-30 mx-auto w-fit max-w-[92vw] rounded-full bg-fg px-5 py-3 text-sm font-medium text-surface shadow-lg">
            {notice.text}
        </output>
    );
}
