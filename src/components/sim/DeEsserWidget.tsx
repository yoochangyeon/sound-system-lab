// 디에서 위젯(4차 #57). 컴프의 키 필터를 '스·츠' 대역(대역 통과)에 두어, 치찰음이 셀 때만 누른다.
// 키 듣기를 켜면 컴프가 듣는 소리(필터를 지난 소리)만 들린다. 주파수를 맞출 때 쓴다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { More, Slider, Switch } from '../ui/controls';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const COLOR = 'var(--fn-dyn)';

export default function DeEsserWidget() {
  const store = useMemo(
    () =>
      createWidgetStore({
        roles: ['lead-vocal', 'backing-vocal'],
        initial: {
          channels: {
            0: { comp: { on: true, thresholdDb: -40, ratio: 4, kneeDb: 2, attackMs: 1, releaseMs: 60, makeupDb: 0, key: { filter: 'band', freq: 6500 } } },
          },
        },
      }),
    [],
  );
  const c = useStore(store, (s) => s.channels[0].comp);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const set = (p: Parameters<typeof a.setComp>[1]) => a.setComp(0, p);

  return (
    <WidgetShell
      title="디에서"
      accent={COLOR}
      store={store}
      bypassed={!c.on}
      onBypass={() => set({ on: !c.on })}
      footer="디에서는 '스·츠' 같은 치찰음이 셀 때만 잠깐 누르는 컴프다. 컴프가 목소리 전체가 아니라 키 필터를 지난 높은 대역만 듣게 한다."
    >
      {({ engine, status }) => (
        <>
          <div className="sim-visual" style={{ justifyContent: 'center' }}>
            <div className="sim-meters">
              <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={status === 'playing'} height={110} label="입력" />
              <Meter read={() => engine?.compGrDb(0) ?? 0} active={status === 'playing' && c.on} height={110} min={-24} reduction label="GR" />
            </div>
          </div>
          <div className="sim-group-title">
            <span>키 듣기 · 컴프가 듣는 소리만</span>
            <Switch on={c.key.listen} onChange={(listen) => set({ key: { listen } })} color={COLOR} />
          </div>
          <Slider label="주파수" hint="치찰음이 가장 거슬리는 곳. 6~9 kHz 근처, 목소리마다 다르다" value={c.key.freq} range={r.keyFreq} onChange={(v) => set({ key: { freq: v } })} color={COLOR} defaultValue={6500} />
          <Slider label="스레숄드" hint="치찰음이 이보다 크면 누른다" value={c.thresholdDb} range={r.compThreshold} onChange={(v) => set({ thresholdDb: v })} color={COLOR} defaultValue={-40} />
          <More label="더 자세히: 레이시오·릴리스">
            <Slider label="레이시오" value={c.ratio} range={r.ratio} onChange={(v) => set({ ratio: v })} color={COLOR} />
            <Slider label="릴리스" hint="짧게 두어야 다음 음절까지 눌리지 않는다" value={c.releaseMs} range={r.compRelease} onChange={(v) => set({ releaseMs: v })} color={COLOR} />
          </More>
        </>
      )}
    </WidgetShell>
  );
}
