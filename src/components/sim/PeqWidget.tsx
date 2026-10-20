// PEQ+HPF·LPF 위젯(#8, 2차 개편 #35, LPF #40). HPF·LPF 스위치·차단 주파수, 밴드 탭 4개 → 주파수·게인. Q는 '더 자세히'.
import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { channelEqResponseDb } from '../../stores/derived';
import { More, Slider, Switch, Tabs } from '../ui/controls';
import { ResponseGraph } from '../ui/CurveGraph';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const BAND_NAMES = ['저음', '중저음', '중고음', '고음'];
const BAND_HINTS = ['이 주파수 아래 전체(셸프)', '종 모양으로 한 대역만', '종 모양으로 한 대역만', '이 주파수 위 전체(셸프)'];
const BAND_DEFAULT_FREQ = [120, 500, 2500, 8000];

export default function PeqWidget() {
  const store = useMemo(
    () => createWidgetStore({ roles: ['lead-vocal', 'guitar', 'bass', 'overheads', 'backing-vocal'] }),
    [],
  );
  const ch = useStore(store, (s) => s.channels[0]);
  const ranges = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const saved = useRef({ hpf: false, lpf: false });
  const [band, setBand] = useState(1);

  const bypassed = !ch.peq.on && !ch.preamp.hpfOn && !ch.preamp.lpfOn;
  const toggleBypass = () => {
    if (bypassed) {
      a.setPeqOn(0, true);
      a.setPreamp(0, { hpfOn: saved.current.hpf, lpfOn: saved.current.lpf });
    } else {
      saved.current = { hpf: ch.preamp.hpfOn, lpf: ch.preamp.lpfOn };
      a.setPeqOn(0, false);
      a.setPreamp(0, { hpfOn: false, lpfOn: false });
    }
  };

  const response = useMemo(() => (f: number) => channelEqResponseDb(ch, f), [ch]);
  const b = ch.peq.bands[band];

  return (
    <WidgetShell title="EQ (필터 + PEQ)" accent="var(--fn-eq)" store={store} bypassed={bypassed} onBypass={toggleBypass}>
      {({ engine, status }) => (
        <>
          <div className="sim-visual">
            <div className="grow">
              <ResponseGraph response={response} height={130} />
            </div>
            <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={118} label="출력" />
          </div>

          <div className="sim-group">
            <div className="sim-group-title">
              <span>HPF · 저음 자르기</span>
              <Switch on={ch.preamp.hpfOn} onChange={(on) => a.setPreamp(0, { hpfOn: on })} />
            </div>
            <Slider
              label="차단 주파수"
              hint="이 주파수 아래를 깎는다"
              value={ch.preamp.hpfFreq}
              range={ranges.hpfFreq}
              onChange={(v) => a.setPreamp(0, { hpfFreq: v })}
              defaultValue={80}
              disabled={!ch.preamp.hpfOn}
            />
          </div>

          <div className="sim-group">
            <div className="sim-group-title">
              <span>LPF · 고음 자르기</span>
              <Switch on={ch.preamp.lpfOn} onChange={(on) => a.setPreamp(0, { lpfOn: on })} />
            </div>
            <Slider
              label="차단 주파수"
              hint="이 주파수 위를 깎는다"
              value={ch.preamp.lpfFreq}
              range={ranges.lpfFreq}
              onChange={(v) => a.setPreamp(0, { lpfFreq: v })}
              defaultValue={12000}
              disabled={!ch.preamp.lpfOn}
            />
          </div>

          <div className="sim-group">
            <div className="sim-group-title">
              <span>PEQ · 대역 다듬기</span>
            </div>
            <Tabs label="밴드" items={BAND_NAMES.map((n, i) => ({ id: i, label: n }))} value={band} onChange={setBand} />
            <div className="sim-sliders" style={{ marginTop: 8 }}>
              <Slider
                label="주파수"
                hint={BAND_HINTS[band]}
                value={b.freq}
                range={ranges.eqFreq}
                onChange={(v) => a.setPeqBand(0, band, { freq: v })}
                defaultValue={BAND_DEFAULT_FREQ[band]}
                disabled={!ch.peq.on}
              />
              <Slider
                label="올리기·내리기"
                hint="0보다 작으면 깎는다"
                value={b.gainDb}
                range={ranges.eqGain}
                onChange={(v) => a.setPeqBand(0, band, { gainDb: v })}
                defaultValue={0}
                disabled={!ch.peq.on}
              />
            </div>
          </div>

          {b.type === 'peaking' && (
            <More label="더 자세히: Q(폭)">
              <Slider
                label="Q (폭)"
                hint="클수록 좁은 대역만, 작을수록 넓게"
                value={b.q}
                range={ranges.eqQ}
                onChange={(v) => a.setPeqBand(0, band, { q: v })}
                defaultValue={1}
                format={(v) => v.toFixed(1)}
                disabled={!ch.peq.on}
              />
            </More>
          )}
        </>
      )}
    </WidgetShell>
  );
}
