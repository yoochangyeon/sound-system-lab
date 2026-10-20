// GEQ 위젯(#12). 보컬 마이크 → 모니터(Aux) 경로에 31밴드 GEQ를 걸고, 하울링 데모로
// RTA에서 튀어나온 주파수를 찾아 그 밴드만 깎아 멈추게 한다.
import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { GEQ_FREQS, formatHz, geqResponseDb } from '../../audio/dsp/geq';
import { HOWL_FLOOR_DB } from '../../audio/dsp/feedback';
import { howlLoopGainDb } from '../../stores/derived';
import { ResponseGraph } from '../ui/CurveGraph';
import { GeqSliders } from '../ui/GeqSliders';
import { Rta } from '../ui/Rta';
import { useFrame } from '../ui/useFrame';
import type { MixerEngine } from '../../audio/engine';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

// 데모마다 고르는 하울링 주파수(모두 GEQ 밴드 중심)
const HOWL_CANDIDATES = [630, 1000, 1600, 2500, 3150];

function HowlStatus({ engine, active }: { engine: MixerEngine | null; active: boolean }) {
  const [level, setLevel] = useState(HOWL_FLOOR_DB);
  const last = useRef(0);
  useFrame((t) => {
    if (t - last.current < 150) return;
    last.current = t;
    setLevel(engine?.howlLevelDb ?? HOWL_FLOOR_DB);
  }, active);
  if (!active) return null;
  const loud = level > -50;
  return <span className={`sim-lamp ${loud ? 'is-warn' : 'is-on'}`}>{loud ? '하울링이 울리는 중' : '조용함'}</span>;
}

export default function GeqWidget({ defaultStem = 'vocals' }: { defaultStem?: string }) {
  const store = useMemo(
    () =>
      createWidgetStore({
        stems: ['vocals', 'sermon', 'guitar-main', 'drums'],
        defaultStem,
        auxes: 1,
        initial: {
          listen: 0,
          channels: { 0: { preamp: { gainDb: 0 }, sends: [{ levelDb: 0, pre: true }] } },
        },
      }),
    [defaultStem],
  );
  const geq = useStore(store, (s) => s.auxes[0].geq);
  const howl = useStore(store, (s) => s.howl);
  const range = useStore(store, (s) => s.profile.ranges.geqGain);
  const a = useStore(store, (s) => s.actions);
  const loop = useStore(store, (s) => howlLoopGainDb(s));
  const response = useMemo(() => (f: number) => geqResponseDb(geq, f), [geq]);

  const startHowl = () => {
    const choices = HOWL_CANDIDATES.filter((f) => f !== howl.freq);
    const freq = choices[Math.floor(Math.random() * choices.length)];
    a.setHowl({ active: true, channel: 0, aux: 0, freq });
  };

  return (
    <WidgetShell
      title="GEQ 31밴드 · 모니터"
      accent="var(--fn-bus)"
      store={store}
      footer={
        howl.active
          ? loop > 0
            ? 'RTA에서 빨갛게 튀어나온 막대를 찾아, 같은 주파수의 GEQ 밴드를 아래로 내려 보세요.'
            : `잡았습니다. 하울링 주파수는 ${formatHz(howl.freq)}Hz였습니다. 그 밴드만 깎았기 때문에 다른 소리는 거의 그대로입니다.`
          : '지금은 보컬 마이크가 무대 모니터로 나가는 소리를 듣고 있다. ‘하울링 데모’를 누르면 모니터에서 하울링이 시작된다.'
      }
    >
      {({ engine, status }) => (
        <>
          <div className="sim-row is-center">
            <button
              type="button"
              className={`sim-btn${howl.active ? ' is-on' : ''}`}
              onClick={() => (howl.active ? a.setHowl({ active: false }) : startHowl())}
              disabled={status !== 'playing'}
            >
              {howl.active ? '하울링 데모 끝내기' : '하울링 데모 시작'}
            </button>
            <button type="button" className="sim-btn" onClick={() => a.resetGeq(0)}>
              GEQ 평평하게
            </button>
            <HowlStatus engine={engine} active={status === 'playing' && howl.active} />
            {status !== 'playing' && <span className="sim-stat">먼저 ▶ 재생을 누른다</span>}
          </div>
          <Rta read={() => engine?.rta(0) ?? []} active={status === 'playing'} height={110} />
          <ResponseGraph response={response} color="var(--fn-bus)" range={16} height={90} />
          <GeqSliders gains={geq} range={range} onChange={(b, db) => a.setGeqBand(0, b, db)} />
          <span className="sim-stat">밴드 {GEQ_FREQS.length}개 · 슬라이더를 더블클릭하면 0 dB</span>
        </>
      )}
    </WidgetShell>
  );
}
