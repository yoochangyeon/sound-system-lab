// 프리엠프 위젯(#9, 2차 개편 #35). 게인 슬라이더 하나. 너무 올리면 입력 미터에 클리핑이 켜지고 실제로 깨진 소리가 난다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { inputPeakDb } from '../../stores/derived';
import { Slider } from '../ui/controls';
import { Meter } from '../ui/Meter';
import { fmtDb, inputVerdict } from '../ui/scale';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

export default function PreampWidget() {
  const store = useMemo(() => createWidgetStore({ roles: ['snare', 'lead-vocal', 'guitar', 'bass', 'kick'], initial: { channels: { 0: { preamp: { gainDb: -20 } } } } }), []);
  const ch = useStore(store, (s) => s.channels[0]);
  const ranges = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const estPeak = useStore(store, (s) => inputPeakDb(s, 0));

  const verdict = inputVerdict(estPeak);

  return (
    <WidgetShell
      title="프리엠프 (게인)"
      accent="var(--fn-preamp)"
      store={store}
      footer="미터 맨 위 빨간 칸이 켜지면 0 dBFS를 넘은 것이다. 한 번 깨진 소리는 뒤에서 페이더를 내려도 돌아오지 않는다."
    >
      {({ engine, status }) => (
        <>
          <div className="sim-visual">
            <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={status === 'playing'} height={132} width={16} label="입력" />
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
              <span className={`sim-lamp ${verdict.cls}`}>{verdict.text}</span>
              <span className="sim-stat">
                가장 큰 순간(예상 피크) <strong>{Number.isFinite(estPeak) ? fmtDb(estPeak).replace(' dB', ' dBFS') : '—'}</strong>
              </span>
              <span className="sim-stat">목표: −18 ~ −6 dBFS</span>
            </div>
          </div>
          <Slider
            label="게인"
            hint="마이크 신호를 얼마나 키울지"
            value={ch.preamp.gainDb}
            range={ranges.gain}
            onChange={(v) => a.setPreamp(0, { gainDb: v })}
            color="var(--fn-preamp)"
            defaultValue={-20}
          />
        </>
      )}
    </WidgetShell>
  );
}
