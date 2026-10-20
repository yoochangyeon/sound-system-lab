// 노브·페이더 값 ↔ 0~1 위치, 값 표시 형식.
import type { Range } from '../../stores/profile';

export function toNorm(v: number, r: Pick<Range, 'min' | 'max' | 'log'>): number {
  if (v === -Infinity) return 0;
  const x = Math.min(r.max, Math.max(r.min, v));
  if (r.log && r.min > 0) return Math.log(x / r.min) / Math.log(r.max / r.min);
  return (x - r.min) / (r.max - r.min);
}

export function fromNorm(n: number, r: Pick<Range, 'min' | 'max' | 'step' | 'log'>): number {
  const t = Math.min(1, Math.max(0, n));
  let v = r.log && r.min > 0 ? r.min * Math.pow(r.max / r.min, t) : r.min + t * (r.max - r.min);
  if (r.step > 0) v = Math.round(v / r.step) * r.step;
  return Math.min(r.max, Math.max(r.min, +v.toFixed(6)));
}

/** 페이더 눈금: 아래쪽을 넓게 쓰지 않도록 -∞~+10 dB를 구간별로 나눈다(콘솔 페이더와 비슷한 감각). */
const FADER_POINTS: [number, number][] = [
  [-90, 0],
  [-60, 0.08],
  [-40, 0.2],
  [-20, 0.42],
  [-10, 0.6],
  [-5, 0.7],
  [0, 0.8],
  [5, 0.9],
  [10, 1],
];

export function faderToNorm(db: number): number {
  if (db === -Infinity || db <= -90) return 0;
  for (let i = 1; i < FADER_POINTS.length; i++) {
    const [d1, n1] = FADER_POINTS[i];
    const [d0, n0] = FADER_POINTS[i - 1];
    if (db <= d1) return n0 + ((db - d0) / (d1 - d0)) * (n1 - n0);
  }
  return 1;
}

export function normToFader(n: number, step = 0.5): number {
  if (n <= 0.005) return -Infinity;
  for (let i = 1; i < FADER_POINTS.length; i++) {
    const [d1, n1] = FADER_POINTS[i];
    const [d0, n0] = FADER_POINTS[i - 1];
    if (n <= n1) return Math.round((d0 + ((n - n0) / (n1 - n0)) * (d1 - d0)) / step) * step;
  }
  return 10;
}

export function fmtDb(v: number, digits = 1): string {
  if (v === -Infinity) return '−∞ dB';
  const s = v.toFixed(digits);
  return `${v > 0 ? '+' : ''}${s.replace('-', '−')} dB`;
}

export function fmtHz(v: number): string {
  if (v >= 1000) return `${+(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz`;
  return `${Math.round(v)} Hz`;
}

export function fmtMs(v: number): string {
  return v >= 1000 ? `${+(v / 1000).toFixed(2)} s` : `${+v.toFixed(v < 10 ? 1 : 0)} ms`;
}

export function fmtRatio(v: number): string {
  return `${+v.toFixed(1)}:1`;
}

export function fmtUnit(v: number, unit: string): string {
  switch (unit) {
    case 'dB':
      return fmtDb(v);
    case 'Hz':
      return fmtHz(v);
    case 'ms':
      return fmtMs(v);
    case ':1':
      return fmtRatio(v);
    case 's':
      return `${v.toFixed(1)} s`;
    case '%':
      return `${Math.round(v)}%`;
    default:
      return `${+v.toFixed(2)}`;
  }
}

/** 프로필 범위의 단위·표시 오프셋대로 값을 보여 준다. */
export function fmtRange(v: number, r: Pick<Range, 'unit' | 'offset'>): string {
  const shown = Number.isFinite(v) ? v + (r.offset ?? 0) : v;
  if (r.unit === 'dBu') return fmtDb(shown).replace(' dB', ' dBu');
  return fmtUnit(shown, r.unit);
}

/** 입력 피크(dBFS) 판정. 레슨·LevelZones·게인 미션과 같은 구간: −18 ~ −6 알맞다, −6 ~ 0 아슬아슬. */
export function inputVerdict(peakDb: number): { cls: string; text: string; short: string } {
  if (peakDb >= 0) return { cls: 'is-warn', text: '클리핑: 소리가 깨진다', short: '클리핑' };
  if (peakDb > -6) return { cls: 'is-caution', text: '아슬아슬: 여유가 거의 없다', short: '아슬아슬' };
  if (peakDb < -18) return { cls: '', text: '너무 작다: 잡음에 묻힌다', short: '너무 작다' };
  return { cls: 'is-on', text: '알맞다: 여유가 있다', short: '알맞다' };
}
