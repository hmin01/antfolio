export const num = (value: number) => Math.round(value).toLocaleString('ko-KR');

export const won = (value: number) => `${num(value)}원`;

export const signedWon = (value: number) => `${value > 0 ? '+' : ''}${won(value)}`;

/** 시가총액처럼 큰 금액. 1조 이상은 "30.5조원", 그 아래는 "3,000억원" */
export function bigWon(value: number): string {
    if (value >= 1e12) return `${Number((value / 1e12).toFixed(value >= 1e14 ? 0 : 1)).toLocaleString('ko-KR')}조원`;
    return `${Math.round(value / 1e8).toLocaleString('ko-KR')}억원`;
}

/** 지분율처럼 아주 작을 수 있는 비율. 0.0001% 아래는 "0.0001% 미만" */
export function sharePercent(ratio: number): string {
    if (ratio > 0 && ratio < 1e-6) return '0.0001% 미만';
    const digits = ratio >= 0.01 ? 2 : 4;
    return `${Number((ratio * 100).toFixed(digits))}%`;
}

/** 배당률처럼 부호 없이 쓰는 비율. 6% → "6%", 0.5% → "0.5%" */
export const percent = (ratio: number) => `${Number((ratio * 100).toFixed(2))}%`;

export const signedPercent = (ratio: number, digits = 2) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(digits)}%`;

/** 국내 관례대로 오르면 빨강, 내리면 파랑, 그대로면 기본 글자색 */
export const changeClass = (value: number) => (value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-fg');

/** 등락 금액과 비율을 "+1,200원 (2.40%)"처럼 붙여 쓴다. 비율의 부호는 금액에 이미 있어 뺀다 */
export const changeText = (amount: number, ratio: number) =>
    `${signedWon(amount)} (${(Math.abs(ratio) * 100).toFixed(2)}%)`;

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
