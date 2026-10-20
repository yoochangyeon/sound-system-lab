// 하울링(피드백) 단순 모델. 실제 지연 루프 대신, 주파수 하나의 루프 게인으로
// 하울링 크기가 커질지 줄어들지를 정한다. 크기에는 상한이 있다(이어폰 안전).

/** 루프 게인이 이 값을 넘으면 하울링이 커진다. */
export const HOWL_THRESHOLD_DB = 0;
/** 하울링 톤의 최대 크기(dBFS). */
export const HOWL_CAP_DB = -10;
/** 들리지 않는 바닥(dBFS). */
export const HOWL_FLOOR_DB = -90;
/** 루프 게인 1 dB 초과당 하울링이 커지는 속도(dB/초). */
export const HOWL_GROWTH_DB_PER_S = 4;
/** 임계값 아래로 내려갔을 때 최소로 줄어드는 속도(dB/초). */
export const HOWL_MIN_DECAY_DB_PER_S = 30;

/**
 * 시간 dt(초) 뒤의 하울링 크기(dBFS).
 * 루프 게인이 임계값보다 크면 그 차이에 비례해 커지고, 작으면 빠르게 줄어든다.
 */
export function howlStep(levelDb: number, loopGainDb: number, dt: number): number {
  const over = loopGainDb - HOWL_THRESHOLD_DB;
  const rate = over > 0 ? HOWL_GROWTH_DB_PER_S * Math.max(over, 0.5) : -Math.max(HOWL_MIN_DECAY_DB_PER_S, -over * 10);
  const start = Number.isFinite(levelDb) ? levelDb : HOWL_FLOOR_DB;
  const next = start + rate * dt;
  return Math.min(HOWL_CAP_DB, Math.max(HOWL_FLOOR_DB, next));
}
