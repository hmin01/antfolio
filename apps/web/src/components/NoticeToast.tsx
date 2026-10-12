import { useEffect } from 'react';

import { game, useGame } from '../game/store.ts';

const SHOW_MS = 4000;

/** 배당 입금·배당 변경 시 화면 아래쪽에 잠깐 띄우는 알림 */
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
