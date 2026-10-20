// 극성·딜레이 위젯(4차 #57). 같은 소리를 두 채널(두 마이크)로 받아 섞는다.
// 두 번째 마이크가 멀어 늦게 도착하면 특정 주파수끼리 상쇄되어(콤 필터) 소리가 얇아진다.
// 극성 반전과 채널 딜레이로 맞추는 것을 응답 곡선과 소리로 확인한다.
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { combResponseDb } from '../../audio/dsp/comb';
import { Slider, Switch } from '../ui/controls';
import { ResponseGraph } from '../ui/CurveGraph';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const COLOR = 'var(--fn-preamp)';
/** 소리는 1 ms에 약 34 cm 간다(340 m/s) */
const CM_PER_MS = 34.3;

export default function PolarityWidget() {
  const store = useMemo(
    () =>
      createWidgetStore({
        roles: ['snare', 'guitar', 'lead-vocal'],
        channels: 2,
        patchRoles: ['snare'],
        initial: { channels: { 1: { preamp: { delayOn: true, delayMs: 1 } } } },
      }),
    [],
  );
  // 두 채널은 같은 입력을 받는다(소스를 바꾸면 두 번째 채널도 따라 바꾼다).
  useEffect(
    () =>
      store.subscribe((n, p) => {
        if (n.patch[0] !== p.patch[0]) n.actions.setPatch(1, n.patch[0]);
      }),
    [store],
  );
  const second = useStore(store, (s) => s.channels[1]);
  const a = useStore(store, (s) => s.actions);
  const on = !second.mute;
  // 두 번째 채널의 딜레이 = 두 번째 마이크가 늦게 도착하는 시간으로 본다. 곡선은 한 마이크만 들을 때를 0 dB로 맞춘다.
  const lateMs = second.preamp.delayOn ? second.preamp.delayMs : 0;
  const response = useMemo(() => (f: number) => (on ? combResponseDb(f, lateMs, second.preamp.invert) - 6.02 : 0), [on, lateMs, second.preamp.invert]);
  const range = { min: 0.3, max: 10, step: 0.1, unit: 'ms', log: true };

  return (
    <WidgetShell
      title="두 마이크 섞기"
      accent={COLOR}
      store={store}
      footer="곡선은 두 마이크를 섞은 소리의 주파수별 크기다(위가 더해짐, 아래로 파인 곳이 상쇄). 늦음이 1 ms면 500 Hz가, 2 ms면 250 Hz가 먼저 사라진다."
    >
      {() => (
        <>
          <ResponseGraph response={response} color={COLOR} range={24} height={110} />
          <div className="sim-group-title">
            <span>두 번째 마이크 섞기</span>
            <Switch on={on} onChange={(v) => a.setMute(1, !v)} color={COLOR} />
          </div>
          <Slider
            label="두 번째 마이크가 늦게 도착하는 시간"
            hint={`마이크 거리 차이 약 ${Math.round(lateMs * CM_PER_MS)} cm`}
            value={second.preamp.delayMs}
            range={range}
            onChange={(v) => a.setPreamp(1, { delayOn: true, delayMs: v })}
            color={COLOR}
            disabled={!on}
          />
          <div className="sim-group-title">
            <span>두 번째 마이크 극성 반전</span>
            <Switch on={second.preamp.invert} onChange={(invert) => a.setPreamp(1, { invert })} color={COLOR} />
          </div>
        </>
      )}
    </WidgetShell>
  );
}
