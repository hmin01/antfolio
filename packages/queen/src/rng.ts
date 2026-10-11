export interface Rng {
  /** [0, 1) 균등분포 */
  next(): number;
  /** 표준정규분포 N(0, 1) */
  normal(): number;
}

/**
 * 시드 기반 결정적 난수 생성기(mulberry32).
 * 같은 시드는 항상 같은 수열을 만들어서, 같은 시드의 시장은 언제 다시 계산해도 같은 차트가 나온다.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Box-Muller 변환. 0이 나오면 log(0)이 되므로 (0, 1] 구간을 쓴다.
  const normal = (): number => {
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  return { next, normal };
}

/**
 * 틱마다 독립된 난수 생성기.
 * 한 틱에서 난수를 몇 개 뽑든 다른 틱의 난수에 영향을 주지 않아서,
 * 엔진 상태만 저장해 두면 어느 틱에서든 같은 결과로 이어서 계산할 수 있다.
 */
export function rngForTick(seed: number, tick: number): Rng {
  let h = (seed >>> 0) ^ Math.imul(tick >>> 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return createRng(h);
}
