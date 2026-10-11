export const REGIMES = ['bull', 'bear', 'sideways'] as const;
export type Regime = (typeof REGIMES)[number];

export interface RegimeParams {
  /** 이 국면에서 하루 동안 기대되는 로그 수익률 (0.1 = 하루 약 +10%) */
  driftPerDay: number;
  /** 기본 변동성에 곱하는 배율 */
  volScale: number;
  /** 이 국면이 평균적으로 이어지는 시간 */
  meanHours: number;
}

export interface EngineParams {
  /** 아무 일 없을 때의 하루 변동성 (0.04 = 4%) */
  dailyVol: number;
  regimes: Record<Regime, RegimeParams>;
  /** 변동성 뭉침(GARCH). alpha는 직전 충격의 반영 정도, beta는 변동성의 지속성. alpha + beta < 1 */
  clustering: { alpha: number; beta: number };
  /** Student-t 자유도. 작을수록 꼬리가 두꺼워 큰 움직임이 잦다. 30 이상이면 정규분포에 가깝다 */
  tailDf: number;
  /** 급등락. perDay는 하루 평균 횟수, size는 한 번의 크기(로그 수익률 표준편차) */
  jumps: { perDay: number; size: number };
  /** 적정가치에서 벌어진 거리가 절반으로 줄어드는 데 걸리는 일수 */
  reversionHalfLifeDays: number;
}

export interface ParamVersion {
  id: string;
  params: EngineParams;
}

/**
 * 게임에 내보낸 엔진 설정의 기록. 맨 뒤 버전이 지금 설정이다.
 *
 * 게임은 처음 보는 버전을 발견하면 그때부터 1분 뒤 틱부터 적용하고,
 * 그 전의 가격은 예전 버전으로 다시 계산한다. 그래서 한 번 추가한 버전은 지우거나 고치지 말고,
 * 바꾸고 싶으면 여왕의 방에서 "설정 복사"로 새 버전을 만들어 맨 뒤에 붙인다.
 */
export const PARAM_VERSIONS: readonly ParamVersion[] = [
  {
    id: 'v1',
    params: {
      dailyVol: 0.03,
      regimes: {
        bull: { driftPerDay: 0.1, volScale: 0.9, meanHours: 8 },
        bear: { driftPerDay: -0.12, volScale: 1.3, meanHours: 5 },
        sideways: { driftPerDay: 0, volScale: 0.7, meanHours: 10 },
      },
      clustering: { alpha: 0.03, beta: 0.965 },
      tailDf: 5,
      jumps: { perDay: 1, size: 0.03 },
      reversionHalfLifeDays: 10,
    },
  },
];

export const LATEST_VERSION = PARAM_VERSIONS[PARAM_VERSIONS.length - 1]!;

/** 지금 게임에 적용되는 설정 */
export const DEFAULT_PARAMS: EngineParams = LATEST_VERSION.params;
