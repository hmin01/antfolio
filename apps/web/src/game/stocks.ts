import { REGIMES, type EngineParams } from '@antfolio/queen';

export interface StockDef {
    id: string;
    name: string;
    sector: string;
    /** 종목 아이콘 배경색 */
    color: string;
    /** 기본 배당률(3시간). 첫 주당 배당금 = 처음 가격 × 이 값. 이후 배당 공시로 주당 배당금이 바뀐다 */
    dividendRate: number;
    initialPrice: number;
    /** 발행 주식 수. 시가총액 = 발행 주식 수 × 주가 */
    shares: number;
    /** 시장에서 거래되는 유통 주식 수. 한 사람이 가질 수 있는 최대 수량이다 */
    floatShares: number;
    personality: Personality;
}

interface Personality {
    /** 기본 변동성 배율 */
    vol?: number;
    /** 국면별 추세 배율 */
    trend?: number;
    /** 급등락 빈도 배율 */
    jumps?: number;
    tailDf?: number;
}

/** 엔진 설정 버전에 종목 성격을 입힌다. */
export function stockParams(base: EngineParams, { vol = 1, trend = 1, jumps = 1, tailDf }: Personality): EngineParams {
    const regimes = Object.fromEntries(
        REGIMES.map((r) => [r, { ...base.regimes[r], driftPerDay: base.regimes[r].driftPerDay * trend }]),
    ) as EngineParams['regimes'];

    return {
        ...base,
        dailyVol: base.dailyVol * vol,
        regimes,
        jumps: { ...base.jumps, perDay: base.jumps.perDay * jumps, size: base.jumps.size * Math.sqrt(vol) },
        tailDf: tailDf ?? base.tailDf,
    };
}

/** 업종별 아이콘 색과 기본 성격. 종목마다 따로 정한 성격이 있으면 그쪽을 쓴다 */
const SECTORS: Record<string, { color: string; personality: Personality }> = {
    반도체: { color: '#3182f6', personality: { vol: 0.9 } },
    '2차전지': { color: '#22c55e', personality: { vol: 1.4, trend: 1.3 } },
    바이오: { color: '#8b5cf6', personality: { vol: 1.6, jumps: 2, tailDf: 4 } },
    자동차: { color: '#64748b', personality: { vol: 1 } },
    금융: { color: '#0ea5e9', personality: { vol: 0.5, trend: 0.6, jumps: 0.4 } },
    화학: { color: '#10b981', personality: { vol: 1.1 } },
    철강: { color: '#78716c', personality: { vol: 1 } },
    조선: { color: '#0284c7', personality: { vol: 1.2, trend: 1.2 } },
    건설: { color: '#f59e0b', personality: { vol: 0.9 } },
    통신: { color: '#06b6d4', personality: { vol: 0.6, trend: 0.6 } },
    식품: { color: '#f97316', personality: { vol: 0.5, trend: 0.5, jumps: 0.3 } },
    유통: { color: '#eab308', personality: { vol: 0.7 } },
    엔터: { color: '#ec4899', personality: { vol: 1.3, jumps: 1.5 } },
    게임: { color: '#a855f7', personality: { vol: 1.3, jumps: 1.5 } },
    인터넷: { color: '#14b8a6', personality: { vol: 1 } },
    에너지: { color: '#ef4444', personality: { vol: 1.2 } },
    운송: { color: '#6366f1', personality: { vol: 1 } },
};

/**
 * 처음 가격 기준 시가총액(조 원). 발행 주식 수를 정하는 데만 쓰고, 이후 시가총액은 주가에 따라 움직인다.
 * 가격이 거친 종목일수록 작은 회사로 두었다. 개미전자가 300조로 가장 크고 알방셀이 3천억으로 가장 작다.
 */
