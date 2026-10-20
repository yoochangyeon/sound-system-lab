// 쉬운 믹서(기획서 S05, 2차 개편 #36). 실제 기종을 본뜨지 않은 학습용 8채널 믹서.
// 소리 엔진·저장소·미션은 위젯과 같은 것을 쓴다. 휴대폰에서는 채널 줄만 가로로 스크롤한다.
// 곡을 고르면(#45) 그 곡의 채널 배치로 믹서를 새로 만든다. '정답 믹스'로 원곡 믹스와 번갈아 듣는다.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_SONG, SONGS, songById, type Song } from '../audio/library';
import { compTransferDb } from '../audio/dsp/dynamics';
import { geqResponseDb } from '../audio/dsp/geq';
import type { MixerEngine } from '../audio/engine';
import { More, Slider, Switch, Tabs } from '../components/ui/controls';
import { ResponseGraph, TransferGraph } from '../components/ui/CurveGraph';
import { Fader } from '../components/ui/Fader';
import { GeqSliders } from '../components/ui/GeqSliders';
import { Meter } from '../components/ui/Meter';
import { Rta } from '../components/ui/Rta';
import { fmtDb } from '../components/ui/scale';
import { usePlayback } from '../components/ui/usePlayback';
import { VolumeNotice } from '../components/ui/VolumeNotice';
import { channelEqResponseDb, inputPeakDb } from '../stores/derived';
import { createMixerStore, type BusRef, type MixerStoreApi } from '../stores/mixer';
import { GENERIC_PROFILE } from '../stores/profile';
import { buildMissions } from '../missions';
import { MissionCard } from './MissionCard';
import { mixerDefaultState } from './mixer-state';
import '../components/sim/sim.css';
import './mixer.css';

interface Ctx {
  store: MixerStoreApi;
  engine: MixerEngine | null;
  playing: boolean;
}

/** 원곡 믹스는 마스터링되어 커서, 내 믹스(기본 믹스)와 비슷한 크기로 줄여 튼다(dB).
 *  2026-10-20 측정: 기본 믹스 메인 RMS 약 −26 dBFS, 원곡 믹스 구간 RMS −8.8 dBFS. */
const REFERENCE_TRIM_DB = -17;

export default function MixerApp() {
  const [songId, setSongId] = useState(DEFAULT_SONG.id);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('song');
    if (id && songById(id)) setSongId(id);
  }, []);
  const song = songById(songId) ?? DEFAULT_SONG;
  const pickSong = (id: string) => {
    setSongId(id);
    const url = new URL(location.href);
    url.searchParams.set('song', id);
    url.searchParams.delete('mission');
    history.replaceState(null, '', url);
  };
  // 곡이 바뀌면 저장소·엔진을 새로 만든다.
  return <MixerForSong key={song.id} song={song} onPickSong={pickSong} />;
}

