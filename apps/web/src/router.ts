import { useSyncExternalStore } from 'react';

import { STOCK_BY_ID } from './game/stocks.ts';

export type Route = { page: 'home' } | { page: 'stock'; stockId: string };

/** 정적 호스팅과 PWA에서도 새로고침이 깨지지 않도록 해시로 페이지를 나눈다. */
export const stockHref = (stockId: string) => `#/stocks/${stockId}`;
export const HOME_HREF = '#/';

function parse(hash: string): Route {
    const match = /^#\/stocks\/([\w-]+)$/.exec(hash);
    if (match && STOCK_BY_ID.has(match[1]!)) return { page: 'stock', stockId: match[1]! };
    return { page: 'home' };
}

const subscribe = (listener: () => void) => {
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
};

export function useRoute(): Route {
    const hash = useSyncExternalStore(subscribe, () => location.hash);
    return parse(hash);
}
