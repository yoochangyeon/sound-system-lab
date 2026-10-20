// 콘솔 시뮬레이터 앱. X32 스타일·dLive 스타일이 같은 저장소·엔진·미션을 쓰고,
// 화면 배치와 메뉴 흐름(variant)만 다르다. 실제 기기 화면을 베끼지 않은 자체 디자인이다.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { DeviceProfile } from '../profile';
import { createMixerStore } from '../../stores/mixer';
import { usePlayback } from '../../components/ui/usePlayback';
import { VolumeNotice } from '../../components/ui/VolumeNotice';
import { consoleDefaultState } from './console-state';
import { FaderBank } from './FaderBank';
import { MissionPanel } from './MissionPanel';
import { AuxSendsPanel, BusGeqPanel, RoutingPanel, SECTION_LABEL, StripSectionPanel, type StripSection } from './panels';
import '../../components/sim/sim.css';
import './console.css';

export type Variant = 'x32' | 'dlive';

const MIN_WIDTH = 1024;

type X32Screen = 'home' | 'sends' | 'routing' | 'main';
type DLiveScreen = StripSection | 'mix' | 'io' | 'neq';

const X32_TABS: { id: X32Screen; label: string; hint: string }[] = [
  { id: 'home', label: 'HOME', hint: '채널 스트립' },
  { id: 'sends', label: 'SENDS', hint: 'Aux 모니터' },
  { id: 'routing', label: 'ROUTING', hint: '입력 패치' },
  { id: 'main', label: 'MAIN', hint: '메인 GEQ' },
];

const DLIVE_TABS: { id: DLiveScreen; label: string }[] = [
  { id: 'preamp', label: 'Preamp' },
  { id: 'gate', label: 'Gate' },
  { id: 'peq', label: 'PEQ' },
  { id: 'comp', label: 'Compressor' },
  { id: 'mix', label: 'Mix (Aux)' },
  { id: 'io', label: 'I/O 패치' },
  { id: 'neq', label: 'Main NEQ' },
];

function useWideEnough() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const up = () => setOk(mq.matches);
    up();
    mq.addEventListener('change', up);
    return () => mq.removeEventListener('change', up);
  }, []);
  return ok;
}

export interface ConsoleAppProps {
  variant: Variant;
  profile: DeviceProfile;
  geqFirst?: number;
  geqLast?: number;
}

