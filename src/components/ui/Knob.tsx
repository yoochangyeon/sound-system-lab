// SVG 노브. 위아래로 끌면(마우스·터치) 값이 바뀐다. 키보드 화살표도 된다. 더블클릭하면 기본값.
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { Range } from '../../consoles/profile';
import { fmtUnit, fromNorm, toNorm } from './scale';

export interface KnobProps {
  label: string;
  value: number;
  range: Range;
  onChange: (v: number) => void;
  color?: string;
  size?: number;
  defaultValue?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}

const SWEEP = 270; // 도
const START = -135;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function Knob({ label, value, range, onChange, color = 'var(--fn-eq)', size = 56, defaultValue, format, disabled }: KnobProps) {
  const drag = useRef<{ y: number; norm: number } | null>(null);
  const norm = toNorm(value, range);
  const angle = START + norm * SWEEP;
  const c = size / 2;
  const r = size / 2 - 5;

  const setNorm = (n: number) => onChange(fromNorm(n, range));

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, norm };
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const fine = e.shiftKey ? 0.25 : 1;
    const dn = ((drag.current.y - e.clientY) / 160) * fine;
    setNorm(drag.current.norm + dn);
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setNorm(norm + step);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setNorm(norm - step);
    else return;
    e.preventDefault();
  };

  const text = format ? format(value) : fmtUnit(value, range.unit);

  return (
    <div className={`sim-knob${disabled ? ' is-disabled' : ''}`} style={{ width: Math.max(size, 64) }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuenow={Number.isFinite(value) ? value : range.min}
        aria-valuetext={text}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        onDoubleClick={() => defaultValue !== undefined && !disabled && onChange(defaultValue)}
      >
        <circle cx={c} cy={c} r={r} fill="var(--panel-raised)" />
        <path d={arc(c, c, r - 1, START, START + SWEEP)} stroke="var(--panel-line)" strokeWidth={4} fill="none" strokeLinecap="round" />
        {norm > 0.001 && (
          <path d={arc(c, c, r - 1, START, angle)} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" />
        )}
        <line
          x1={c}
          y1={c}
          x2={polar(c, c, r - 8, angle).x}
          y2={polar(c, c, r - 8, angle).y}
          stroke="var(--panel-text)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
      <div className="sim-knob-label">{label}</div>
      <div className="sim-knob-value">{text}</div>
    </div>
  );
}
