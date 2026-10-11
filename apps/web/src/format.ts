export const UP_COLOR = '#ef4444';
export const DOWN_COLOR = '#3b82f6';

export const num = (value: number) => Math.round(value).toLocaleString('ko-KR');

export const won = (value: number) => `${num(value)}원`;

export const signedWon = (value: number) => `${value > 0 ? '+' : ''}${won(value)}`;

export const signedPercent = (ratio: number, digits = 2) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(digits)}%`;

/** 국내 관례대로 오르면 빨강, 내리면 파랑, 그대로면 기본 글자색 */
export const changeClass = (value: number) =>
    value > 0 ? 'text-red-400' : value < 0 ? 'text-blue-400' : 'text-zinc-300';

export function duration(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return [days && `${days}일`, hours && `${hours}시간`, (mins || (!days && !hours)) && `${mins}분`]
        .filter(Boolean)
        .join(' ');
}

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

export const dateTime = (ms: number) => timeFormat.format(new Date(ms));
