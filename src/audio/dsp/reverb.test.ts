import { describe, expect, it } from 'vitest';
import { beatMs, reverbImpulse } from './reverb';
import { gainToDb } from './units';

const SR = 48000;

/** 구간 [from, to)초의 RMS(dB) */
function rmsDb(x: Float32Array, from: number, to: number): number {
  let s = 0;
  const a = Math.floor(from * SR);
  const b = Math.floor(to * SR);
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return gainToDb(Math.sqrt(s / (b - a)));
}

describe('리버브 잔향(IR)', () => {
  it('잔향 길이(RT60)만큼 지나면 약 60 dB 작아진다', () => {
    const [l] = reverbImpulse(SR, { decayS: 1.5, hiCutHz: 20000 });
    const head = rmsDb(l, 0, 0.05);
    const at = rmsDb(l, 1.475, 1.525);
    expect(head - at).toBeGreaterThan(54);
    expect(head - at).toBeLessThan(66);
  });

  it('길이는 잔향 길이보다 조금 길고, 같은 설정이면 같은 결과다', () => {
    const a = reverbImpulse(SR, { decayS: 1, hiCutHz: 8000 });
    const b = reverbImpulse(SR, { decayS: 1, hiCutHz: 8000 });
    expect(a[0].length).toBeGreaterThanOrEqual(SR);
    expect(a[0]).toEqual(b[0]);
  });

  it('왼쪽과 오른쪽이 달라 넓게 퍼진다(상관이 낮다)', () => {
    const [l, r] = reverbImpulse(SR, { decayS: 1, hiCutHz: 20000 });
    let lr = 0, ll = 0, rr = 0;
    for (let i = 0; i < l.length; i++) {
      lr += l[i] * r[i];
      ll += l[i] * l[i];
      rr += r[i] * r[i];
    }
    expect(Math.abs(lr / Math.sqrt(ll * rr))).toBeLessThan(0.2);
  });

  it('하이컷을 낮추면 잔향이 어두워진다(이웃 샘플 차이가 작다)', () => {
    const rough = (x: Float32Array) => {
      let d = 0, e = 0;
      for (let i = 1; i < 4800; i++) {
        d += (x[i] - x[i - 1]) ** 2;
        e += x[i] * x[i];
      }
      return d / e;
    };
    const bright = reverbImpulse(SR, { decayS: 1, hiCutHz: 16000 })[0];
    const dark = reverbImpulse(SR, { decayS: 1, hiCutHz: 2000 })[0];
    expect(rough(dark)).toBeLessThan(rough(bright) / 3);
  });

  it('전체 에너지를 잔향 길이와 상관없이 비슷하게 맞춘다(리턴 크기가 길이에 따라 크게 변하지 않게)', () => {
    const energy = (x: Float32Array) => x.reduce((s, v) => s + v * v, 0);
    const short = energy(reverbImpulse(SR, { decayS: 0.5, hiCutHz: 8000 })[0]);
    const long = energy(reverbImpulse(SR, { decayS: 4, hiCutHz: 8000 })[0]);
    expect(Math.abs(10 * Math.log10(long / short))).toBeLessThan(1);
  });
});

describe('박자 → 딜레이 시간', () => {
  it('120 BPM 4분음표는 500 ms, 점8분은 375 ms', () => {
    expect(beatMs(120, 1)).toBe(500);
    expect(beatMs(120, 0.75)).toBe(375);
  });
});
