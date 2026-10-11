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
    // @queen-versions-end 새 버전은 이 줄 위에 추가한다. 여왕의 방 "게임에 적용"도 이 줄을 기준으로 끼워 넣는다.
];

export const LATEST_VERSION = PARAM_VERSIONS[PARAM_VERSIONS.length - 1]!;

/** 지금 게임에 적용되는 설정 */
export const DEFAULT_PARAMS: EngineParams = LATEST_VERSION.params;

/**
 * 같은 흐름을 `speed`배 빠르게 돌린다. 차트 모양은 그대로 두고 시간축만 압축하는 것이라
 * 추세와 노이즈의 비율이 유지된다.
 * - 시간 단위 값(국면 길이, 평균회귀 반감기)은 1/speed
 * - 하루당 값(추세, 급등락 횟수)은 speed배, 변동성은 √speed배
 * - 변동성 뭉침은 틱 단위 값이라 그대로 둔다. 압축하면 거의 바로 사라진다.
 */
export function compressTime(params: EngineParams, speed: number): EngineParams {
    const regimes = Object.fromEntries(
        REGIMES.map((r) => {
            const { driftPerDay, volScale, meanHours } = params.regimes[r];
            return [r, { driftPerDay: driftPerDay * speed, volScale, meanHours: meanHours / speed }];
        }),
    ) as EngineParams['regimes'];

    return {
        ...params,
        dailyVol: params.dailyVol * Math.sqrt(speed),
        regimes,
        jumps: { ...params.jumps, perDay: params.jumps.perDay * speed },
        reversionHalfLifeDays: params.reversionHalfLifeDays / speed,
    };
}