const MARKET_CAP_JO: Record<string, number> = {
    gmj: 300,
    ajm: 120,
    dgc: 3,
    jhs: 0.8,
    cgt: 5,
    gmb: 80,
    sgj: 25,
    ygm: 4,
    ywb: 6,
    gsj: 40,
    ksb: 2,
    abs: 0.3,
    bjb: 60,
    gcj: 4,
    ddm: 8,
    hgm: 50,
    gmc: 35,
    ggb: 2,
    gmk: 30,
    ggj: 25,
    ywl: 12,
    gsc: 3,
    agh: 15,
    prm: 20,
    syc: 6,
    mrh: 30,
    kts: 25,
    dds: 2,
    ddj: 35,
    nyj: 5,
    igc: 2,
    gtg: 4,
    tns: 0.5,
    dgt: 6,
    jdt: 15,
    gds: 3,
    jdm: 4,
    bsn: 1.5,
    gmm: 5,
    mig: 1,
    bjj: 8,
    gtm: 1.5,
    dsg: 12,
    gns: 1,
    gmt: 25,
    ggs: 40,
    hde: 1.2,
    hbb: 4,
    ngm: 9,
    hrm: 6,
};

/** 유통 주식 비율. 큰 회사일수록 그룹·최대주주 지분이 많아 시장에 풀린 주식이 적다 */
function floatRatio(capJo: number): number {
    if (capJo >= 50) return 0.45;
    if (capJo >= 10) return 0.55;
    if (capJo >= 1) return 0.65;
    return 0.7;
}

/** 시가총액 규모 구분 */
export function sizeClass(marketCap: number): '대형주' | '중형주' | '소형주' {
    if (marketCap >= 10e12) return '대형주';
    if (marketCap >= 1e12) return '중형주';
    return '소형주';
}

/**
 * 기본 배당률은 업종마다 범위를 두고, 같은 업종이면 가격이 얌전한 종목일수록 높게 줬다.
 * 금융·통신 4.5~6%, 식품·유통·에너지 3.5~5%, 자동차·철강·화학·건설·운송 2.5~4%,
 * 반도체·조선·인터넷·엔터 1.5~3%, 2차전지·바이오·게임 1~2%
 */
function stock(
    id: string,
    name: string,
    sector: string,
    initialPrice: number,
    dividendRate: number,
    personality?: Personality,
): StockDef {
    const s = SECTORS[sector]!;
    const capJo = MARKET_CAP_JO[id]!;
    const shares = Math.round((capJo * 1e12) / initialPrice);
    return {
        id,
        name,
        sector,
        color: s.color,
        dividendRate,
        initialPrice,
        shares,
        floatShares: Math.floor(shares * floatRatio(capJo)),
        personality: personality ?? s.personality,
    };
}

/**
 * 종목 목록. 종목의 시드가 목록 순서로 정해지므로 새 종목은 맨 뒤에 붙이고,
 * 이미 있는 종목의 id·순서·성격은 바꾸지 않는다. 바꾸면 그 종목의 지난 가격이 달라진다.
 */
