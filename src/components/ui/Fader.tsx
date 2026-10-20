// 세로 페이더(SVG). 콘솔 페이더처럼 −∞~+10 dB, 0 dB 근처가 넓다.
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { capture } from './pointer';
import { faderToNorm, fmtDb, normToFader } from './scale';

export interface FaderProps {
  label: string;
  value: number;
  onChange: (db: number) => void;
  height?: number;
  color?: string;
  max?: number;
}

export function Fader({ label, value, onChange, height = 160, color = 'var(--panel-text)' }: FaderProps) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const w = 34;
  const pad = 10;
  const track = height - pad * 2;
  const norm = faderToNorm(value);
  const capY = pad + (1 - norm) * track;

  const fromEvent = (e: PointerEvent<SVGSVGElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * height;
    onChange(normToFader(1 - (y - pad) / track));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowUp') onChange(normToFader(norm + d));
    else if (e.key === 'ArrowDown') onChange(normToFader(norm - d));
    else return;
    e.preventDefault();
  };

  return (
    <div className="sim-fader">
      <svg
        ref={ref}
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={-90}
        aria-valuemax={10}
        aria-valuenow={Number.isFinite(value) ? value : -90}
        aria-valuetext={fmtDb(value)}
        aria-orientation="vertical"
        onPointerDown={(e) => {
          dragging.current = true;
          capture(e.currentTarget, e.pointerId);
          fromEvent(e);
        }}
        onPointerMove={(e) => dragging.current && fromEvent(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={onKey}
        onDoubleClick={() => onChange(0)}
      >
        <rect x={w / 2 - 2} y={pad} width={4} height={track} rx={2} fill="var(--panel-line)" />
        <line x1={4} x2={w - 4} y1={pad + (1 - faderToNorm(0)) * track} y2={pad + (1 - faderToNorm(0)) * track} stroke="var(--panel-muted)" strokeWidth={1} />
        <rect x={3} y={capY - 9} width={w - 6} height={18} rx={3} fill="var(--panel-raised)" stroke={color} strokeWidth={1.5} />
        <line x1={7} x2={w - 7} y1={capY} y2={capY} stroke={color} strokeWidth={2} />
      </svg>
      <div className="sim-fader-value">{fmtDb(value)}</div>
    </div>
  );
}
