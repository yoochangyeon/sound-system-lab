// 사이드체인 덕킹 위젯(4차 #57). 채널 1(반주)의 게이트를 덕킹 모드로 두고 키를 채널 2(목소리)로 잡는다.
// 목소리가 나오면 반주가 레인지만큼 내려가고, 목소리가 멈추면 릴리스 동안 돌아온다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { More, Slider, Switch } from '../ui/controls';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const COLOR = 'var(--fn-dyn)';

export default function SidechainWidget() {
  const store = useMemo(
    () =>
      createWidgetStore({
        roles: ['guitar', 'bass', 'overheads', 'lead-vocal'],
        channels: 2,
        patchRoles: ['lead-vocal'],
        initial: {
          channels: {
            0: { faderDb: -4, gate: { on: true, mode: 'duck', thresholdDb: -36, rangeDb: 10, attackMs: 5, holdMs: 150, releaseMs: 400, key: { source: 1 } } },
            1: { faderDb: 0 },
          },
        },
      }),
    [],
  );
  const g = useStore(store, (s) => s.channels[0].gate);
  const voiceOn = useStore(store, (s) => !s.channels[1].mute);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const set = (p: Parameters<typeof a.setGate>[1]) => a.setGate(0, p);

  return (
    <WidgetShell
      title="사이드체인 덕킹"
      accent={COLOR}
      store={store}
      bypassed={!g.on}
      onBypass={() => set({ on: !g.on })}
      footer="미터: 키 = 목소리(채널 2, 리드 보컬), 줄임 = 반주를 줄이는 양, 반주 = 채널 1. 위에서 고른 소스가 반주이고, 목소리가 키다. 반주 채널의 게이트가 자기 소리가 아니라 목소리를 듣고 움직인다."
    >
      {({ engine, status }) => (
        <>
          <div className="sim-visual" style={{ justifyContent: 'center' }}>
            <div className="sim-meters">
              <Meter read={() => engine?.inputPeakDb(1) ?? -Infinity} active={status === 'playing'} height={110} label="키" />
              <Meter read={() => engine?.gateGrDb(0) ?? 0} active={status === 'playing' && g.on} height={110} min={-30} reduction label="줄임" />
              <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={110} label="반주" />
            </div>
          </div>
          <label className="sim-group-title">
            <span>목소리도 메인으로 듣기</span>
            <Switch on={voiceOn} onChange={(on) => a.setMute(1, !on)} color={COLOR} />
          </label>
          <Slider label="스레숄드" hint="목소리가 이보다 크면 반주를 줄인다" value={g.thresholdDb} range={r.gateThreshold} onChange={(v) => set({ thresholdDb: v })} color={COLOR} defaultValue={-36} />
          <Slider label="줄이는 양(레인지)" hint="목소리가 나올 때 반주를 몇 dB 내릴지" value={g.rangeDb} range={r.gateRange} onChange={(v) => set({ rangeDb: v })} color={COLOR} defaultValue={10} format={(v) => `${Math.round(v)} dB`} />
          <More label="더 자세히: 어택·홀드·릴리스">
            <Slider label="어택" hint="목소리가 나온 뒤 줄이기까지" value={g.attackMs} range={r.gateAttack} onChange={(v) => set({ attackMs: v })} color={COLOR} />
            <Slider label="홀드" hint="말 사이 짧은 쉼에는 그대로 두기" value={g.holdMs} range={r.gateHold} onChange={(v) => set({ holdMs: v })} color={COLOR} />
            <Slider label="릴리스" hint="목소리가 멈춘 뒤 반주가 돌아오는 시간" value={g.releaseMs} range={r.gateRelease} onChange={(v) => set({ releaseMs: v })} color={COLOR} />
          </More>
        </>
      )}
    </WidgetShell>
  );
}
