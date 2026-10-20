import { describe, expect, it } from 'vitest';
import { combResponseDb, firstNotchHz } from './comb';

describe('두 마이크 콤 필터', () => {
  it('늦음이 없고 극성이 같으면 +6 dB, 반대면 거의 사라진다', () => {
    expect(combResponseDb(1000, 0, false)).toBeCloseTo(6.02, 1);
    expect(combResponseDb(1000, 0, true)).toBeLessThan(-100);
  });
  it('1 ms 늦으면 500 Hz에서 상쇄되고 1 kHz에서 다시 더해진다', () => {
    expect(firstNotchHz(1, false)).toBe(500);
    expect(combResponseDb(500, 1, false)).toBeLessThan(-60);
    expect(combResponseDb(1000, 1, false)).toBeCloseTo(6.02, 1);
  });
  it('극성을 뒤집으면 1 ms에서 1 kHz가 상쇄되고 500 Hz가 더해진다', () => {
    expect(combResponseDb(1000, 1, true)).toBeLessThan(-60);
    expect(combResponseDb(500, 1, true)).toBeCloseTo(6.02, 1);
  });
});