function MixerForSong({ song, onPickSong }: { song: Song; onPickSong: (id: string) => void }) {
  const store = useMemo(() => createMixerStore(mixerDefaultState(song), GENERIC_PROFILE), [song]);
  const missions = useMemo(() => buildMissions(song), [song]);
  const { engine, status, toggle, needNotice, acceptNotice, cancelNotice } = usePlayback(store);
  useEffect(() => {
    if (engine) void engine.setReference(song.reference?.file ?? null, REFERENCE_TRIM_DB);
  }, [engine, song]);
  const playing = status === 'playing';
  const [selected, setSelected] = useState(0);
  const [missionId, setMissionId] = useState<string | null>(null);
  const listen = useStore(store, (s) => s.listen);
  const auxes = useStore(store, (s) => s.auxes);
  const a = useStore(store, (s) => s.actions);
  const ctx: Ctx = { store, engine, playing };

  // 레슨의 미션 링크(?mission=howl)로 바로 연다.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('mission');
    if (id && missions.some((m) => m.id === id)) setMissionId(id);
  }, []);
  const changeMission = (id: string | null) => {
    setMissionId(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set('mission', id);
    else url.searchParams.delete('mission');
    history.replaceState(null, '', url);
  };

  return (
    <div className="sim-panel mx">
      <div className="mx-bar">
        <button type="button" className={`sim-btn sim-play is-primary${playing ? ' is-playing' : ''}`} onClick={toggle}>
          {playing ? '■ 정지' : status === 'loading' ? '불러오는 중…' : '▶ 소리 켜기'}
        </button>
        <div className="mx-listen">
          <span className="sim-stat">이어폰으로 듣기</span>
          <Tabs
            label="듣기"
            items={[
              { id: 'main' as const, label: '메인' },
              ...auxes.map((b, i) => ({ id: i, label: b.name.replace(/ (보컬|밴드)$/, '') })),
              ...(song.reference ? [{ id: 'reference' as const, label: '정답 믹스' }] : []),
            ]}
            value={listen}
            onChange={(v) => a.setListen(v)}
          />
        </div>
        {status === 'error' && <span className="sim-error">소리를 불러오지 못했습니다. 새로고침해 주세요.</span>}
        <div className="mx-song">
          <span className="sim-stat">곡</span>
          {SONGS.length > 1 ? (
            <select value={song.id} onChange={(e) => onPickSong(e.target.value)} aria-label="곡 고르기">
              {SONGS.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.artist} · {sg.title}
                </option>
              ))}
            </select>
          ) : (
            <strong>
              {song.artist} · {song.title}
            </strong>
          )}
          <span className="sim-stat">
            {song.genre} · {song.bpm} BPM · {song.excerpt.bars}마디 반복
          </span>
          {listen === 'reference' && <span className="mx-ref-note">지금 원곡 믹스를 듣는 중. 내 믹스 조작은 들리지 않는다</span>}
        </div>
      </div>

      <div className="mx-grid">
        <div className="mx-col is-left">
          <div className="mx-area-strips">
            <Strips {...ctx} selected={selected} onSelect={setSelected} />
          </div>
          <div className="mx-area-detail">
            <ChannelDetail {...ctx} ch={selected} />
          </div>
        </div>
        <div className="mx-col is-right">
          <div className="mx-area-mission">
            <MissionCard store={store} missions={missions} missionId={missionId} onChange={changeMission} onFocusChannel={setSelected} />
          </div>
          <div className="mx-area-out">
            <Outputs {...ctx} />
          </div>
        </div>
      </div>

      {needNotice && <VolumeNotice onAccept={acceptNotice} onCancel={cancelNotice} />}
    </div>
  );
}

/* ---------------- 채널 8개 ---------------- */
function Strips({ store, engine, playing, selected, onSelect }: Ctx & { selected: number; onSelect: (ch: number) => void }) {
  const channels = useStore(store, (s) => s.channels);
  const a = useStore(store, (s) => s.actions);
  return (
    <section className="mx-card" aria-label="채널">
      <div className="mx-card-head">
        <h2>채널</h2>
        <span className="sim-stat">이름을 누르면 아래에서 자세히 만진다</span>
      </div>
      <div className="mx-strips">
        {channels.map((c, i) => (
          <div key={i} className={`mx-strip${selected === i ? ' is-selected' : ''}`}>
            <button type="button" className="mx-name" onClick={() => onSelect(i)} aria-pressed={selected === i}>
              <small>{i + 1}</small>
              <span>{c.name}</span>
            </button>
            <div className="mx-fader-row">
              <Meter read={() => engine?.faderPeakDb(i) ?? -Infinity} active={playing} height={128} width={8} />
              <Fader label={`${c.name} 페이더`} value={c.faderDb} onChange={(v) => a.setFader(i, v)} height={140} color="var(--accent)" />
            </div>
            <button type="button" className={`mx-toggle is-mute${c.mute ? ' is-on' : ''}`} aria-pressed={c.mute} onClick={() => a.setMute(i, !c.mute)}>
              {c.mute ? '꺼짐' : '끄기'}
            </button>
            <button
              type="button"
              className={`mx-toggle is-main${c.mainAssign ? ' is-on' : ''}`}
              aria-pressed={c.mainAssign}
              onClick={() => a.setMainAssign(i, !c.mainAssign)}
              title="메인 스피커로 보내기"
            >
              메인
            </button>
          </div>
        ))}
      </div>
      <p className="mx-legend">
        <span className="mx-dot is-mute" /> 끄기(뮤트): 채널 소리를 통째로 끈다 · <span className="mx-dot is-main" /> 메인: 메인 스피커로 보낸다
      </p>
    </section>
  );
}

