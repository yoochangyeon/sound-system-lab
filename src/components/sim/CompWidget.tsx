// 컴프레서 위젯(#10, 2차 개편 #35). 스레숄드·레이시오만 보이고, 나머지는 '더 자세히'.
// 입력·GR·출력 미터와 전달 곡선을 본다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { compTransferDb } from '../../audio/dsp/dynamics';
import { More, Slider, Tabs } from '../ui/controls';
import { TransferGraph } from '../ui/CurveGraph';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

export default function CompWidget() {
  const store = useMemo(
    () =>
      createWidgetStore({
        roles: ['lead-vocal', 'bass', 'snare', 'guitar'],
        initial: { channels: { 0: { comp: { on: true, thresholdDb: -28, ratio: 4, attackMs: 10, releaseMs: 150, makeupDb: 4 } } } },
      }),
    [],
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
          <div className="sim-visual" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <TransferGraph transfer={transfer} thresholdDb={c.thresholdDb} />
            <div className="sim-meters">
              <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={status === 'playing'} height={130} label="입력" />
              <Meter read={() => engine?.compGrDb(0) ?? 0} active={status === 'playing'} height={130} min={-24} reduction label="GR" />
              <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={130} label="출력" />
            </div>
          </div>
          <div className="sim-sliders is-2">
            <Slider label="스레숄드" hint="이 크기를 넘는 소리부터 누른다" value={c.thresholdDb} range={ranges.compThreshold} onChange={(v) => set({ thresholdDb: v })} color={color} defaultValue={-20} />
            <Slider label="레이시오" hint="넘친 만큼을 몇 분의 1로 줄일지" value={c.ratio} range={ranges.ratio} onChange={(v) => set({ ratio: v })} color={color} defaultValue={3} />
          </div>
          <More label="더 자세히: 어택·릴리스·메이크업 등">
            <Slider label="어택" hint="넘은 뒤 누르기 시작하기까지" value={c.attackMs} range={ranges.compAttack} onChange={(v) => set({ attackMs: v })} color={color} defaultValue={10} />
            <Slider label="릴리스" hint="작아진 뒤 누르기를 풀기까지" value={c.releaseMs} range={ranges.compRelease} onChange={(v) => set({ releaseMs: v })} color={color} defaultValue={150} />
            <Slider label="메이크업" hint="눌러서 작아진 만큼 다시 올리기" value={c.makeupDb} range={ranges.makeup} onChange={(v) => set({ makeupDb: v })} color={color} defaultValue={0} />
            <Slider label="니" hint="누르기 시작하는 경계를 얼마나 부드럽게" value={c.kneeDb} range={ranges.knee} onChange={(v) => set({ kneeDb: v })} color={color} defaultValue={2} />
            <div>
              <span className="sim-stat">검출 방식</span>
              <Tabs
                label="검출 방식"
                items={[
                  { id: 'peak' as const, label: 'Peak 순간 최대값' },
                  { id: 'rms' as const, label: 'RMS 평균 크기' },
                ]}
                value={c.detector}
                onChange={(d) => set({ detector: d })}
              />
            </div>
          </More>
        </>
      )}
    </WidgetShell>
  );
}
