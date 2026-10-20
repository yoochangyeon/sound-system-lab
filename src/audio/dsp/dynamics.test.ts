import { describe, expect, it } from 'vitest';
import { compGainDb, compTransferDb, Compressor, Gate, SafetyLimiter, timeCoef, type CompParams } from './dynamics';
import { dbToGain, gainToDb } from './units';

const SR = 48000;

/** 일정한 크기(dBFS)의 DC 같은 신호. 검출기가 바로 그 레벨을 본다. */
function constant(db: number, seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * SR)).fill(dbToGain(db));
}

const base: CompParams = {
  thresholdDb: -20,
  ratio: 4,
  kneeDb: 0,
  attackMs: 10,
  releaseMs: 100,
  makeupDb: 0,
  detector: 'peak',
};

describe('컴프 정적 게인 계산', () => {
  it('스레숄드 아래는 0 dB', () => expect(compGainDb(-30, base)).toBe(0));
  it('4:1에서 스레숄드보다 8 dB 크면 6 dB 누른다', () => expect(compGainDb(-12, base)).toBeCloseTo(-6, 9));
  it('리미터(∞:1)는 스레숄드로 맞춘다', () => expect(compGainDb(-5, { ...base, ratio: Infinity })).toBeCloseTo(-15, 9));
  it('소프트 니는 스레숄드에서 0과 하드 니 사이', () => {
    const g = compGainDb(-20, { ...base, kneeDb: 6 });
    expect(g).toBeLessThan(0);
    expect(g).toBeGreaterThan(-1);
  });
  it('전달 곡선은 메이크업만큼 올라간다', () => {
    expect(compTransferDb(-12, { ...base, makeupDb: 3 })).toBeCloseTo(-15, 9);
  });
});

describe('컴프레서 시간 동작', () => {
  it('계단 입력에서 정적 GR에 수렴하고, 어택 시간 상수 근처에서 약 63%에 닿는다', () => {
    const comp = new Compressor(SR);
    const x = constant(-12, 0.3);
    const attackSamples = Math.round((base.attackMs / 1000) * SR);
    let grAtAttack = 0;
    for (let i = 0; i < x.length; i += 1) {
      comp.process([x.subarray(i, i + 1)], base);
      if (i === attackSamples - 1) grAtAttack = comp.grDb;
    }
    expect(comp.grDb).toBeCloseTo(-6, 2);
    expect(grAtAttack / -6).toBeGreaterThan(0.55);
    expect(grAtAttack / -6).toBeLessThan(0.72);
    // 출력 레벨 = 입력 − 6 dB
    expect(gainToDb(x[x.length - 1])).toBeCloseTo(-18, 1);
  });

  it('입력이 내려가면 릴리스 동안 GR이 돌아온다', () => {
    const comp = new Compressor(SR);
    comp.process([constant(-12, 0.3)], base);
    comp.process([constant(-40, (base.releaseMs / 1000))], base);
    // 한 시간 상수 뒤 약 37% 남는다
    expect(comp.grDb / -6).toBeGreaterThan(0.3);
    expect(comp.grDb / -6).toBeLessThan(0.45);
  });

  it('RMS 검출은 같은 피크의 짧은 순간 신호에 덜 반응한다', () => {
    const burst = new Float32Array(SR / 10);
    for (let i = 0; i < burst.length; i += 480) burst[i] = dbToGain(-6); // 10 ms마다 한 샘플 클릭
    const peak = new Compressor(SR);
    const rms = new Compressor(SR);
    peak.process([burst.slice()], { ...base, attackMs: 0 });
    rms.process([burst.slice()], { ...base, attackMs: 0, detector: 'rms' });
    expect(rms.grDb).toBeGreaterThan(peak.grDb);
  });

  it('바이패스면 신호를 바꾸지 않는다', () => {
    const comp = new Compressor(SR);
    const x = constant(-6, 0.05);
    comp.process([x], base, true);
    expect(x[x.length - 1]).toBeCloseTo(dbToGain(-6), 6);
  });
});

describe('게이트', () => {
  const g = { thresholdDb: -40, rangeDb: 30, attackMs: 0.5, holdMs: 50, releaseMs: 20 };

  it('스레숄드 아래가 계속되면 레인지만큼 줄인다', () => {
    const gate = new Gate(SR);
    gate.process([constant(-60, 0.5)], g);
    expect(gate.grDb).toBeCloseTo(-30, 1);
    expect(gate.open).toBe(false);
  });

  it('스레숄드를 넘으면 열리고, 홀드 시간 동안은 열린 채 유지된다', () => {
    const gate = new Gate(SR);
    gate.process([constant(-20, 0.05)], g);
    expect(gate.open).toBe(true);
    gate.process([constant(-60, 0.04)], g); // 홀드 50 ms 안
    expect(gate.open).toBe(true);
    expect(gate.grDb).toBeGreaterThan(-1);
    gate.process([constant(-60, 0.02)], g); // 60 ms → 홀드 끝
    expect(gate.open).toBe(false);
  });
});

describe('안전 리미터', () => {
  it('0 dBFS를 넘는 입력도 상한을 넘지 않는다', () => {
    const lim = new SafetyLimiter(SR, -1);
    const x = new Float32Array(SR / 10);
    for (let i = 0; i < x.length; i++) x[i] = 4 * Math.sin((2 * Math.PI * 440 * i) / SR);
    lim.process([x]);
    let peak = 0;
    for (const v of x) peak = Math.max(peak, Math.abs(v));
    expect(gainToDb(peak)).toBeLessThanOrEqual(-1 + 1e-6);
  });
});

describe('시간 상수', () => {
  it('0 ms면 즉시', () => expect(timeCoef(0, SR)).toBe(0));
});
