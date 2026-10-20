// PEQ+HPF 위젯(#8). 밴드 4개(로우셸프, 피킹 2, 하이셸프)와 HPF를 돌리면 소리와 응답 곡선이 바로 바뀐다.
import { useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { channelEqResponseDb } from '../../stores/derived';
import { Knob } from '../ui/Knob';
import { ResponseGraph } from '../ui/CurveGraph';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const BAND_NAMES = ['저음 셸프', '중저음', '중고음', '고음 셸프'];
const BAND_DEFAULT_FREQ = [120, 500, 2500, 8000];

export interface PeqWidgetProps {
  defaultStem?: string;
}

export default function PeqWidget({ defaultStem = 'sermon' }: PeqWidgetProps) {
  const store = useMemo(
    () => createWidgetStore({ stems: ['sermon', 'vocals', 'guitar-main', 'bass', 'drums'], defaultStem }),
    [defaultStem],
  );
  const ch = useStore(store, (s) => s.channels[0]);
  const ranges = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const savedHpf = useRef(false);

  const bypassed = !ch.peq.on && !ch.preamp.hpfOn;
  const toggleBypass = () => {
    if (bypassed) {
      a.setPeqOn(0, true);
      a.setPreamp(0, { hpfOn: savedHpf.current });
    } else {
      savedHpf.current = ch.preamp.hpfOn;
      a.setPeqOn(0, false);
      a.setPreamp(0, { hpfOn: false });
    }
  };

  const response = useMemo(() => (f: number) => channelEqResponseDb(ch, f), [ch]);

  return (
    <WidgetShell title="PEQ + HPF" accent="var(--fn-eq)" store={store} bypassed={bypassed} onBypass={toggleBypass}>
      {({ engine, status }) => (
        <>
          <div className="sim-row" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <ResponseGraph response={response} />
            </div>
            <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={120} label="출력" />
          </div>
          <div className="sim-group" style={{ ['--accent-fn' as string]: 'var(--fn-preamp)' }}>
            <div className="sim-group-title">
              <span>HPF (저음 자르기)</span>
              <button
                type="button"
                className={`sim-btn is-small${ch.preamp.hpfOn ? ' is-active' : ''}`}
                aria-pressed={ch.preamp.hpfOn}
                onClick={() => a.setPreamp(0, { hpfOn: !ch.preamp.hpfOn })}
              >
                {ch.preamp.hpfOn ? '켜짐' : '꺼짐'}
              </button>
            </div>
            <div className="sim-row">
              <Knob
                label="차단 주파수"
                value={ch.preamp.hpfFreq}
                range={ranges.hpfFreq}
                onChange={(v) => a.setPreamp(0, { hpfFreq: v })}
                color="var(--fn-preamp)"
                defaultValue={80}
                disabled={!ch.preamp.hpfOn}
              />
            </div>
          </div>
          <div className="sim-row">
            {ch.peq.bands.map((b, i) => (
              <div className="sim-group" key={i} style={{ flex: '1 1 140px' }}>
                <div className="sim-group-title">
                  <span>
                    {i + 1}. {BAND_NAMES[i]}
                  </span>
                </div>
                <div className="sim-row">
                  <Knob
                    label="주파수"
                    value={b.freq}
                    range={ranges.eqFreq}
                    onChange={(v) => a.setPeqBand(0, i, { freq: v })}
                    defaultValue={BAND_DEFAULT_FREQ[i]}
                    size={48}
                    disabled={!ch.peq.on}
                  />
                  <Knob
                    label="게인"
                    value={b.gainDb}
                    range={ranges.eqGain}
                    onChange={(v) => a.setPeqBand(0, i, { gainDb: v })}
                    defaultValue={0}
                    size={48}
                    disabled={!ch.peq.on}
                  />
                  {b.type === 'peaking' && (
                    <Knob
                      label="Q (폭)"
                      value={b.q}
                      range={ranges.eqQ}
                      onChange={(v) => a.setPeqBand(0, i, { q: v })}
                      defaultValue={1}
                      size={48}
                      disabled={!ch.peq.on}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  );
}
