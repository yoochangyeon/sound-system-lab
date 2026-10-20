// 세로 레벨 미터(Canvas). 매 프레임 read()로 dBFS를 읽어 그린다.
// 피크 홀드와 클리핑 표시(0 dBFS 이상이면 위쪽 빨간 칸이 1.5초 켜짐)가 있다.
import { useRef } from 'react';
import { prepCanvas, useFrame } from './useFrame';

export interface MeterProps {
  read: () => number;
  active?: boolean;
  height?: number;
  width?: number;
  min?: number;
  max?: number;
  label?: string;
  /** 위에서 아래로 차는 GR 미터 */
  reduction?: boolean;
  color?: string;
}

const CLIP_HOLD_MS = 1500;

export function Meter({ read, active = true, height = 140, width = 14, min = -60, max = 6, label, reduction, color }: MeterProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ level: min, peak: min, peakT: 0, clipT: -1e9 });

  useFrame((t) => {
    const el = canvas.current;
    if (!el) return;
    const g = prepCanvas(el, width, height);
    if (!g) return;
    const s = state.current;
    const v = read();
    const db = Number.isFinite(v) ? v : min;
    // 올라갈 때는 바로, 내려갈 때는 천천히(초당 약 20 dB)
    s.level = db > s.level ? db : Math.max(db, s.level - 0.35);
    if (db >= s.peak || t - s.peakT > 1200) {
      s.peak = db;
      s.peakT = t;
    }
    if (!reduction && db >= 0) s.clipT = t;

    const clipBox = reduction ? 0 : 6;
    const h = height - clipBox;
    const y = (d: number) => clipBox + (1 - (Math.min(max, Math.max(min, d)) - min) / (max - min)) * h;

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#0c0d10';
    g.fillRect(0, 0, width, height);

    if (reduction) {
      // GR: 0 dB(위)에서 아래로 찬다. min~0 범위.
      const gr = Math.max(min, Math.min(0, db));
      const yy = (gr / min) * height;
      g.fillStyle = color ?? '#f59e0b';
      g.fillRect(1, 0, width - 2, yy);
    } else {
      const top = y(s.level);
      const grad = g.createLinearGradient(0, height, 0, clipBox);
      grad.addColorStop(0, '#22c55e');
      grad.addColorStop((-18 - min) / (max - min), '#22c55e');
      grad.addColorStop((-6 - min) / (max - min), '#eab308');
      grad.addColorStop((0 - min) / (max - min), '#ef4444');
      grad.addColorStop(1, '#ef4444');
      g.fillStyle = grad;
      g.fillRect(1, top, width - 2, height - top);
      g.fillStyle = '#e9eaee';
      g.fillRect(1, y(s.peak) - 1, width - 2, 2);
      g.fillStyle = t - s.clipT < CLIP_HOLD_MS ? '#ef4444' : '#3a1515';
      g.fillRect(1, 0, width - 2, clipBox - 1);
      // 0 dBFS, −18 dBFS 눈금
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, y(0), width, 1);
      g.fillRect(0, y(-18), width, 1);
    }
  }, active);

  return (
    <div className="sim-meter" style={{ width: Math.max(width, 28) }}>
      <canvas ref={canvas} style={{ width, height }} aria-hidden="true" />
      {label && <div className="sim-meter-label">{label}</div>}
    </div>
  );
}
