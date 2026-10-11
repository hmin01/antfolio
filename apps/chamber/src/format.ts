export const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export const signedPercent = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${percent(value, digits)}`;

export const won = (value: number) => Math.round(value).toLocaleString('ko-KR');
