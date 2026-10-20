import { describe, expect, it } from 'vitest';
import { pinkNoise } from './noise';

describe('핑크 노이즈', () => {
  it('RMS가 1이고 같은 씨앗이면 같다', () => {
    const a = pinkNoise(48000);
    const rms = Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    expect(rms).toBeCloseTo(1, 5);
    expect(pinkNoise(48000)).toEqual(a);
  });

  it('흰 노이즈보다 낮은 쪽이 크다(이웃 샘플이 비슷하다)', () => {
    const x = pinkNoise(48000);
    let d = 0;
    for (let i = 1; i < x.length; i++) d += (x[i] - x[i - 1]) ** 2;
    // 흰 노이즈면 이웃 차이 에너지가 신호 에너지의 약 2배다
    expect(d / x.length).toBeLessThan(1);
  });
});
