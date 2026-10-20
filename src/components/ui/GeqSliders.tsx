// GEQ 슬라이더 묶음. 휴대폰에서는 이 묶음 안에서만 가로로 스크롤된다.
import { GEQ_FREQS, formatHz } from '../../audio/dsp/geq';
import type { Range } from '../../consoles/profile';

export interface GeqSlidersProps {
  gains: number[];
  range: Range;
  onChange: (band: number, db: number) => void;
  first?: number;
  last?: number;
}

export function GeqSliders({ gains, range, onChange, first = 0, last = GEQ_FREQS.length - 1 }: GeqSlidersProps) {
  const bands = [];
  for (let i = first; i <= last; i++) {
    const v = gains[i] ?? 0;
    bands.push(
      <label key={i} className={`sim-geq-band${v < 0 ? ' is-cut' : ''}`}>
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={v}
          aria-label={`${formatHz(GEQ_FREQS[i])}Hz 밴드`}
          aria-valuetext={`${v > 0 ? '+' : ''}${v} dB`}
          onChange={(e) => onChange(i, Number(e.target.value))}
          onDoubleClick={() => onChange(i, 0)}
        />
        <span>{formatHz(GEQ_FREQS[i])}</span>
        <span>{v === 0 ? '0' : v > 0 ? `+${v}` : v}</span>
      </label>,
    );
  }
  return <div className="sim-geq">{bands}</div>;
}
