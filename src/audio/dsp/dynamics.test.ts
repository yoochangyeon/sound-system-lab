import { describe, expect, it } from 'vitest';
import { compGainDb, compTransferDb, Compressor, expGainDb, Gate, SafetyLimiter, timeCoef, type CompParams } from './dynamics';
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

describe('컴프 EXP 모드(아래로 늘리기)', () => {
  const exp = { thresholdDb: -40, ratio: 2, kneeDb: 0 };
  it('스레숄드 위는 그대로', () => expect(expGainDb(-30, exp)).toBe(0));
  it('1:2면 스레숄드보다 10 dB 작을 때 10 dB 더 줄인다', () => expect(expGainDb(-50, exp)).toBeCloseTo(-10, 9));
  it('아주 작은 소리도 −80 dB 아래로는 줄이지 않는다', () => expect(expGainDb(-120, { ...exp, ratio: 4 })).toBe(-80));
  it('Compressor가 mode exp로 작은 소리를 줄인다', () => {
    const comp = new Compressor(SR);
    const x = constant(-50, 0.3);
    comp.process([x], { ...base, thresholdDb: -40, ratio: 2, mode: 'exp', attackMs: 1 });
    expect(gainToDb(x[x.length - 1])).toBeCloseTo(-60, 1);
  });
});

describe('사이드체인(키 입력)', () => {
  it('컴프는 키 신호로 검출하고 게인은 본 신호에 건다', () => {
    const comp = new Compressor(SR);
    const x = constant(-40, 0.3); // 본 신호는 스레숄드 아래
    const key = constant(-12, 0.3); // 키는 8 dB 넘는다 → 6 dB 누름
    comp.process([x], base, false, [key]);
    expect(comp.grDb).toBeCloseTo(-6, 2);
    expect(gainToDb(x[x.length - 1])).toBeCloseTo(-46, 1);
  });

  it('키가 없으면 본 신호로 검출한다(기존과 같다)', () => {
    const comp = new Compressor(SR);
    comp.process([constant(-40, 0.3)], base);
    expect(comp.grDb).toBe(0);
  });

  it('게이트도 키 신호가 크면 열린다', () => {
    const gate = new Gate(SR);
    const x = constant(-60, 0.1);
    gate.process([x], { thresholdDb: -40, rangeDb: 30, attackMs: 0.5, holdMs: 10, releaseMs: 20 }, false, [constant(-20, 0.1)]);
    expect(gate.open).toBe(true);
    expect(gainToDb(x[x.length - 1])).toBeCloseTo(-60, 1);
  });
});

describe('병렬 압축(Mix)', () => {
  it('Mix 50%면 원음 반 + 눌린 소리 반', () => {
    const comp = new Compressor(SR);
    const x = constant(-12, 0.3);
    comp.process([x], { ...base, mixPct: 50 }); // 눌린 쪽은 −18 dB
    const expected = 0.5 * dbToGain(-12) + 0.5 * dbToGain(-18);
    expect(x[x.length - 1]).toBeCloseTo(expected, 4);
  });
  it('Mix 0%면 원음 그대로', () => {
    const comp = new Compressor(SR);
    const x = constant(-12, 0.3);
    comp.process([x], { ...base, mixPct: 0 });
    expect(x[x.length - 1]).toBeCloseTo(dbToGain(-12), 6);
  });
});

describe('게이트 모드', () => {
  const g = { thresholdDb: -40, rangeDb: 30, attackMs: 0.5, holdMs: 10, releaseMs: 5 };

  it('익스팬더(1:2)는 스레숄드 아래 10 dB에서 10 dB만 줄인다', () => {
    const gate = new Gate(SR);
    gate.process([constant(-50, 0.5)], { ...g, mode: 'exp', expRatio: 2 });
    expect(gate.grDb).toBeCloseTo(-10, 0);
  });

  it('익스팬더도 레인지보다 더 줄이지 않는다', () => {
    const gate = new Gate(SR);
    gate.process([constant(-80, 0.5)], { ...g, mode: 'exp', expRatio: 4 });
    expect(gate.grDb).toBeCloseTo(-30, 0);
  });

  it('덕킹: 키가 스레숄드를 넘으면 레인지만큼 줄인다', () => {
    const gate = new Gate(SR);
    const music = constant(-20, 0.3);
    gate.process([music], { ...g, mode: 'duck', rangeDb: 12 }, false, [constant(-20, 0.3)]);
    expect(gate.grDb).toBeCloseTo(-12, 1);
    expect(gainToDb(music[music.length - 1])).toBeCloseTo(-32, 1);
  });

  it('덕킹: 키가 조용해지면 홀드·릴리스 뒤 돌아온다', () => {
    const gate = new Gate(SR);
    const p = { ...g, mode: 'duck' as const, rangeDb: 12 };
    gate.process([constant(-20, 0.2)], p, false, [constant(-20, 0.2)]);
    gate.process([constant(-20, 0.3)], p, false, [constant(-80, 0.3)]);
    expect(gate.grDb).toBeGreaterThan(-0.5);
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