export default function ConsoleApp({ variant, profile, geqFirst, geqLast }: ConsoleAppProps) {
  const store = useMemo(() => createMixerStore(consoleDefaultState(), profile), [profile]);
  const { engine, status, toggle, needNotice, acceptNotice, cancelNotice } = usePlayback(store);
  const wide = useWideEnough();
  const playing = status === 'playing';
  const [selected, setSelected] = useState(0);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [layer, setLayer] = useState<'main' | number>('main');
  const [x32Screen, setX32Screen] = useState<X32Screen>('home');
  const [dliveScreen, setDliveScreen] = useState<DLiveScreen>('preamp');
  const [aux, setAux] = useState(0);
  const listen = useStore(store, (s) => s.listen);
  const auxes = useStore(store, (s) => s.auxes);
  const channel = useStore(store, (s) => s.channels[selected]);
  const a = useStore(store, (s) => s.actions);

  // 미션 미리보기 등 외부에서 미션을 고르게 한다(?mission=howl).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('mission');
    if (id) setMissionId(id);
  }, []);

  if (!wide) {
    return (
      <div className="con-narrow">
        <h1>콘솔 실습은 가로 화면에서 열어 주세요</h1>
        <p>
          콘솔 화면은 가로로 놓은 태블릿이나 컴퓨터(가로 {MIN_WIDTH}px 이상)를 기준으로 만들었습니다. 휴대폰에서는 레슨과 위젯으로 먼저
          연습해 보세요.
        </p>
        <p>
          <a href="/">홈으로</a> · <a href="/lab/">실습실 입구</a> · <a href="/lessons/02-processing/01-preamp/">2장 레슨</a>
        </p>
      </div>
    );
  }

  const panelProps = { store, engine, playing };
  const chTitle = (
    <div className="con-chtitle">
      <span className="con-chtitle-no">CH {selected + 1}</span> {channel.name}
    </div>
  );

  let screen: React.ReactNode;
  if (variant === 'x32') {
    if (x32Screen === 'home')
      screen = (
        <>
          {chTitle}
          <div className="con-x32-grid">
            {(['preamp', 'gate', 'peq', 'comp'] as StripSection[]).map((sec) => (
              <StripSectionPanel key={sec} {...panelProps} ch={selected} section={sec} />
            ))}
          </div>
        </>
      );
    else if (x32Screen === 'sends')
      screen = (
        <>
          <div className="con-subtabs">
            {auxes.map((b, i) => (
              <button key={i} type="button" className={`sim-btn is-small${aux === i ? ' is-active' : ''}`} onClick={() => setAux(i)}>
                {b.name}
              </button>
            ))}
          </div>
          <AuxSendsPanel {...panelProps} aux={aux} />
          <BusGeqPanel {...panelProps} bus={aux} first={geqFirst} last={geqLast} />
        </>
      );
    else if (x32Screen === 'routing') screen = <RoutingPanel store={store} />;
    else screen = <BusGeqPanel {...panelProps} bus="main" first={geqFirst} last={geqLast} />;
  } else {
    if (dliveScreen === 'mix')
      screen = (
        <>
          <div className="con-subtabs">
            {auxes.map((b, i) => (
              <button key={i} type="button" className={`sim-btn is-small${aux === i ? ' is-active' : ''}`} onClick={() => setAux(i)}>
                {b.name}
              </button>
            ))}
          </div>
          <AuxSendsPanel {...panelProps} aux={aux} />
          <BusGeqPanel {...panelProps} bus={aux} first={geqFirst} last={geqLast} />
        </>
      );
    else if (dliveScreen === 'io') screen = <RoutingPanel store={store} />;
    else if (dliveScreen === 'neq') screen = <BusGeqPanel {...panelProps} bus="main" first={geqFirst} last={geqLast} />;
    else
      screen = (
        <>
          {chTitle}
          <StripSectionPanel {...panelProps} ch={selected} section={dliveScreen} big />
          <div className="con-dlive-overview">
            {(['preamp', 'gate', 'peq', 'comp'] as StripSection[]).map((sec) => {
              const on =
                sec === 'preamp' ? channel.preamp.hpfOn : sec === 'gate' ? channel.gate.on : sec === 'peq' ? channel.peq.on : channel.comp.on;
              return (
                <button key={sec} type="button" className={`con-tile${dliveScreen === sec ? ' is-active' : ''}`} onClick={() => setDliveScreen(sec)}>
                  <span>{SECTION_LABEL[sec]}</span>
                  <small>{sec === 'preamp' ? `게인 ${channel.preamp.gainDb} dB` : on ? '켜짐' : '꺼짐'}</small>
                </button>
              );
            })}
          </div>
        </>
      );
  }

  return (
    <div className={`sim-panel con-app is-${variant}`}>
      <header className="con-top">
        <button type="button" className={`sim-btn is-primary con-play${playing ? ' is-playing' : ''}`} onClick={toggle} style={{ ['--accent-fn' as string]: 'var(--fn-bus)' }}>
          {playing ? '■ 정지' : status === 'loading' ? '불러오는 중…' : '▶ 재생'}
        </button>
        <div className="con-brand">
          <strong>{profile.name}</strong>
          <small>자체 디자인 시뮬레이터 · 실제 기기 화면이 아님</small>
        </div>
        <label className="sim-select">
          <span>듣기</span>
          <select value={String(listen)} onChange={(e) => a.setListen(e.target.value === 'main' ? 'main' : Number(e.target.value))}>
            <option value="main">메인 L/R</option>
            {auxes.map((b, i) => (
              <option key={i} value={i}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {status === 'error' && <span className="sim-error">소리를 불러오지 못했습니다. 새로고침해 주세요.</span>}
        <a className="con-exit" href="/lab/">
          실습실 입구
        </a>
      </header>

      <div className="con-body">
        {variant === 'x32' ? (
          <nav className="con-x32-nav" aria-label="화면">
            {X32_TABS.map((t) => (
              <button key={t.id} type="button" className={x32Screen === t.id ? 'is-active' : ''} onClick={() => setX32Screen(t.id)} aria-pressed={x32Screen === t.id}>
                <strong>{t.label}</strong>
                <small>{t.hint}</small>
              </button>
            ))}
          </nav>
        ) : null}
        <main className="con-screen">
          {variant === 'dlive' && (
            <nav className="con-dlive-tabs" aria-label="처리 화면">
              {DLIVE_TABS.map((t) => (
                <button key={t.id} type="button" className={dliveScreen === t.id ? 'is-active' : ''} onClick={() => setDliveScreen(t.id)} aria-pressed={dliveScreen === t.id}>
                  {t.label}
                </button>
              ))}
            </nav>
          )}
          {screen}
        </main>
        <MissionPanel store={store} missionId={missionId} onChange={setMissionId} onFocusChannel={setSelected} />
      </div>

      <div className="con-layerbar">
        <span className="sim-stat">{variant === 'x32' ? 'Sends on Fader' : 'Mix 키(Sends on Faders)'}</span>
        <button type="button" className={`sim-btn is-small${layer === 'main' ? ' is-active' : ''}`} onClick={() => setLayer('main')}>
          채널 페이더
        </button>
        {auxes.map((b, i) => (
          <button key={i} type="button" className={`sim-btn is-small${layer === i ? ' is-active' : ''}`} onClick={() => setLayer(i)}>
            → {b.name}
          </button>
        ))}
        {layer !== 'main' && <span className="sim-stat">페이더가 지금 {auxes[layer].name}로 보내는 양이다</span>}
      </div>
      <FaderBank {...panelProps} selected={selected} onSelect={setSelected} layer={layer} faderHeight={120} />

      {needNotice && <VolumeNotice onAccept={acceptNotice} onCancel={cancelNotice} />}
    </div>
  );
}
