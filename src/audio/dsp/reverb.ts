// 리버브 잔향(임펄스 응답)을 코드로 만든다. 실제 공간 녹음 파일을 쓰지 않아 저작권·용량 문제가 없다.
// 구조: 좌우가 다른 노이즈 → 한 극 로우패스(하이컷) → RT60에 맞춘 지수 감쇠 → 전체 에너지를 1로 맞춤.
// 잔향 길이(RT60)는 소리가 60 dB 작아지는 시간이다.

export interface ReverbShape {
  decayS: number;
  hiCutHz: number;
}

/** 같은 설정이면 같은 잔향이 나오도록 씨앗이 정해진 난수(mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 스테레오 잔향 [왼쪽, 오른쪽]. 길이는 잔향 길이의 1.1배. */
export function reverbImpulse(sampleRate: number, p: ReverbShape): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.round(p.decayS * 1.1 * sampleRate));
  // 진폭이 decayS 동안 60 dB(1/1000) 줄어드는 감쇠율
  const k = Math.log(1000) / (p.decayS * sampleRate);
  // 한 극 로우패스 계수
  const a = Math.exp((-2 * Math.PI * Math.min(p.hiCutHz, sampleRate / 2)) / sampleRate);
  const out: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(length), new Float32Array(length)];
  out.forEach((ch, c) => {
    const rand = rng(0x5eed + c * 7919);
    let lp = 0;
    let energy = 0;
    for (let i = 0; i < length; i++) {
      lp = (1 - a) * (rand() * 2 - 1) + a * lp;
      ch[i] = lp * Math.exp(-k * i);
      energy += ch[i] * ch[i];
    }
    const norm = 1 / Math.sqrt(energy || 1);
    for (let i = 0; i < length; i++) ch[i] *= norm;
  });
  return out;
}

/** BPM과 박자(4분음표 = 1, 점8분 = 0.75, 8분 = 0.5)로 딜레이 시간(ms) */
export function beatMs(bpm: number, quarters: number): number {
  return (60000 / bpm) * quarters;
}
