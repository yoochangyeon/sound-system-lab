import { describe, expect, it } from 'vitest';
import { dbToGain, gainToDb } from './units';

describe('dB ↔ 배율 변환', () => {
  it('0 dB는 1배', () => expect(dbToGain(0)).toBe(1));
  it('-6 dB는 약 0.5배', () => expect(dbToGain(-6)).toBeCloseTo(0.501, 3));
  it('-Infinity dB는 0배', () => expect(dbToGain(-Infinity)).toBe(0));
  it('0배는 -Infinity dB', () => expect(gainToDb(0)).toBe(-Infinity));
  it('왕복 변환이 같다', () => expect(gainToDb(dbToGain(-12.5))).toBeCloseTo(-12.5, 10));
});
