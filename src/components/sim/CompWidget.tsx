// 컴프레서 위젯(#10). 스레숄드·레이시오·니·어택·릴리스·메이크업·검출 방식을 바꾸며
// 입력·출력 미터, GR 미터, 전달 곡선을 본다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { compTransferDb } from '../../audio/dsp/dynamics';
import { Knob } from '../ui/Knob';
import { TransferGraph } from '../ui/CurveGraph';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

export default function CompWidget({ defaultStem = 'vocals' }: { defaultStem?: string }) {
  const store = useMemo(
    () =>
      createWidgetStore({
        stems: ['vocals', 'sermon', 'bass', 'guitar-main', 'drums'],
        defaultStem,
        initial: { channels: { 0: { comp: { on: true, thresholdDb: -28, ratio: 4, attackMs: 10, releaseMs: 150, makeupDb: 4 } } } },
      }),
    [defaultStem],
  );
  const c = useStore(store, (s) => s.channels[0].comp);
  const ranges = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const transfer = useMemo(() => (d: number) => compTransferDb(d, c), [c]);
  const set = (p: Partial<typeof c>) => a.setComp(0, p);
  const color = 'var(--fn-dyn)';

  return (
    <WidgetShell
      title="컴프레서"
      accent={color}
      store={store}
      bypassed={!c.on}
      onBypass={() => set({ on: !c.on })}
      footer="GR(게인 리덕션)은 컴프레서가 지금 몇 dB를 누르고 있는지다. 큰 소리에서만 GR이 움직이면 잘 걸린 것이다."
    >
      {({ engine, status }) => (
        <>
          <div className="sim-row is-center" style={{ gap: 12 }}>
            <TransferGraph transfer={transfer} thresholdDb={c.thresholdDb} />
            <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={status === 'playing'} height={140} label="입력" />
            <Meter
              read={() => engine?.compGrDb(0) ?? 0}
              active={status === 'playing'}
              height={140}
              min={-24}
              reduction
              label="GR"
            />
            <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={140} label="출력" />
          </div>
          <div className="sim-row">
            <Knob label="스레숄드" value={c.thresholdDb} range={ranges.compThreshold} onChange={(v) => set({ thresholdDb: v })} color={color} defaultValue={-20} />
            <Knob label="레이시오" value={c.ratio} range={ranges.ratio} onChange={(v) => set({ ratio: v })} color={color} defaultValue={3} />
            <Knob label="니" value={c.kneeDb} range={ranges.knee} onChange={(v) => set({ kneeDb: v })} color={color} defaultValue={2} />
            <Knob label="어택" value={c.attackMs} range={ranges.compAttack} onChange={(v) => set({ attackMs: v })} color={color} defaultValue={10} />
            <Knob label="릴리스" value={c.releaseMs} range={ranges.compRelease} onChange={(v) => set({ releaseMs: v })} color={color} defaultValue={150} />
            <Knob label="메이크업" value={c.makeupDb} range={ranges.makeup} onChange={(v) => set({ makeupDb: v })} color={color} defaultValue={0} />
          </div>
          <div className="sim-row is-center">
            <span className="sim-stat">검출 방식</span>
            {(['peak', 'rms'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={`sim-btn is-small${c.detector === d ? ' is-active' : ''}`}
                aria-pressed={c.detector === d}
                onClick={() => set({ detector: d })}
              >
                {d === 'peak' ? 'Peak (순간 최대값)' : 'RMS (평균 크기)'}
              </button>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  );
}
