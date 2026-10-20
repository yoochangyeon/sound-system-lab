// 주파수 응답 곡선과 컴프 전달 곡선(SVG). 숫자는 순수 함수가 계산하고 여기서는 그리기만 한다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { logFrequencies } from '../../audio/dsp/biquad';

const H = 140;

/** 부모 폭을 따라가는 SVG 폭(글자가 늘어나지 않게 viewBox를 실제 픽셀로 맞춘다). */
function useWidth(initial = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(160, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface ResponseGraphProps {
  /** f(Hz) → dB */
  response: (f: number) => number;
  range?: number; // ±dB
  color?: string;
  /** 표시할 기준선(예: 하울링 주파수) */
  marker?: number;
  height?: number;
}

const GRID_F = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const fxAt = (W: number) => (f: number) => (Math.log(f / 20) / Math.log(1000)) * W;

export function ResponseGraph({ response, range = 18, color = 'var(--fn-eq)', marker, height = H }: ResponseGraphProps) {
  const [box, W] = useWidth();
  const fx = fxAt(W);
  const path = useMemo(() => {
    const freqs = logFrequencies(140);
    return freqs
      .map((f, i) => {
        const db = Math.max(-range, Math.min(range, response(f)));
        const y = height / 2 - (db / range) * (height / 2 - 6);
        return `${i === 0 ? 'M' : 'L'}${fx(f).toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [response, range, height, W]);

  return (
    <div ref={box} style={{ width: '100%' }}>
    <svg className="sim-graph" width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label="주파수 응답 곡선">
      <rect width={W} height={height} fill="#fff" />
      {GRID_F.map((f) => (
        <g key={f}>
          <line x1={fx(f)} x2={fx(f)} y1={0} y2={height} stroke="#eef0f2" />
          <text x={fx(f) + 2} y={height - 3} fill="#8b95a1" fontSize="10">
            {f >= 1000 ? `${f / 1000}k` : f}
          </text>
        </g>
      ))}
      {[-12, -6, 6, 12].map((d) => (
        <line key={d} x1={0} x2={W} y1={height / 2 - (d / range) * (height / 2 - 6)} y2={height / 2 - (d / range) * (height / 2 - 6)} stroke="#f2f4f6" />
      ))}
      <line x1={0} x2={W} y1={height / 2} y2={height / 2} stroke="#d1d6db" />
      {marker && <line x1={fx(marker)} x2={fx(marker)} y1={0} y2={height} stroke="#f04452" strokeDasharray="3 3" />}
      <path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </svg>
    </div>
  );
}

export interface TransferGraphProps {
  /** 입력 dB → 출력 dB */
  transfer: (inDb: number) => number;
  thresholdDb: number;
  /** 지금 입력 레벨(점으로 표시) */
  current?: number;
  color?: string;
}

export function TransferGraph({ transfer, thresholdDb, current, color = 'var(--fn-dyn)' }: TransferGraphProps) {
  const S = 140;
  const MIN = -60;
  const map = (d: number) => ((Math.min(0, Math.max(MIN, d)) - MIN) / -MIN) * S;
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let d = MIN; d <= 0; d += 1) pts.push(`${pts.length ? 'L' : 'M'}${map(d)},${S - map(transfer(d))}`);
    return pts.join(' ');
  }, [transfer]);
  return (
    <svg className="sim-graph sim-graph-square" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="입력-출력 전달 곡선">
      <rect width={S} height={S} fill="#fff" />
      <line x1={0} y1={S} x2={S} y2={0} stroke="#e5e8eb" strokeDasharray="3 3" />
      <line x1={map(thresholdDb)} x2={map(thresholdDb)} y1={0} y2={S} stroke="#d1d6db" />
      <path d={path} stroke={color} strokeWidth={2.5} fill="none" />
      {current !== undefined && Number.isFinite(current) && (
        <circle cx={map(current)} cy={S - map(transfer(current))} r={4} fill="#191f28" />
      )}
      <text x={4} y={12} fill="#8b95a1" fontSize="10">
        출력
      </text>
      <text x={S - 26} y={S - 4} fill="#8b95a1" fontSize="10">
        입력
      </text>
    </svg>
  );
}
