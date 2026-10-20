import { describe, expect, it } from 'vitest';
import { standout } from './Rta';

describe('RTA 튀어나온 막대', () => {
  it('하울링처럼 한 밴드만 크면 그 밴드 하나를 고른다', () => {
    const level = Array(31).fill(-60);
    level[20] = -25;
    level[19] = -45; // 이웃 밴드는 같이 커도 된다
    expect(standout(level)).toEqual({ top: 20, margin: 35 });
  });

  it('음악처럼 여러 밴드가 고르게 크면 차이가 작다', () => {
    const level = Array.from({ length: 31 }, (_, k) => -30 - (k % 4));
    expect(standout(level).margin).toBe(0);
  });

  it('너무 작은 소리는 고르지 않는다', () => {
    const level = Array(31).fill(-90);
    level[10] = -50;
    expect(standout(level).top).toBe(-1);
  });
});
