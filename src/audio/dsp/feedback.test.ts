import { describe, expect, it } from 'vitest';
import { HOWL_CAP_DB, HOWL_FLOOR_DB, howlStep } from './feedback';

function run(loopGainDb: number, seconds: number, start = HOWL_FLOOR_DB): number {
  let lvl = start;
  for (let t = 0; t < seconds; t += 0.05) lvl = howlStep(lvl, loopGainDb, 0.05);
  return lvl;
}

describe('하울링 모델', () => {
  it('루프 게인이 임계값보다 크면 커지고, 상한을 넘지 않는다', () => {
    expect(run(9, 0.5)).toBeGreaterThan(HOWL_FLOOR_DB + 10);
    expect(run(9, 10)).toBe(HOWL_CAP_DB);
  });

  it('루프 게인이 클수록 빨리 커진다', () => {
    expect(run(9, 0.5)).toBeGreaterThan(run(2, 0.5));
  });

  it('임계값 아래로 내려가면 줄어들어 바닥까지 간다', () => {
    expect(run(-3, 0.5, HOWL_CAP_DB)).toBeLessThan(HOWL_CAP_DB - 10);
    expect(run(-3, 5, HOWL_CAP_DB)).toBe(HOWL_FLOOR_DB);
  });
});
