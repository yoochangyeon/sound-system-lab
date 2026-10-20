// RTA: 31밴드 막대(Canvas). 하울링처럼 한 밴드가 계속 혼자 튀어나오면 그 막대 하나만 빨갛게, 주파수 글자를 붙여 보인다.
import { useRef } from 'react';
import { GEQ_FREQS, formatHz } from '../../audio/dsp/geq';
import { prepCanvas, useFrame } from './useFrame';

export interface RtaProps {
  read: () => number[];
  active?: boolean;
  height?: number;
  /** 보여 줄 밴드 범위(dLive 스타일은 28밴드) */
  first?: number;
  last?: number;
}

const MIN = -90;
const MAX = -10;
/** 이웃을 뺀 다음 큰 막대보다 이만큼 커야 '튀어나온' 막대로 본다(dB). */
const STANDOUT_DB = 4;
/** 같은 막대가 이만큼 계속 가장 커야 빨갛게 한다(ms). 음악의 순간 튀는 음은 1초를 못 넘긴다. */
const HOLD_MS = 1500;

/** 가장 큰 막대 위치와, 이웃을 뺀 다음 큰 막대보다 얼마나 큰지(dB). 소리가 너무 작으면 top은 −1. */
export function standout(level: number[]): { top: number; margin: number } {
  let top = -1;
  for (let k = 0; k < level.length; k++) if (top < 0 || level[k] > level[top]) top = k;
  if (top < 0 || level[top] <= -40) return { top: -1, margin: 0 };
  let next = -Infinity;
  for (let k = 0; k < level.length; k++) if (Math.abs(k - top) > 1) next = Math.max(next, level[k]);
  return { top, margin: level[top] - next };
}

export function Rta({ read, active = true, height = 120, first = 0, last = GEQ_FREQS.length - 1 }: RtaProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const smooth = useRef<number[]>([]);
  const held = useRef({ band: -1, since: 0 });
  const lit = useRef(-1);

  useFrame(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    const width = box.clientWidth;
    const g = prepCanvas(el, width, height);
    if (!g) return;
    const bands = read();
    const n = last - first + 1;
    const bw = width / n;
    g.clearRect(0, 0, width, height);
    const level: number[] = [];
    for (let i = first; i <= last; i++) {
      const v = Number.isFinite(bands[i]) ? bands[i] : MIN;
      const prev = smooth.current[i] ?? MIN;
      const s = v > prev ? v : prev - 0.8;
      smooth.current[i] = s;
      level.push(s);
    }
    const { top, margin } = standout(level);
    const now = performance.now();
    if (top !== held.current.band) held.current = { band: top, since: now };
    // 한 번 빨갛게 된 막대는 여전히 가장 큰 축(3 dB 안)에 있으면 그대로 둔다. 음악이 잠깐 더 커져도 깜빡이지 않게.
    const keep = lit.current >= 0 && top >= 0 && level[lit.current] >= level[top] - 3;
    lit.current = keep ? lit.current : top >= 0 && margin >= STANDOUT_DB && now - held.current.since >= HOLD_MS ? top : -1;
    const hot = lit.current;
    const barTop = (s: number) => height - 12 - ((Math.max(0, Math.min(1, (s - MIN) / (MAX - MIN))) * (height - 14)) | 0);
    level.forEach((s, k) => {
      const y = barTop(s);
      g.fillStyle = k === hot ? '#f04452' : '#1bc47d';
      g.fillRect(k * bw + 1, y, Math.max(1, bw - 2), height - 12 - y);
    });
    g.fillStyle = '#8b95a1';
    g.font = '10px Pretendard Variable, system-ui';
    g.textAlign = 'center';
    for (let i = first; i <= last; i += 3) g.fillText(formatHz(GEQ_FREQS[i]), (i - first + 0.5) * bw, height - 2);
    if (hot >= 0) {
      // 튀어나온 막대 위에 주파수를 붙인다. 막대 글자가 세 칸마다라 세어 읽지 않게 한다.
      g.fillStyle = '#f04452';
      g.font = '700 11px Pretendard Variable, system-ui';
      g.textAlign = hot < 2 ? 'left' : hot > n - 3 ? 'right' : 'center';
      g.fillText(formatHz(GEQ_FREQS[first + hot]), (hot + 0.5) * bw, Math.max(11, barTop(level[hot]) - 3));
    }
  }, active);

  return (
    <div className="sim-rta" ref={wrap}>
      <canvas ref={canvas} style={{ width: '100%', height }} aria-label="RTA: 주파수별 크기" />
    </div>
  );
}
