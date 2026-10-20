// 2차 개편 조작부: 가로 슬라이더, 켜기/끄기 스위치, '더 자세히' 접기, 탭.
// 노브 대신 손가락으로 끌기 쉬운 가로 슬라이더를 쓴다(기획서 10장).
import type { CSSProperties, ReactNode } from 'react';
import type { Range } from '../../stores/profile';
import { faderToNorm, fmtRange, fromNorm, normToFader, toNorm } from './scale';

const STEPS = 1000;

export interface SliderProps {
  label: string;
  value: number;
  range: Range;
  onChange: (v: number) => void;
  /** 이름 아래 한 줄 뜻 */
  hint?: string;
  color?: string;
  defaultValue?: number;
  format?: (v: number) => string;
  disabled?: boolean;
  /** 'fader'면 콘솔 페이더 눈금(−∞~+10 dB, 0 dB 근처가 넓다)을 쓴다 */
  scale?: 'fader';
}

export function Slider({ label, value, range, onChange, hint, color, defaultValue, format, disabled, scale }: SliderProps) {
  const isFader = scale === 'fader';
  const norm = isFader ? faderToNorm(value) : toNorm(value, range);
  const text = format ? format(value) : fmtRange(value, range);
  const style = { '--fill': `${(norm * 100).toFixed(1)}%`, ...(color ? { '--accent-fn': color } : {}) } as CSSProperties;
  return (
    <label className={`sim-slider${disabled ? ' is-disabled' : ''}`} style={style}>
      <span className="sim-slider-top">
        <span className="sim-slider-label">{label}</span>
        <span className="sim-slider-value">{text}</span>
      </span>
      {hint && <span className="sim-slider-hint">{hint}</span>}
      <input
        type="range"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(norm * STEPS)}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={text}
        onChange={(e) => {
          const n = Number(e.target.value) / STEPS;
          onChange(isFader ? normToFader(n) : fromNorm(n, range));
        }}
        onDoubleClick={() => defaultValue !== undefined && !disabled && onChange(defaultValue)}
      />
    </label>
  );
}

export function Switch({ on, onChange, label, color }: { on: boolean; onChange: (on: boolean) => void; label?: string; color?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`sim-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
      style={color ? ({ '--accent-fn': color } as CSSProperties) : undefined}
    >
      {label && <span>{label}</span>}
      <span className="sim-switch-track" aria-hidden="true" />
    </button>
  );
}

export function More({ children, label = '더 자세히' }: { children: ReactNode; label?: string }) {
  return (
    <details className="sim-more">
      <summary>{label}</summary>
      <div className="sim-more-body">{children}</div>
    </details>
  );
}

export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="sim-tabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={String(it.id)} type="button" role="tab" aria-selected={value === it.id} className={value === it.id ? 'is-active' : ''} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
