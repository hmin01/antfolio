export const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export const signedPercent = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${percent(value, digits)}`;

export const won = (value: number) => Math.round(value).toLocaleString('ko-KR');

/** 1시간 미만은 분으로 보여준다. */
export function formatHours(hours: number): string {
    return hours >= 1 ? `${Number(hours.toFixed(1))}시간` : `${Number((hours * 60).toFixed(1))}분`;
}

/** 1일 미만은 시간·분으로 보여준다. */
export function formatDays(days: number): string {
    return days >= 1 ? `${Number(days.toFixed(2))}일` : formatHours(days * 24);
}
