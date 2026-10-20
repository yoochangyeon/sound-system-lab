import { describe, expect, it } from 'vitest';
import { BUTTERWORTH_Q_DB, biquadResponseDb, cascadeResponseDb, logFrequencies } from './biquad';
import { GEQ_FREQS, geqResponseDb, nearestGeqBand } from './geq';

describe('Biquad 주파수 응답', () => {
  it('1 kHz peaking −6 dB는 1 kHz에서 약 −6 dB', () => {
    expect(biquadResponseDb({ type: 'peaking', freq: 1000, gainDb: -6, q: 1 }, 1000)).toBeCloseTo(-6, 3);
  });

  it('peaking은 중심에서 멀어지면 0 dB에 가까워진다', () => {
    expect(Math.abs(biquadResponseDb({ type: 'peaking', freq: 1000, gainDb: -6, q: 2 }, 50))).toBeLessThan(0.1);
  });

  it('버터워스 HPF는 차단 주파수에서 약 −3 dB, 한 옥타브 아래에서 약 −12 dB', () => {
    const hpf = { type: 'highpass' as const, freq: 100, gainDb: 0, q: BUTTERWORTH_Q_DB };
    expect(biquadResponseDb(hpf, 100)).toBeCloseTo(-3.01, 1);
    expect(biquadResponseDb(hpf, 50)).toBeLessThan(-11.5);
    expect(Math.abs(biquadResponseDb(hpf, 5000))).toBeLessThan(0.05);
    const lpf = { type: 'lowpass' as const, freq: 2000, gainDb: 0, q: BUTTERWORTH_Q_DB };
    expect(biquadResponseDb(lpf, 2000)).toBeCloseTo(-3.01, 1);
    expect(biquadResponseDb(lpf, 4000)).toBeLessThan(-11.5);
    expect(Math.abs(biquadResponseDb(lpf, 100))).toBeLessThan(0.05);
  });

  it('shelf의 양 끝은 설정 게인에 수렴한다', () => {
    const lo = { type: 'lowshelf' as const, freq: 200, gainDb: 6, q: 1 };
    expect(biquadResponseDb(lo, 20)).toBeCloseTo(6, 0);
    expect(Math.abs(biquadResponseDb(lo, 15000))).toBeLessThan(0.2);
    const hi = { type: 'highshelf' as const, freq: 4000, gainDb: -9, q: 1 };
    expect(biquadResponseDb(hi, 20000)).toBeCloseTo(-9, 0);
  });

  it('allpass는 모든 주파수에서 0 dB', () => {
    for (const f of [20, 200, 2000, 20000]) {
      expect(biquadResponseDb({ type: 'allpass', freq: 500, gainDb: 0, q: 1 }, f)).toBeCloseTo(0, 6);
    }
  });

  it('직렬 응답은 각 응답의 합', () => {
    const a = { type: 'peaking' as const, freq: 300, gainDb: 4, q: 1 };
    const b = { type: 'peaking' as const, freq: 3000, gainDb: -5, q: 1 };
    for (const f of logFrequencies(10)) {
      expect(cascadeResponseDb([a, b], f)).toBeCloseTo(biquadResponseDb(a, f) + biquadResponseDb(b, f), 9);
    }
  });
});

describe('31밴드 GEQ', () => {
  it('평평하면 0 dB', () => {
    expect(geqResponseDb(GEQ_FREQS.map(() => 0), 1000)).toBeCloseTo(0, 9);
  });

  it('2.5 kHz 밴드를 −12 dB 깎으면 2.5 kHz가 약 −12 dB 근처로 내려가고 멀리는 거의 그대로', () => {
    const g = GEQ_FREQS.map(() => 0);
    g[nearestGeqBand(2500)] = -12;
    expect(geqResponseDb(g, 2500)).toBeLessThan(-11);
    expect(Math.abs(geqResponseDb(g, 300))).toBeLessThan(0.3);
  });

  it('가장 가까운 밴드를 찾는다', () => {
    expect(GEQ_FREQS[nearestGeqBand(2600)]).toBe(2500);
    expect(GEQ_FREQS[nearestGeqBand(19)]).toBe(20);
  });
});
