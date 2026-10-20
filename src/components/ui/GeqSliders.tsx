// GEQ 슬라이더 묶음. 휴대폰에서는 이 묶음 안에서만 가로로 스크롤된다.
// 다 안 보일 때는 가려진 쪽 가장자리를 흐리게 하고, 옆으로 밀라는 안내를 붙인다.
import { useEffect, useRef, useState } from 'react';
import { GEQ_FREQS, formatHz } from '../../audio/dsp/geq';
import type { Range } from '../../stores/profile';

export interface GeqSlidersProps {
  gains: number[];
  range: Range;
  onChange: (band: number, db: number) => void;
  first?: number;
  last?: number;
}

export function GeqSliders({ gains, range, onChange, first = 0, last = GEQ_FREQS.length - 1 }: GeqSlidersProps) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setMore({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);
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
  const cls = `sim-geq${more.left ? ' has-more-left' : ''}${more.right ? ' has-more-right' : ''}`;
  return (
    <>
      <div className={cls} ref={box}>
        {bands}
      </div>
      {(more.left || more.right) && (
        <p className="sim-geq-hint">
          ← 옆으로 밀면 {last - first + 1}밴드({formatHz(GEQ_FREQS[first])}~{formatHz(GEQ_FREQS[last])} Hz)가 모두 보인다 →
        </p>
      )}
    </>
  );
}
