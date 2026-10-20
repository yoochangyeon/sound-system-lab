// 클리핑 체험(소리 없이 그림만). 게인 슬라이더를 올리면 파형이 커지고, 0 dBFS 천장을 넘은 부분이 잘린다.
import { useMemo, useState } from 'react';
import './clip-demo.css';

const W = 300;
const H = 120;
const BASE_PEAK_DB = -20; // 게인 0 dB일 때 이 예시 소리의 피크

export default function ClipDemo() {
  const [gain, setGain] = useState(8);
  const peakDb = BASE_PEAK_DB + gain;
  const amp = Math.pow(10, peakDb / 20); // 1 = 천장
  const ceil = H / 2 - 12;

  const { path, clipped } = useMemo(() => {
    let p = '';
    let c = '';
    for (let x = 0; x <= W; x += 2) {
      const t = (x / W) * Math.PI * 6;
      // 크기가 오르내리는 소리(사인 × 포락선)
      const env = 0.55 + 0.45 * Math.sin(t / 3);
      const v = amp * env * Math.sin(t);
      const cv = Math.max(-1, Math.min(1, v));
      const y = H / 2 - cv * ceil;
      p += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`;
      if (Math.abs(v) > 1) c += `M${x},${(H / 2 - Math.sign(v) * ceil).toFixed(1)}l2,0`;
    }
    return { path: p, clipped: c };
  }, [amp, ceil]);

  const state =
    peakDb >= 0
      ? { cls: 'is-red', t: '클리핑! 꼭대기가 잘려 소리가 깨진다' }
      : peakDb > -6
        ? { cls: 'is-yellow', t: '아슬아슬. 여유가 거의 없다' }
        : peakDb >= -18
          ? { cls: 'is-green', t: '알맞음. 큰 순간에도 여유가 있다' }
          : { cls: 'is-grey', t: '너무 작다. 잡음에 묻히기 쉽다' };

  return (
    <div className="clip-demo">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="게인에 따른 파형">
        <rect x="0" y={H / 2 - ceil - 12} width={W} height="12" fill="#fff0f1" />
        <rect x="0" y={H / 2 + ceil} width={W} height="12" fill="#fff0f1" />
        <line x1="0" x2={W} y1={H / 2 - ceil} y2={H / 2 - ceil} stroke="#f04452" strokeDasharray="4 3" />
        <line x1="0" x2={W} y1={H / 2 + ceil} y2={H / 2 + ceil} stroke="#f04452" strokeDasharray="4 3" />
        <text x={W - 4} y={H / 2 - ceil - 3} textAnchor="end" fontSize="9" fill="#f04452" fontWeight="700">
          0 dBFS 천장
        </text>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#e5e8eb" />
        <path d={path} fill="none" stroke="#3182f6" strokeWidth="2" />
        <path d={clipped} fill="none" stroke="#f04452" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className={`clip-state ${state.cls}`}>
        <strong>피크 {peakDb > 0 ? '+' : ''}{peakDb} dBFS</strong>
        <span>{state.t}</span>
      </div>
      <label className="clip-slider">
        <span>
          게인 <b>{gain > 0 ? '+' : ''}{gain} dB</b>
        </span>
        <input type="range" min={-10} max={30} step={1} value={gain} onChange={(e) => setGain(Number(e.target.value))} aria-label="게인" />
      </label>
      <p className="clip-hint">슬라이더를 오른쪽 끝까지 밀어 보세요. 빨간 선을 넘은 부분이 잘립니다.</p>
    </div>
  );
}