/* ---------------- 선택한 채널 상세 ---------------- */
type DetailTab = 'input' | 'eq' | 'comp' | 'mon';

function ChannelDetail(props: Ctx & { ch: number }) {
  const { store, ch } = props;
  const c = useStore(store, (s) => s.channels[ch]);
  const [tab, setTab] = useState<DetailTab>('input');
  return (
    <section className="mx-card" aria-label="채널 상세">
      <div className="mx-card-head">
        <h2>
          <span className="mx-chno">{ch + 1}</span> {c.name}
        </h2>
      </div>
      <Tabs
        label="채널 처리"
        items={[
          { id: 'input' as const, label: '입력' },
          { id: 'eq' as const, label: 'EQ' },
          { id: 'comp' as const, label: '컴프' },
          { id: 'mon' as const, label: '모니터' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mx-detail-body">
        {tab === 'input' && <InputTab {...props} />}
        {tab === 'eq' && <EqTab {...props} />}
        {tab === 'comp' && <CompTab {...props} />}
        {tab === 'mon' && <MonitorTab {...props} />}
      </div>
    </section>
  );
}

function InputTab({ store, engine, playing, ch }: Ctx & { ch: number }) {
  const c = useStore(store, (s) => s.channels[ch]);
  const inputs = useStore(store, (s) => s.inputs);
  const patch = useStore(store, (s) => s.patch[ch]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const est = useStore(store, (s) => inputPeakDb(s, ch));
  const verdict =
    patch === null
      ? { cls: 'is-warn', text: '입력이 연결되어 있지 않다' }
      : est >= 0
        ? { cls: 'is-warn', text: '클리핑: 소리가 깨진다' }
        : est < -18
          ? { cls: '', text: '너무 작다: 잡음에 묻힌다' }
          : { cls: 'is-on', text: '알맞다: 여유가 있다' };
  return (
    <>
      <label className="mx-field">
        <span>연결된 입력</span>
        <select value={patch ?? ''} onChange={(e) => a.setPatch(ch, e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">연결 안 됨</option>
          {inputs.map((inp, i) => (
            <option key={i} value={i}>
              {inp.label}
            </option>
          ))}
        </select>
      </label>
      <div className="sim-visual">
        <Meter read={() => engine?.inputPeakDb(ch) ?? -Infinity} active={playing} height={110} width={14} label="입력" />
        <div className="grow mx-verdict">
          <span className={`sim-lamp ${verdict.cls}`}>{verdict.text}</span>
          <span className="sim-stat">
            가장 큰 순간 <strong>{Number.isFinite(est) ? fmtDb(est).replace(' dB', ' dBFS') : '—'}</strong> · 목표 −18 ~ −6
          </span>
        </div>
      </div>
      <Slider label="게인" hint="마이크 신호를 얼마나 키울지" value={c.preamp.gainDb} range={r.gain} onChange={(v) => a.setPreamp(ch, { gainDb: v })} color="var(--fn-preamp)" />
    </>
  );
}

const BAND_NAMES = ['저음', '중저음', '중고음', '고음'];

function EqTab({ store, engine, playing, ch }: Ctx & { ch: number }) {
  const c = useStore(store, (s) => s.channels[ch]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const [band, setBand] = useState(1);
  const response = useMemo(() => (f: number) => channelEqResponseDb(c, f), [c]);
  const b = c.peq.bands[band];
  return (
    <>
      <div className="sim-visual">
        <div className="grow">
          <ResponseGraph response={response} height={110} />
        </div>
        <Meter read={() => engine?.faderPeakDb(ch) ?? -Infinity} active={playing} height={100} label="출력" />
      </div>
      <div className="sim-group">
        <div className="sim-group-title">
          <span>HPF · 저음 자르기</span>
          <Switch on={c.preamp.hpfOn} onChange={(on) => a.setPreamp(ch, { hpfOn: on })} />
        </div>
        <Slider label="차단 주파수" value={c.preamp.hpfFreq} range={r.hpfFreq} onChange={(v) => a.setPreamp(ch, { hpfFreq: v })} disabled={!c.preamp.hpfOn} />
      </div>
      <div className="sim-group">
        <div className="sim-group-title">
          <span>LPF · 고음 자르기</span>
          <Switch on={c.preamp.lpfOn} onChange={(on) => a.setPreamp(ch, { lpfOn: on })} />
        </div>
        <Slider label="차단 주파수" value={c.preamp.lpfFreq} range={r.lpfFreq} onChange={(v) => a.setPreamp(ch, { lpfFreq: v })} disabled={!c.preamp.lpfOn} />
      </div>
      <div className="sim-group">
        <div className="sim-group-title">
          <span>PEQ · 대역 다듬기</span>
          <Switch on={c.peq.on} onChange={(on) => a.setPeqOn(ch, on)} />
        </div>
        <Tabs label="밴드" items={BAND_NAMES.map((n, i) => ({ id: i, label: n }))} value={band} onChange={setBand} />
        <div className="sim-sliders" style={{ marginTop: 8 }}>
          <Slider label="주파수" value={b.freq} range={r.eqFreq} onChange={(v) => a.setPeqBand(ch, band, { freq: v })} disabled={!c.peq.on} />
          <Slider label="올리기·내리기" hint="0보다 작으면 깎는다" value={b.gainDb} range={r.eqGain} onChange={(v) => a.setPeqBand(ch, band, { gainDb: v })} defaultValue={0} disabled={!c.peq.on} />
          {b.type === 'peaking' && (
            <More label="더 자세히: Q(폭)">
              <Slider label="Q (폭)" value={b.q} range={r.eqQ} onChange={(v) => a.setPeqBand(ch, band, { q: v })} format={(v) => v.toFixed(1)} disabled={!c.peq.on} />
            </More>
          )}
        </div>
      </div>
    </>
  );
}

function CompTab({ store, engine, playing, ch }: Ctx & { ch: number }) {
  const comp = useStore(store, (s) => s.channels[ch].comp);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const set = (p: Partial<typeof comp>) => a.setComp(ch, p);
  const transfer = useMemo(() => (d: number) => compTransferDb(d, comp), [comp]);
  const color = 'var(--fn-dyn)';
  return (
    <div style={{ ['--accent-fn' as string]: color, display: 'contents' }}>
      <div className="sim-group-title" style={{ margin: 0 }}>
        <span>컴프레서 · 큰 소리 누르기</span>
        <Switch on={comp.on} onChange={(on) => set({ on })} label={comp.on ? '켜짐' : '꺼짐'} color={color} />
      </div>
      <div className="sim-visual" style={{ justifyContent: 'center' }}>
        <TransferGraph transfer={transfer} thresholdDb={comp.thresholdDb} />
        <Meter read={() => engine?.compGrDb(ch) ?? 0} active={playing && comp.on} height={130} min={-24} reduction label="GR" />
      </div>
      <div className="sim-sliders is-2">
        <Slider label="스레숄드" hint="이 크기를 넘는 소리부터" value={comp.thresholdDb} range={r.compThreshold} onChange={(v) => set({ thresholdDb: v })} color={color} disabled={!comp.on} />
        <Slider label="레이시오" hint="넘친 만큼을 몇 분의 1로" value={comp.ratio} range={r.ratio} onChange={(v) => set({ ratio: v })} color={color} disabled={!comp.on} />
      </div>
      <More label="더 자세히: 어택·릴리스·메이크업·니">
        <Slider label="어택" value={comp.attackMs} range={r.compAttack} onChange={(v) => set({ attackMs: v })} color={color} disabled={!comp.on} />
        <Slider label="릴리스" value={comp.releaseMs} range={r.compRelease} onChange={(v) => set({ releaseMs: v })} color={color} disabled={!comp.on} />
        <Slider label="메이크업" value={comp.makeupDb} range={r.makeup} onChange={(v) => set({ makeupDb: v })} color={color} disabled={!comp.on} />
        <Slider label="니" value={comp.kneeDb} range={r.knee} onChange={(v) => set({ kneeDb: v })} color={color} disabled={!comp.on} />
      </More>
    </div>
  );
}

function MonitorTab({ store, ch }: Ctx & { ch: number }) {
  const c = useStore(store, (s) => s.channels[ch]);
  const auxes = useStore(store, (s) => s.auxes);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  return (
    <>
      <p className="mx-note">무대 모니터로 보내는 양이다. 메인 페이더와 상관없이 보낸다(pre).</p>
      {auxes.map((bus, i) => (
        <Slider
          key={i}
          label={`${bus.name}로 보내기`}
          value={c.sends[i].levelDb}
          range={r.send}
          scale="fader"
          onChange={(v) => a.setSend(ch, i, { levelDb: v })}
          color="var(--fn-bus)"
          format={fmtDb}
        />
      ))}
    </>
  );
}

/* ---------------- 모니터 2개 + 메인 ---------------- */
function Outputs(ctx: Ctx) {
  const auxes = useStore(ctx.store, (s) => s.auxes);
  return (
    <section className="mx-card" aria-label="출력">
      <div className="mx-card-head">
        <h2>모니터 · 메인</h2>
      </div>
      <div className="mx-outs">
        {auxes.map((_, i) => (
          <OutputRow key={i} {...ctx} bus={i} />
        ))}
        <OutputRow {...ctx} bus="main" />
      </div>
    </section>
  );
}

function OutputRow({ store, engine, playing, bus }: Ctx & { bus: BusRef }) {
  const b = useStore(store, (s) => (bus === 'main' ? s.main : s.auxes[bus]));
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const [open, setOpen] = useState(false);
  const response = useMemo(() => (f: number) => geqResponseDb(b.geq, f), [b.geq]);
  const cut = b.geq.some((g) => g !== 0);
  const name = bus === 'main' ? '메인 (회중석)' : b.name;
  return (
    <div className={`mx-out${bus === 'main' ? ' is-main' : ''}`}>
      <div className="mx-out-row">
        <Meter read={() => engine?.busPeakDb(bus) ?? -Infinity} active={playing} height={74} width={10} />
        <div className="grow">
          <Slider label={name} value={b.faderDb} range={r.fader} scale="fader" onChange={(v) => a.setBusFader(bus, v)} color="var(--fn-bus)" format={fmtDb} />
        </div>
      </div>
      <div className="mx-out-actions">
        <button type="button" className={`mx-toggle is-mute${b.mute ? ' is-on' : ''}`} aria-pressed={b.mute} onClick={() => a.setBusMute(bus, !b.mute)}>
          {b.mute ? '꺼짐' : '끄기'}
        </button>
        <button type="button" className={`sim-btn is-small${open ? ' is-active' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'GEQ·RTA 닫기' : 'GEQ·RTA 열기'}
          {cut && !open ? ' · 조정됨' : ''}
        </button>
      </div>
      {open && (
        <div className="mx-geq" style={{ ['--accent-fn' as string]: 'var(--fn-bus)' }}>
          <span className="sim-stat">RTA · {name}로 나가는 소리</span>
          <Rta read={() => engine?.rta(bus) ?? []} active={playing} height={96} />
          <span className="sim-stat">GEQ 모양</span>
          <ResponseGraph response={response} color="var(--fn-bus)" range={16} height={64} />
          <GeqSliders gains={b.geq} range={r.geqGain} onChange={(i, d) => a.setGeqBand(bus, i, d)} />
          <button type="button" className="sim-btn is-small" onClick={() => a.resetGeq(bus)}>
            GEQ 평평하게
          </button>
        </div>
      )}
    </div>
  );
}
