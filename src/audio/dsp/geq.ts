// 31밴드 그래픽 EQ: ISO 1/3옥타브 중심 주파수에 peaking 필터를 하나씩 둔다.

import { cascadeResponseDb, type BiquadParams } from './biquad';

export const GEQ_FREQS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150,
  4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
] as const;

/** 1/3옥타브 대역폭에 해당하는 Q. √(2^(1/3)) / (2^(1/3) − 1) ≈ 4.32 */
export const GEQ_Q = Math.sqrt(Math.pow(2, 1 / 3)) / (Math.pow(2, 1 / 3) - 1);

export function flatGeq(): number[] {
  return GEQ_FREQS.map(() => 0);
}

export function geqFilters(gainsDb: readonly number[]): BiquadParams[] {
  return GEQ_FREQS.map((freq, i) => ({ type: 'peaking', freq, gainDb: gainsDb[i] ?? 0, q: GEQ_Q }));
}

export function geqResponseDb(gainsDb: readonly number[], f: number, sampleRate?: number): number {
  return cascadeResponseDb(geqFilters(gainsDb), f, sampleRate);
}

/** 주파수에 가장 가까운 GEQ 밴드 번호. */
export function nearestGeqBand(f: number): number {
  let best = 0;
  for (let i = 1; i < GEQ_FREQS.length; i++) {
    if (Math.abs(Math.log(GEQ_FREQS[i] / f)) < Math.abs(Math.log(GEQ_FREQS[best] / f))) best = i;
  }
  return best;
}

export function formatHz(f: number): string {
  return f >= 1000 ? `${+(f / 1000).toFixed(f >= 10000 ? 0 : 2)}k` : `${+f.toFixed(1)}`;
}