export const STOCKS: StockDef[] = [
    stock('gmj', '개미전자', '반도체', 52_000, 0.03, { vol: 0.6, trend: 0.6, jumps: 0.5 }),
    stock('ywb', '여왕바이오', '바이오', 18_400, 0.01, { vol: 1.8, jumps: 2.5, tailDf: 3 }),
    stock('igc', '일개미건설', '건설', 7_300, 0.03, { vol: 0.9 }),
    stock('gds', '꿀단지식품', '식품', 31_500, 0.045, { vol: 0.5, trend: 0.5, jumps: 0.3 }),
    stock('dgt', '땅굴통신', '통신', 12_800, 0.05, { vol: 0.7 }),
    stock('prm', '페로몬화학', '화학', 96_000, 0.03, { vol: 1.1, trend: 1.2 }),
    stock('ddm', '더듬이모빌리티', '자동차', 24_600, 0.025, { vol: 1.3, trend: 1.4 }),
    stock('hde', '흙더미에너지', '에너지', 4_150, 0.035, { vol: 1.5, jumps: 1.5 }),

    stock('ajm', '알집메모리', '반도체', 184_000, 0.025, { vol: 1.1, trend: 1.1 }),
    stock('dgc', '더듬이칩스', '반도체', 23_450, 0.02),
    stock('jhs', '지하반도체', '반도체', 8_920, 0.015, { vol: 1.3, jumps: 1.3 }),
    stock('cgt', '촉각테크', '반도체', 41_200, 0.02),

    stock('gmb', '개미배터리', '2차전지', 312_000, 0.02),
    stock('sgj', '수개미전지', '2차전지', 87_600, 0.015),
    stock('ygm', '양극개미', '2차전지', 15_730, 0.01, { vol: 1.7, trend: 1.4, jumps: 1.5 }),

    stock('gsj', '개미산제약', '바이오', 64_300, 0.02, { vol: 1.1, jumps: 1.2 }),
    stock('ksb', '꿀샘바이오', '바이오', 9_870, 0.015),
    stock('abs', '알방셀', '바이오', 3_415, 0.01, { vol: 2, jumps: 3, tailDf: 3 }),
    stock('bjb', '병정바이오', '바이오', 128_500, 0.015, { vol: 1.3, jumps: 1.5 }),
    stock('gcj', '고치제약', '바이오', 27_900, 0.02),

    stock('hgm', '행군모터스', '자동차', 213_000, 0.04, { vol: 0.8 }),
    stock('gmc', '개미자동차', '자동차', 98_400, 0.035, { vol: 0.8, trend: 0.8 }),
    stock('ggb', '굴길부품', '자동차', 11_350, 0.03, { vol: 1.2 }),

    stock('gmk', '개미은행', '금융', 61_800, 0.055),
    stock('ggj', '곳간금융지주', '금융', 47_250, 0.05),
    stock('ywl', '여왕생명', '금융', 82_100, 0.06, { vol: 0.6, trend: 0.6, jumps: 0.4 }),
    stock('gsc', '굴속증권', '금융', 9_640, 0.045, { vol: 0.9, trend: 0.9 }),
    stock('agh', '알곡화재', '금융', 256_000, 0.055),

    stock('syc', '수액케미칼', '화학', 33_700, 0.035),
    stock('mrh', '밀랍화학', '화학', 418_500, 0.04, { vol: 0.9 }),

    stock('kts', '큰턱철강', '철강', 296_000, 0.035, { vol: 0.8 }),
    stock('dds', '단단스틸', '철강', 14_820, 0.03),

    stock('ddj', '뗏목중공업', '조선', 158_700, 0.025),
    stock('nyj', '낙엽조선', '조선', 21_600, 0.015, { vol: 1.4, trend: 1.3 }),

    stock('gtg', '개미탑건설', '건설', 36_150, 0.035),
    stock('tns', '터널산업', '건설', 5_280, 0.025, { vol: 1.2 }),

    stock('jdt', '진동텔레콤', '통신', 54_900, 0.06),

    stock('jdm', '진딧물유업', '식품', 412_000, 0.05),
    stock('bsn', '버섯농원', '식품', 18_970, 0.04, { vol: 0.7 }),

    stock('gmm', '개미마트', '유통', 72_300, 0.04),
    stock('mig', '먹이길유통', '유통', 6_840, 0.035, { vol: 0.9 }),

    stock('bjj', '베짱이엔터', '엔터', 67_400, 0.02),
    stock('gtm', '귀뚜라미뮤직', '엔터', 23_100, 0.015, { vol: 1.5, jumps: 1.8 }),

    stock('dsg', '땅속게임즈', '게임', 188_900, 0.02),
    stock('gns', '굴놀이소프트', '게임', 12_460, 0.01, { vol: 1.6, jumps: 2 }),

    stock('gmt', '개미톡', '인터넷', 44_850, 0.02, { vol: 1.1 }),
    stock('ggs', '굴광장', '인터넷', 176_200, 0.025, { vol: 0.9 }),

    stock('hbb', '햇볕발전', '에너지', 21_350, 0.05, { vol: 0.8, trend: 0.7 }),

    stock('ngm', '날개미항공', '운송', 23_800, 0.025, { vol: 1.1 }),
    stock('hrm', '행렬물류', '운송', 95_600, 0.04, { vol: 0.8 }),
];

export const STOCK_BY_ID = new Map(STOCKS.map((s) => [s.id, s]));

/** 업종 이름. 목록의 업종 탭 순서로 쓴다 */
export const SECTOR_NAMES = Object.keys(SECTORS);
