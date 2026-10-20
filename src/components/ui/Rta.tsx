// RTA: 31밴드 막대(Canvas). 하울링처럼 튀어나온 밴드가 한눈에 보인다.
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

export function Rta({ read, active = true, height = 120, first = 0, last = GEQ_FREQS.length - 1 }: RtaProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const smooth = useRef<number[]>([]);

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
    g.fillStyle = '#0c0d10';
    g.fillRect(0, 0, width, height);
    let maxDb = -Infinity;
    for (let i = first; i <= last; i++) maxDb = Math.max(maxDb, bands[i] ?? MIN);
    for (let i = first; i <= last; i++) {
      const v = Number.isFinite(bands[i]) ? bands[i] : MIN;
      const prev = smooth.current[i] ?? MIN;
      const s = v > prev ? v : prev - 0.8;
      smooth.current[i] = s;
      const hh = (Math.max(0, Math.min(1, (s - MIN) / (MAX - MIN))) * (height - 14)) | 0;
      const x = (i - first) * bw;
      const loud = s > maxDb - 3 && s > -40;
      g.fillStyle = loud ? '#ef4444' : '#22c55e';
      g.fillRect(x + 1, height - 12 - hh, Math.max(1, bw - 2), hh);
    }
    g.fillStyle = '#9a9ea8';
    g.font = '9px system-ui';
    g.textAlign = 'center';
    for (let i = first; i <= last; i += 3) g.fillText(formatHz(GEQ_FREQS[i]), (i - first + 0.5) * bw, height - 2);
  }, active);

  return (
    <div className="sim-rta" ref={wrap}>
      <canvas ref={canvas} style={{ width: '100%', height }} aria-label="RTA: 주파수별 크기" />
    </div>
  );
}
