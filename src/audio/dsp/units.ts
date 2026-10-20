// 콘솔 화면은 dB로, 신호 처리는 선형 배율로 다룬다.
// -Infinity dB(페이더 맨 아래)는 0배로 취급한다.

export function dbToGain(db: number): number {
  return db === -Infinity ? 0 : Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain);
}
