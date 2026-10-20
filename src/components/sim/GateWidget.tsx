// 게이트 위젯(#11, 2차 개편 #35). 드럼 킷 트랙(킥·스네어가 나뉘지 않은 한 트랙)에 게이트를 걸어
// 타격 사이의 잔향·잡음이 줄어드는 것을 듣는다. 스레숄드만 보이고 나머지는 '더 자세히'.
import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { More, Slider } from '../ui/controls';
import { Meter } from '../ui/Meter';
import { useFrame } from '../ui/useFrame';
import type { MixerEngine } from '../../audio/engine';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

function GateLamp({ engine, active }: { engine: MixerEngine | null; active: boolean }) {
  const [open, setOpen] = useState(false);
  const last = useRef(false);
  useFrame(() => {
    const v = engine?.gateOpen(0) ?? false;
    if (v !== last.current) {
      last.current = v;
      setOpen(v);
    }
  }, active);
  return <span className={`sim-lamp ${active && open ? 'is-on' : ''}`}>{active ? (open ? '열림: 소리 통과' : '닫힘: 줄이는 중') : '재생하면 문 상태가 보인다'}</span>;
}

export default function GateWidget({ defaultStem = 'drums' }: { defaultStem?: string }) {
  const store = useMemo(
    () =>
      createWidgetStore({
        stems: ['drums', 'percussion', 'guitar-main', 'vocals'],
        defaultStem,
        initial: { channels: { 0: { gate: { on: true, thresholdDb: -24, rangeDb: 30, attackMs: 1, holdMs: 60, releaseMs: 120 } } } },
      }),
    [defaultStem],
  );
  const g = useStore(store, (s) => s.channels[0].gate);
  const ranges = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const set = (p: Partial<typeof g>) => a.setGate(0, p);
  const color = 'var(--fn-dyn)';

  return (
    <WidgetShell
      title="게이트"
      accent={color}
      store={store}
      bypassed={!g.on}
      onBypass={() => set({ on: !g.on })}
      footer="스레숄드보다 작은 소리가 들어오면 문을 닫아 레인지만큼 줄인다. 홀드는 소리가 작아진 뒤에도 문을 열어 두는 시간이다."
    >
      {({ engine, status }) => (
        <>
          <div className="sim-visual" style={{ alignItems: 'center' }}>
            <div className="sim-meters">
              <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={status === 'playing'} height={120} label="입력" />
              <Meter read={() => engine?.gateGrDb(0) ?? 0} active={status === 'playing'} height={120} min={-60} reduction label="GR" />
              <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={120} label="출력" />
            </div>
            <div className="grow" style={{ display: 'flex', justifyContent: 'center' }}>
              <GateLamp engine={engine} active={status === 'playing' && g.on} />
            </div>
          </div>
          <Slider label="스레숄드" hint="이보다 작은 소리면 문을 닫는다" value={g.thresholdDb} range={ranges.gateThreshold} onChange={(v) => set({ thresholdDb: v })} color={color} defaultValue={-40} />
          <More label="더 자세히: 레인지·어택·홀드·릴리스">
            <Slider label="레인지" hint="닫혔을 때 얼마나 줄일지" value={g.rangeDb} range={ranges.gateRange} onChange={(v) => set({ rangeDb: v })} color={color} defaultValue={40} />
            <Slider label="어택" hint="문이 열리는 데 걸리는 시간" value={g.attackMs} range={ranges.gateAttack} onChange={(v) => set({ attackMs: v })} color={color} defaultValue={1} />
            <Slider label="홀드" hint="작아진 뒤에도 문을 열어 두는 시간" value={g.holdMs} range={ranges.gateHold} onChange={(v) => set({ holdMs: v })} color={color} defaultValue={50} />
            <Slider label="릴리스" hint="문이 닫히는 데 걸리는 시간" value={g.releaseMs} range={ranges.gateRelease} onChange={(v) => set({ releaseMs: v })} color={color} defaultValue={150} />
          </More>
        </>
      )}
    </WidgetShell>
  );
}
