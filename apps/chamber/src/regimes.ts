import type { Regime } from '@gaemigul/queen';

export const REGIME_LABELS: Record<Regime, string> = {
  bull: '상승장',
  bear: '하락장',
  sideways: '횡보장',
};

/** 국내 관례대로 상승은 빨강, 하락은 파랑. 횡보는 중립 회색. */
export const REGIME_COLORS: Record<Regime, string> = {
  bull: '#ef4444',
  bear: '#3b82f6',
  sideways: '#71717a',
};

export const UP_COLOR = REGIME_COLORS.bull;
export const DOWN_COLOR = REGIME_COLORS.bear;
