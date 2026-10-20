// 같은 소리를 두 마이크로 받아 섞을 때의 주파수 응답(콤 필터).
// 두 번째 소리가 τ초 늦고(극성 반전이면 부호가 바뀌고) 크기가 g배면, 섞은 소리 = 1 + s·g·e^(−j2πfτ).
// 첫 번째 마이크만 들을 때를 0 dB로 본다.

export function combResponseDb(f: number, delayMs: number, invert: boolean, gain = 1): number {
  const w = 2 * Math.PI * f * (delayMs / 1000);
  const s = invert ? -gain : gain;
  const re = 1 + s * Math.cos(w);
  const im = -s * Math.sin(w);
  const mag = Math.hypot(re, im);
  return mag > 1e-6 ? 20 * Math.log10(mag) : -120;
}

/** 늦은 시간 τ에서 처음으로 상쇄되는 주파수(Hz). 극성이 같으면 1/(2τ), 반대면 0 Hz(저음부터 상쇄). */
export function firstNotchHz(delayMs: number, invert: boolean): number {
  if (delayMs <= 0) return invert ? 0 : Infinity;
  return invert ? 0 : 1000 / (2 * delayMs);
}
