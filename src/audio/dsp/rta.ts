// FFT 빈(AnalyserNode.getFloatFrequencyData, dB)을 1/3옥타브 31밴드로 묶는다.

import { GEQ_FREQS } from './geq';

const HALF_THIRD = Math.pow(2, 1 / 6);

/** 각 밴드 안 빈들의 전력 합을 dB로 돌려준다. 빈이 없으면 가장 가까운 빈 값. */
export function binsToThirdOctave(binsDb: ArrayLike<number>, sampleRate: number, fftSize: number): number[] {
  const binHz = sampleRate / fftSize;
  return GEQ_FREQS.map((fc) => {
    const lo = fc / HALF_THIRD;
    const hi = fc * HALF_THIRD;
    let power = 0;
    let count = 0;
    const start = Math.max(1, Math.floor(lo / binHz));
    const end = Math.min(binsDb.length - 1, Math.ceil(hi / binHz));
    for (let i = start; i <= end; i++) {
      const f = i * binHz;
      if (f < lo || f > hi) continue;
      power += Math.pow(10, binsDb[i] / 10);
      count++;
    }
    if (count === 0) {
      const i = Math.min(binsDb.length - 1, Math.max(0, Math.round(fc / binHz)));
      return binsDb[i];
    }
    return 10 * Math.log10(power);
  });
}

/** 시간 영역 샘플의 피크(dBFS). */
export function peakDb(samples: ArrayLike<number>): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) p = Math.max(p, Math.abs(samples[i]));
  return p > 0 ? 20 * Math.log10(p) : -Infinity;
}

export function rmsDb(samples: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  const r = Math.sqrt(s / Math.max(1, samples.length));
  return r > 0 ? 20 * Math.log10(r) : -Infinity;
}
