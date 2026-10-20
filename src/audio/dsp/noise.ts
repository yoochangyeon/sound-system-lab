// 시험 신호용 핑크 노이즈. 옥타브마다 에너지가 같아(높은 쪽으로 갈수록 3 dB씩 줄어) 귀에 고르게 들린다.
// Paul Kellet의 필터 방식. 씨앗을 고정해 같은 결과가 나온다. RMS를 1로 맞춘다.

export function pinkNoise(length: number, seed = 1): Float32Array<ArrayBuffer> {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let energy = 0;
  for (let i = 0; i < length; i++) {
    const w = rand();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    energy += out[i] * out[i];
  }
  const norm = 1 / Math.sqrt(energy / Math.max(1, length) || 1);
  for (let i = 0; i < length; i++) out[i] *= norm;
  return out;
}
