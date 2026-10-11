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
    /**
     * 급등락. perDay는 하루 평균 횟수, size는 한 번의 크기(로그 수익률 표준편차).
     * volKick은 급등락이 변동성 뭉침에 들어가는 비율(0~1, 없으면 1). 1이면 급등락 직후 한동안 크게 출렁인다
     */
    jumps: { perDay: number; size: number; volKick?: number };
    /** 적정가치에서 벌어진 거리가 절반으로 줄어드는 데 걸리는 일수 */
    reversionHalfLifeDays: number;
    /**
     * 국면마다 추세 세기가 달라지는 정도(로그정규 분포의 표준편차). 없으면 국면마다 같은 세기.
     * 0.6이면 어떤 상승은 완만하고 어떤 상승은 가파르게 나온다
     */
    trendSpread?: number;
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
 * 바꾸고 싶으면 새 버전을 만들어 맨 뒤에 붙인다.
 */
export const PARAM_VERSIONS: readonly ParamVersion[] = [
    {
        // 실제 주식의 하루 흐름(하루 변동 약 3%, 8시간 남짓 이어지는 추세, 하루 한 번꼴 급등락)을
        // 게임 1시간에 담았다. 실제 이틀치 등락이 게임 2시간에 지나간다.
        id: 'v1',
        params: {
            dailyVol: 0.147,
            regimes: {
                bull: { driftPerDay: 2.4, volScale: 0.9, meanHours: 0.33 },
                bear: { driftPerDay: -2.88, volScale: 1.3, meanHours: 0.21 },
                sideways: { driftPerDay: 0, volScale: 0.7, meanHours: 0.42 },
            },
            clustering: { alpha: 0.02, beta: 0.9767 },
            tailDf: 5,
            jumps: { perDay: 24, size: 0.03 },
            reversionHalfLifeDays: 0.42,
        },
    },
    {
        id: 'v2',
        params: {
            dailyVol: 0.294,
            regimes: {
                bull: {
                    driftPerDay: 9.6,
                    volScale: 0.9,
                    meanHours: 0.0825,
                },
                bear: {
                    driftPerDay: -11.52,
                    volScale: 1.3,
                    meanHours: 0.0525,
                },
                sideways: {
                    driftPerDay: 0,
                    volScale: 0.7,
                    meanHours: 0.105,
                },
            },
            clustering: {
                alpha: 0.02,
                beta: 0.9767,
            },
            tailDf: 5,
            jumps: {
                perDay: 96,
                size: 0.03,
            },
            reversionHalfLifeDays: 0.105,
        },
    },
    {
        // 토스증권 코스닥 8종목 1분봉(2026-09-21~10-08 정규장)에 맞춘 설정. 게임 1분 = 실제 1분.
        // 추세는 평균 25분, 급등락은 하루 2번꼴이고 급등락 뒤에 변동성이 덩달아 커지지 않는다.
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
        // v3에서 추세만 4배 빠르게 하고 흔들림은 1.5배만 키웠다. 1분 흔들림은 v3와 비슷한데
        // 상승·하락이 평균 5~6분마다 바뀌어 화면이 빨리 움직인다. 추세마다 세기가 달라 완만한 오름과 가파른 오름이 섞인다.
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

/** 지금 게임에 적용되는 설정 */
export const DEFAULT_PARAMS: EngineParams = LATEST_VERSION.params;
