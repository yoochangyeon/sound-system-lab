// Insert와 Send/Return 비교 위젯(4차 #57). 같은 리버브를 채널에 직접 끼우거나(Insert), 따로 보내 섞는다(Send).
// 채널 페이더를 내려 보면 차이가 보인다: Insert·post 센드는 잔향도 같이 줄고, pre 센드는 잔향만 남는다.
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { fmtDb } from '../ui/scale';
import { Slider, Tabs } from '../ui/controls';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const COLOR = 'var(--fn-fx)';
type Mode = 'insert' | 'send';

export default function FxRoutingWidget() {
  const store = useMemo(
    () =>
      createWidgetStore({
        roles: ['lead-vocal', 'backing-vocal', 'snare'],
        buses: [{ name: '리버브', kind: 'fx', fx: 'reverb' }],
        initial: { channels: { 0: { sends: [{ levelDb: -6, tap: 'post' }], insert: { on: false, mixPct: 35, fx: { decayS: 1.8 } } } } },
      }),
    [],
  );
  const [mode, setModeState] = useState<Mode>('send');
  const c = useStore(store, (s) => s.channels[0]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const setMode = (m: Mode) => {
    setModeState(m);
    a.setInsert(0, { on: m === 'insert' });
    a.setFxReturn(0, { returnMute: m === 'insert' });
  };
  const send = c.sends[0];

  return (
    <WidgetShell
      title="Insert와 Send"
      accent={COLOR}
      store={store}
      footer="Insert는 채널 소리 전체가 이펙트를 지나간다(Mix로 섞는다). Send는 소리를 복사해 보내고 돌아온 잔향을 따로 섞는다. 리버브처럼 여러 채널이 같이 쓰는 이펙트는 보통 Send로 건다."
    >
      {({ engine, status }) => (
        <>
          <Tabs<Mode>
            label="거는 방식"
            items={[
              { id: 'insert', label: 'Insert · 채널에 끼우기' },
              { id: 'send', label: 'Send · 따로 보내기' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <div className="sim-visual" style={{ justifyContent: 'center' }}>
            <div className="sim-meters">
              <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={110} label="채널" />
              <Meter read={() => engine?.fxReturnPeakDb(0) ?? -Infinity} active={status === 'playing' && mode === 'send'} height={110} label="리턴" />
            </div>
          </div>
          {mode === 'insert' ? (
            <Slider label="Mix" hint="이펙트 소리 비율. 높일수록 원음이 줄어든다" value={c.insert.mixPct} range={r.mix} onChange={(v) => a.setInsert(0, { mixPct: v })} color={COLOR} />
          ) : (
            <>
              <Slider label="보내는 양" value={send.levelDb} range={r.send} scale="fader" onChange={(v) => a.setSend(0, 0, { levelDb: v })} color={COLOR} format={fmtDb} />
              <Tabs
                label="센드 위치"
                items={[
                  { id: 'pre' as const, label: '페이더 앞(pre)' },
                  { id: 'post' as const, label: '페이더 뒤(post)' },
                ]}
                value={send.tap === 'pre-eq' ? 'pre' : send.tap}
                onChange={(tap) => a.setSend(0, 0, { tap })}
              />
            </>
          )}
          <Slider label="채널 페이더" hint="내려 보고 잔향이 어떻게 되는지 듣는다" value={c.faderDb} range={r.fader} scale="fader" onChange={(v) => a.setFader(0, v)} color="var(--accent)" format={fmtDb} defaultValue={0} />
        </>
      )}
    </WidgetShell>
  );
}
