// 프리엠프 위젯(#9). 게인을 너무 올리면 입력 미터에 클리핑이 켜지고 실제로 깨진 소리가 난다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { inputPeakDb } from '../../stores/derived';
import { Knob } from '../ui/Knob';
import { Meter } from '../ui/Meter';
import { fmtDb } from '../ui/scale';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

export default function PreampWidget({ defaultStem = 'drums' }: { defaultStem?: string }) {
  const store = useMemo(() => createWidgetStore({ stems: ['drums', 'vocals', 'guitar-main', 'keys', 'shaker'], defaultStem }), [defaultStem]);
  const ch = useStore(store, (s) => s.channels[0]);
  const ranges = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const estPeak = useStore(store, (s) => inputPeakDb(s, 0));

  const verdict =
    estPeak >= 0 ? { cls: 'is-warn', text: '클리핑: 소리가 깨진다. 게인을 내린다.' } : estPeak < -24 ? { cls: '', text: '너무 작다: 잡음에 묻히기 쉽다. 게인을 올린다.' } : { cls: 'is-on', text: '적당하다: 피크에 여유(헤드룸)가 있다.' };

  return (
    <WidgetShell
      title="프리엠프 (게인)"
      accent="var(--fn-preamp)"
      store={store}
      footer="미터 맨 위 빨간 칸이 켜지면 0 dBFS를 넘은 것이다. 한 번 깨진 소리는 뒤에서 페이더를 내려도 돌아오지 않는다."
    >
      {({ engine, status }) => (
        <div className="sim-row is-center" style={{ gap: 18 }}>
          <Knob
            label="게인"
            value={ch.preamp.gainDb}
            range={ranges.gain}
            onChange={(v) => a.setPreamp(0, { gainDb: v })}
            color="var(--fn-preamp)"
            size={72}
            defaultValue={0}
          />
          <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={status === 'playing'} height={150} width={16} label="입력" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180, flex: '1 1 180px' }}>
            <span className={`sim-lamp ${verdict.cls}`}>{verdict.text}</span>
            <span className="sim-stat">
              이 음원의 예상 피크: <strong>{Number.isFinite(estPeak) ? fmtDb(estPeak).replace(' dB', ' dBFS') : '—'}</strong>
            </span>
            <span className="sim-stat">권장: 피크 −18 ~ −6 dBFS</span>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
