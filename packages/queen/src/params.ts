export const REGIMES = ['bull', 'bear', 'sideways'] as const;
export type Regime = (typeof REGIMES)[number];

export interface RegimeParams {
    /** 이 국면의 하루 기대 로그 수익률(0.1 = 하루 약 +10%) */
    driftPerDay: number;
    /** 기본 변동성 배율 */
    volScale: number;
    /** 이 국면의 평균 지속 시간 */
    meanHours: number;
}

export interface EngineParams {
    /** 평상시 하루 변동성(0.04 = 4%) */
    dailyVol: number;
    regimes: Record<Regime, RegimeParams>;
    /** 변동성 뭉침(GARCH). alpha: 직전 충격 반영 정도, beta: 변동성 지속성, alpha + beta < 1 */
    clustering: { alpha: number; beta: number };
    /** Student-t 자유도. 작을수록 큰 움직임이 잦고, 30 이상이면 정규분포에 근접 */
    tailDf: number;
    /** 급등락. perDay: 하루 평균 횟수, size: 1회 크기(로그 수익률 표준편차), volKick: 변동성 뭉침 반영 비율(0~1, 기본 1) */
    jumps: { perDay: number; size: number; volKick?: number };
    /** 적정가치와의 거리가 절반으로 줄어드는 일수 */
    reversionHalfLifeDays: number;
    /** 국면별 추세 세기 편차(로그정규 표준편차). 없으면 모든 국면 같은 세기 */
    trendSpread?: number;
}

export interface ParamVersion {
    id: string;
    params: EngineParams;
}

/**
 * 게임에 내보낸 엔진 설정 기록. 맨 뒤 버전이 현재 설정
 * 처음 보는 버전은 1분 뒤 틱부터 적용하고 그 전 가격은 예전 버전으로 재계산
 * 추가한 버전은 수정·삭제 금지, 변경은 새 버전으로 맨 뒤에 추가
 */
export const PARAM_VERSIONS: readonly ParamVersion[] = [
    {
        // 토스증권 코스닥 8종목 1분봉(2026-09-21~10-08 정규장) 기준. 게임 1분 = 실제 1분
        // 추세 평균 25분, 급등락 하루 약 2회, 급등락 뒤 변동성 확대 없음
        id: 'v3',
        params: {
            dailyVol: 0.055,
            regimes: {
                bull: { driftPerDay: 0.35, volScale: 0.9, meanHours: 0.42 },
                bear: { driftPerDay: -0.42, volScale: 1.2, meanHours: 0.34 },
                sideways: { driftPerDay: 0, volScale: 0.8, meanHours: 0.42 },
            },
            clustering: { alpha: 0.01, beta: 0.985 },
            tailDf: 7,
            jumps: { perDay: 2, size: 0.012, volKick: 0 },
            reversionHalfLifeDays: 2,
        },
    },
    {
        // v3 대비 추세 4배, 흔들림 1.5배. 상승·하락이 평균 5~6분마다 바뀌는 빠른 화면
        // 추세마다 세기가 달라 완만한 오름과 가파른 오름이 섞임
        id: 'v4',
        params: {
            dailyVol: 0.0674,
            regimes: {
                bull: { driftPerDay: 1.4, volScale: 0.9, meanHours: 0.105 },
                bear: { driftPerDay: -1.68, volScale: 1.2, meanHours: 0.085 },
                sideways: { driftPerDay: 0, volScale: 0.8, meanHours: 0.105 },
            },
            clustering: { alpha: 0.01, beta: 0.985 },
            tailDf: 7,
            jumps: { perDay: 3, size: 0.012, volKick: 0 },
            reversionHalfLifeDays: 0.5,
            trendSpread: 0.6,
        },
    },
];

export const LATEST_VERSION = PARAM_VERSIONS[PARAM_VERSIONS.length - 1]!;

export const DEFAULT_PARAMS: EngineParams = LATEST_VERSION.params;
