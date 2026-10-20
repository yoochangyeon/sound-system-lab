// Web Audio BiquadFilterNode와 같은 식으로 계수와 주파수 응답을 계산한다.
// 화면 그래프와 미션 판정이 노드 없이 같은 숫자를 쓰기 위한 순수 함수다.
// 식: Web Audio API 명세 "BiquadFilterNode" 절(Audio EQ Cookbook 기반).
//  - lowpass/highpass의 Q는 dB 단위다(명세 그대로).
//  - shelf는 Q를 쓰지 않는다(S = 1).

export type BiquadType = 'lowpass' | 'highpass' | 'peaking' | 'lowshelf' | 'highshelf' | 'allpass';

export interface BiquadParams {
  type: BiquadType;
  freq: number; // Hz
  gainDb: number; // peaking·shelf만 의미 있음
  q: number; // peaking·allpass는 선형, lowpass·highpass는 dB
}

export interface BiquadCoefs {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

export const DEFAULT_SAMPLE_RATE = 48000;

/** 2차 버터워스 HPF가 되는 Web Audio Q 값(dB). 20·log10(1/√2) */
export const BUTTERWORTH_Q_DB = 20 * Math.log10(Math.SQRT1_2);

export function biquadCoefs(p: BiquadParams, sampleRate = DEFAULT_SAMPLE_RATE): BiquadCoefs {
  const nyquist = sampleRate / 2;
  const f0 = Math.min(Math.max(p.freq, 0), nyquist);
  const A = Math.pow(10, p.gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alphaQ = sin / (2 * p.q);
  const alphaQdB = sin / (2 * Math.pow(10, p.q / 20));
  const alphaS = (sin / 2) * Math.SQRT2;
  const sqrtA = Math.sqrt(A);

  switch (p.type) {
    case 'lowpass':
      return { b0: (1 - cos) / 2, b1: 1 - cos, b2: (1 - cos) / 2, a0: 1 + alphaQdB, a1: -2 * cos, a2: 1 - alphaQdB };
    case 'highpass':
      return { b0: (1 + cos) / 2, b1: -(1 + cos), b2: (1 + cos) / 2, a0: 1 + alphaQdB, a1: -2 * cos, a2: 1 - alphaQdB };
    case 'peaking':
      return { b0: 1 + alphaQ * A, b1: -2 * cos, b2: 1 - alphaQ * A, a0: 1 + alphaQ / A, a1: -2 * cos, a2: 1 - alphaQ / A };
    case 'allpass':
      return { b0: 1 - alphaQ, b1: -2 * cos, b2: 1 + alphaQ, a0: 1 + alphaQ, a1: -2 * cos, a2: 1 - alphaQ };
    case 'lowshelf':
      return {
        b0: A * (A + 1 - (A - 1) * cos + 2 * alphaS * sqrtA),
        b1: 2 * A * (A - 1 - (A + 1) * cos),
        b2: A * (A + 1 - (A - 1) * cos - 2 * alphaS * sqrtA),
        a0: A + 1 + (A - 1) * cos + 2 * alphaS * sqrtA,
        a1: -2 * (A - 1 + (A + 1) * cos),
        a2: A + 1 + (A - 1) * cos - 2 * alphaS * sqrtA,
      };
    case 'highshelf':
      return {
        b0: A * (A + 1 + (A - 1) * cos + 2 * alphaS * sqrtA),
        b1: -2 * A * (A - 1 + (A + 1) * cos),
        b2: A * (A + 1 + (A - 1) * cos - 2 * alphaS * sqrtA),
        a0: A + 1 - (A - 1) * cos + 2 * alphaS * sqrtA,
        a1: 2 * (A - 1 - (A + 1) * cos),
        a2: A + 1 - (A - 1) * cos - 2 * alphaS * sqrtA,
      };
  }
}

/** 주파수 f(Hz)에서의 크기 응답(dB). */
export function biquadResponseDb(p: BiquadParams, f: number, sampleRate = DEFAULT_SAMPLE_RATE): number {
  const c = biquadCoefs(p, sampleRate);
  const w = (2 * Math.PI * f) / sampleRate;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const nr = c.b0 + c.b1 * c1 + c.b2 * c2;
  const ni = -(c.b1 * s1 + c.b2 * s2);
  const dr = c.a0 + c.a1 * c1 + c.a2 * c2;
  const di = -(c.a1 * s1 + c.a2 * s2);
  const mag = Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
  return 20 * Math.log10(mag);
}

/** 직렬로 이은 필터들의 합성 응답(dB) = 각 응답의 합. */
export function cascadeResponseDb(filters: BiquadParams[], f: number, sampleRate = DEFAULT_SAMPLE_RATE): number {
  let total = 0;
  for (const p of filters) total += biquadResponseDb(p, f, sampleRate);
  return total;
}

/** 그래프용 로그 간격 주파수 배열. */
export function logFrequencies(count: number, min = 20, max = 20000): number[] {
  const out: number[] = [];
  const ratio = Math.log(max / min);
  for (let i = 0; i < count; i++) out.push(min * Math.exp((ratio * i) / (count - 1)));
  return out;
}
