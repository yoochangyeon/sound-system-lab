// 선택한 채널 상세. 기본 보기: 입력·EQ·컴프·모니터. 전체 보기: 입력·게이트·EQ·컴프·인서트·센드·설정.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { compTransferDb } from '../audio/dsp/dynamics';
import { More, Slider, Switch, Tabs } from '../components/ui/controls';
import { ResponseGraph, TransferGraph } from '../components/ui/CurveGraph';
import { Meter } from '../components/ui/Meter';
import { fmtDb, inputVerdict } from '../components/ui/scale';
import { channelEqResponseDb, inputPeakDb } from '../stores/derived';
import type { CompState, GateState, KeyFilter, KeyState, SendTap } from '../stores/mixer-model';
import type { Range } from '../stores/profile';
import { BUS_COLOR, DYN_COLOR, FX_COLOR, type Ctx } from './ctx';
import { FxControls } from './FxControls';

type DetailTab = 'input' | 'gate' | 'eq' | 'comp' | 'insert' | 'mon' | 'config';

const BASIC_TABS: { id: DetailTab; label: string }[] = [
  { id: 'input', label: '입력' },
  { id: 'eq', label: 'EQ' },
  { id: 'comp', label: '컴프' },
  { id: 'mon', label: '모니터' },
];
const FULL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'input', label: '입력' },
  { id: 'gate', label: '게이트' },
  { id: 'eq', label: 'EQ' },
  { id: 'comp', label: '컴프' },
  { id: 'insert', label: '인서트' },
  { id: 'mon', label: '센드' },
  { id: 'config', label: '설정' },
];

export function ChannelDetail(props: Ctx & { ch: number }) {
  const { store, ch, full } = props;
  const c = useStore(store, (s) => s.channels[ch]);
  const [tab, setTab] = useState<DetailTab>('input');
  const tabs = full ? FULL_TABS : BASIC_TABS;
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab('input');
  }, [full]);
  return (
    <section className="mx-card" aria-label="채널 상세">
      <div className="mx-card-head">
        <h2>
          <span className="mx-chno">{ch + 1}</span> {c.name}
        </h2>
      </div>
      <Tabs label="채널 처리" items={tabs} value={tab} onChange={setTab} />
      <div className="mx-detail-body">
        {tab === 'input' && <InputTab {...props} />}
        {tab === 'gate' && <GateTab {...props} />}
        {tab === 'eq' && <EqTab {...props} />}
        {tab === 'comp' && <CompTab {...props} />}
        {tab === 'insert' && <InsertTab {...props} />}
        {tab === 'mon' && (full ? <SendsTab {...props} /> : <MonitorTab {...props} />)}
        {tab === 'config' && <ConfigTab {...props} />}
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
      : inputVerdict(est);
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
        <label className="sim-group-title">
          <span>HPF · 저음 자르기</span>
          <Switch on={c.preamp.hpfOn} onChange={(on) => a.setPreamp(ch, { hpfOn: on })} />
        </label>
        <Slider label="차단 주파수" value={c.preamp.hpfFreq} range={r.hpfFreq} onChange={(v) => a.setPreamp(ch, { hpfFreq: v })} disabled={!c.preamp.hpfOn} />
      </div>
      <div className="sim-group">
        <label className="sim-group-title">
          <span>LPF · 고음 자르기</span>
          <Switch on={c.preamp.lpfOn} onChange={(on) => a.setPreamp(ch, { lpfOn: on })} />
        </label>
        <Slider label="차단 주파수" value={c.preamp.lpfFreq} range={r.lpfFreq} onChange={(v) => a.setPreamp(ch, { lpfFreq: v })} disabled={!c.preamp.lpfOn} />
      </div>
      <div className="sim-group">
        <label className="sim-group-title">
          <span>PEQ · 대역 다듬기</span>
          <Switch on={c.peq.on} onChange={(on) => a.setPeqOn(ch, on)} />
        </label>
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

/** 사이드체인(키) 설정: 무엇을 듣고 움직일지 */
function KeySection({
  k,
  on,
  ch,
  names,
  ranges,
  onChange,
}: {
  k: KeyState;
  on: boolean;
  ch: number;
  names: string[];
  ranges: Record<string, Range>;
  onChange: (p: Partial<KeyState>) => void;
}) {
  const FILTERS: { id: KeyFilter; label: string }[] = [
    { id: 'off', label: '필터 끔' },
    { id: 'lowcut', label: '로우컷' },
    { id: 'highcut', label: '하이컷' },
    { id: 'band', label: '대역' },
  ];
  return (
    <More label="더 자세히: 사이드체인(키)">
      <p className="mx-note">무엇을 듣고 움직일지 정한다. 다른 채널을 고르면 그 채널 소리가 클 때 이 채널을 줄인다(덕킹).</p>
      <label className="mx-field">
        <span>키 소스</span>
        <select value={String(k.source)} disabled={!on} onChange={(e) => onChange({ source: e.target.value === 'self' ? 'self' : Number(e.target.value) })}>
          <option value="self">이 채널</option>
          {names.map((n, i) =>
            i === ch ? null : (
              <option key={i} value={i}>
                {i + 1} {n}
              </option>
            ),
          )}
        </select>
      </label>
      <Tabs label="키 필터" items={FILTERS} value={k.filter} onChange={(filter) => onChange({ filter })} />
      <Slider label="키 필터 주파수" value={k.freq} range={ranges.keyFreq} onChange={(freq) => onChange({ freq })} color={DYN_COLOR} disabled={!on || k.filter === 'off'} />
      <label className="sim-group-title">
        <span>키 듣기 · 필터를 지난 소리만 들어 보기</span>
        <Switch on={k.listen} onChange={(listen) => onChange({ listen })} color={DYN_COLOR} />
      </label>
    </More>
  );
}

function GateTab({ store, engine, playing, ch }: Ctx & { ch: number }) {
  const g = useStore(store, (s) => s.channels[ch].gate);
  const names = useStore(store, useShallow((s) => s.channels.map((x) => x.name)));
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const set = (p: Parameters<typeof a.setGate>[1]) => a.setGate(ch, p);
  const MODES: { id: GateState['mode']; label: string }[] = [
    { id: 'gate', label: '게이트' },
    { id: 'exp', label: '익스팬더' },
    { id: 'duck', label: '덕킹' },
  ];
  const hint = {
    gate: '작은 소리일 때 문을 닫는다(레인지만큼 줄인다)',
    exp: '작을수록 비율만큼 더 작게. 게이트보다 덜 뚝 끊긴다',
    duck: '키 소스가 클 때 이 채널을 레인지만큼 줄인다',
  }[g.mode];
  return (
    <div style={{ ['--accent-fn' as string]: DYN_COLOR, display: 'contents' }}>
      <div className="sim-group-title" style={{ margin: 0 }}>
        <span>게이트 · 작은 소리 줄이기</span>
        <Switch on={g.on} onChange={(on) => set({ on })} label={g.on ? '켜짐' : '꺼짐'} color={DYN_COLOR} />
      </div>
      <Tabs label="게이트 모드" items={MODES} value={g.mode} onChange={(mode) => set({ mode })} />
      <p className="mx-note">{hint}</p>
      <div className="sim-visual" style={{ justifyContent: 'center' }}>
        <Meter read={() => engine?.gateGrDb(ch) ?? 0} active={playing && g.on} height={100} min={-60} reduction label="감쇠" />
      </div>
      <div className="sim-sliders is-2">
        <Slider label="스레숄드" value={g.thresholdDb} range={r.gateThreshold} onChange={(v) => set({ thresholdDb: v })} color={DYN_COLOR} disabled={!g.on} />
        <Slider label="레인지" hint="최대로 줄이는 양" value={g.rangeDb} range={r.gateRange} onChange={(v) => set({ rangeDb: v })} color={DYN_COLOR} disabled={!g.on} />
      </div>
      {g.mode === 'exp' && <Slider label="비율" hint="1:2면 스레숄드 아래 1 dB마다 2 dB" value={g.expRatio} range={r.expRatio} onChange={(v) => set({ expRatio: v })} color={DYN_COLOR} disabled={!g.on} />}
      <More label="더 자세히: 어택·홀드·릴리스">
        <Slider label="어택" value={g.attackMs} range={r.gateAttack} onChange={(v) => set({ attackMs: v })} color={DYN_COLOR} disabled={!g.on} />
        <Slider label="홀드" value={g.holdMs} range={r.gateHold} onChange={(v) => set({ holdMs: v })} color={DYN_COLOR} disabled={!g.on} />
        <Slider label="릴리스" value={g.releaseMs} range={r.gateRelease} onChange={(v) => set({ releaseMs: v })} color={DYN_COLOR} disabled={!g.on} />
      </More>
      <KeySection k={g.key} on={g.on} ch={ch} names={names} ranges={r} onChange={(key) => set({ key })} />
    </div>
  );
}

function CompTab({ store, engine, playing, ch, full }: Ctx & { ch: number }) {
  const comp = useStore(store, (s) => s.channels[ch].comp);
  const names = useStore(store, useShallow((s) => s.channels.map((x) => x.name)));
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const set = (p: Parameters<typeof a.setComp>[1]) => a.setComp(ch, p);
  const transfer = useMemo(() => (d: number) => compTransferDb(d, comp), [comp]);
  const MODES: { id: CompState['mode']; label: string }[] = [
    { id: 'comp', label: '컴프' },
    { id: 'exp', label: '익스팬더' },
  ];
  return (
    <div style={{ ['--accent-fn' as string]: DYN_COLOR, display: 'contents' }}>
      <div className="sim-group-title" style={{ margin: 0 }}>
        <span>컴프레서 · 큰 소리 누르기</span>
        <Switch on={comp.on} onChange={(on) => set({ on })} label={comp.on ? '켜짐' : '꺼짐'} color={DYN_COLOR} />
      </div>
      {full && <Tabs label="컴프 모드" items={MODES} value={comp.mode} onChange={(mode) => set({ mode })} />}
      <div className="sim-visual" style={{ justifyContent: 'center' }}>
        <TransferGraph transfer={transfer} thresholdDb={comp.thresholdDb} />
        <Meter read={() => engine?.compGrDb(ch) ?? 0} active={playing && comp.on} height={130} min={-24} reduction label="GR" />
      </div>
      <div className="sim-sliders is-2">
        <Slider label="스레숄드" hint="이 크기를 넘는 소리부터" value={comp.thresholdDb} range={r.compThreshold} onChange={(v) => set({ thresholdDb: v })} color={DYN_COLOR} disabled={!comp.on} />
        <Slider label="레이시오" hint="넘친 만큼을 몇 분의 1로" value={comp.ratio} range={r.ratio} onChange={(v) => set({ ratio: v })} color={DYN_COLOR} disabled={!comp.on} />
      </div>
      <More label={full ? '더 자세히: 어택·릴리스·메이크업·니·Mix·검출' : '더 자세히: 어택·릴리스·메이크업·니'}>
        <Slider label="어택" value={comp.attackMs} range={r.compAttack} onChange={(v) => set({ attackMs: v })} color={DYN_COLOR} disabled={!comp.on} />
        <Slider label="릴리스" value={comp.releaseMs} range={r.compRelease} onChange={(v) => set({ releaseMs: v })} color={DYN_COLOR} disabled={!comp.on} />
        <Slider label="메이크업" value={comp.makeupDb} range={r.makeup} onChange={(v) => set({ makeupDb: v })} color={DYN_COLOR} disabled={!comp.on} />
        <Slider label="니" hint="0이면 스레숄드에서 딱 꺾이고, 크면 부드럽게 눌리기 시작한다" value={comp.kneeDb} range={r.knee} onChange={(v) => set({ kneeDb: v })} color={DYN_COLOR} disabled={!comp.on} />
        {full && (
          <>
            <Slider label="Mix(병렬 압축)" hint="100%면 눌린 소리만, 낮추면 원음과 섞는다" value={comp.mixPct} range={r.mix} onChange={(v) => set({ mixPct: v })} color={DYN_COLOR} disabled={!comp.on} />
            <Tabs
              label="검출"
              items={[
                { id: 'peak' as const, label: 'Peak(순간)' },
                { id: 'rms' as const, label: 'RMS(평균)' },
              ]}
              value={comp.detector}
              onChange={(detector) => set({ detector })}
            />
          </>
        )}
      </More>
      {full && <KeySection k={comp.key} on={comp.on} ch={ch} names={names} ranges={r} onChange={(key) => set({ key })} />}
    </div>
  );
}

function InsertTab({ store, ch, bpm }: Ctx & { ch: number }) {
  const ins = useStore(store, (s) => s.channels[ch].insert);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  return (
    <div style={{ ['--accent-fn' as string]: FX_COLOR, display: 'contents' }}>
      <div className="sim-group-title" style={{ margin: 0 }}>
        <span>인서트 · 이 채널에 이펙트를 직접 끼우기</span>
        <Switch on={ins.on} onChange={(on) => a.setInsert(ch, { on })} label={ins.on ? '켜짐' : '꺼짐'} color={FX_COLOR} />
      </div>
      <p className="mx-note">채널 소리가 이펙트를 통째로 지나간다. 여러 채널에 같은 리버브를 걸려면 센드 탭의 FX 버스(Send/Return)가 낫다.</p>
      <Slider label="Mix" hint="이펙트 소리의 비율" value={ins.mixPct} range={r.mix} onChange={(v) => a.setInsert(ch, { mixPct: v })} color={FX_COLOR} disabled={!ins.on} />
      <FxControls fx={ins.fx} ranges={r} bpm={bpm} onChange={(fx) => a.setInsert(ch, { fx })} disabled={!ins.on} />
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
      <p className="mx-note">무대 모니터로 보내는 양이다. 채널 페이더 앞에서 떼어 보낸다(pre).</p>
      {auxes.map((bus, i) =>
        bus.kind !== 'monitor' ? null : (
          <Slider key={i} label={`${bus.name}로 보내기`} value={c.sends[i].levelDb} range={r.send} scale="fader" onChange={(v) => a.setSend(ch, i, { levelDb: v })} color={BUS_COLOR} format={fmtDb} />
        ),
      )}
    </>
  );
}

const TAPS: { id: SendTap; label: string }[] = [
  { id: 'pre-eq', label: 'EQ 앞' },
  { id: 'pre', label: '페이더 앞' },
  { id: 'post', label: '페이더 뒤' },
];

function SendsTab({ store, ch }: Ctx & { ch: number }) {
  const c = useStore(store, (s) => s.channels[ch]);
  const auxes = useStore(store, (s) => s.auxes);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const section = (kind: 'monitor' | 'group' | 'fx', title: string, note: string) => (
    <div className="sim-group">
      <div className="sim-group-title">
        <span>{title}</span>
      </div>
      <p className="mx-note">{note}</p>
      {auxes.map((bus, i) => {
        if (bus.kind !== kind) return null;
        const sd = c.sends[i];
        if (kind === 'group') {
          const on = sd.levelDb !== -Infinity;
          return (
            <div key={i} className="sim-group-title">
              <span>{bus.name}</span>
              <Switch on={on} onChange={(v) => a.setSend(ch, i, { levelDb: v ? 0 : -Infinity })} label={on ? '보냄' : '안 보냄'} color={BUS_COLOR} />
            </div>
          );
        }
        return (
          <div key={i} className="mx-send">
            <Slider label={`${bus.name}로 보내기`} value={sd.levelDb} range={r.send} scale="fader" onChange={(v) => a.setSend(ch, i, { levelDb: v })} color={kind === 'fx' ? FX_COLOR : BUS_COLOR} format={fmtDb} />
            <Tabs label={`${bus.name} 센드 위치`} items={TAPS} value={sd.tap} onChange={(tap) => a.setSend(ch, i, { tap })} />
          </div>
        );
      })}
    </div>
  );
  return (
    <>
      {section('monitor', '모니터', '무대 모니터는 보통 채널 페이더 앞(pre)에서 보낸다. 회중석 소리를 맞추려고 채널 페이더를 움직여도 연주자 모니터는 바뀌지 않는다.')}
      {section('fx', 'FX(이펙트)', '리버브·딜레이는 보통 페이더 뒤(post)에서 보낸다. 페이더를 내리면 잔향도 같이 줄어든다.')}
      {section('group', '그룹', '그룹으로 보내면 그룹 페이더 하나로 여러 채널을 같이 줄인다. 그룹으로만 보내려면 채널의 메인을 끈다.')}
    </>
  );
}

const PAN_RANGE: Range = { min: -1, max: 1, step: 0.05, unit: '' };
const fmtPan = (v: number) => (Math.abs(v) < 0.025 ? '가운데' : v < 0 ? `왼쪽 ${Math.round(-v * 100)}` : `오른쪽 ${Math.round(v * 100)}`);

function ConfigTab({ store, ch }: Ctx & { ch: number }) {
  const c = useStore(store, (s) => s.channels[ch]);
  const linked = useStore(store, (s) => s.links[ch >> 1] ?? false);
  const mate = useStore(store, (s) => s.channels[ch ^ 1]);
  const dca = useStore(store, (s) => s.dca);
  const muteGroups = useStore(store, (s) => s.muteGroups);
  const safe = useStore(store, (s) => s.safes[ch]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const pair = ch >> 1;
  return (
    <>
      <Slider label="팬" hint="메인·그룹에서 왼쪽·오른쪽 어디에 둘지" value={c.pan} range={PAN_RANGE} onChange={(v) => a.setPan(ch, v)} format={fmtPan} defaultValue={0} />
      <label className="sim-group-title">
        <span>극성 반전 · 파형을 위아래로 뒤집기</span>
        <Switch on={c.preamp.invert} onChange={(invert) => a.setPreamp(ch, { invert })} />
      </label>
      <div className="sim-group">
        <label className="sim-group-title">
          <span>채널 딜레이 · 소리를 늦추기(에코가 아니다)</span>
          <Switch on={c.preamp.delayOn} onChange={(delayOn) => a.setPreamp(ch, { delayOn })} />
        </label>
        <Slider label="늦추는 시간" hint="1 ms는 소리가 약 34 cm 가는 시간" value={c.preamp.delayMs} range={r.delay} onChange={(v) => a.setPreamp(ch, { delayMs: v })} disabled={!c.preamp.delayOn} />
      </div>
      {mate && (
        <label className="sim-group-title">
          <span>
            스테레오 링크 · {pair * 2 + 1}·{pair * 2 + 2}번을 같이 움직이기
          </span>
          <Switch on={linked} onChange={(on) => a.setLink(pair, on)} />
        </label>
      )}
      <div className="sim-group">
        <div className="sim-group-title">
          <span>DCA · 원격 페이더에 묶기</span>
        </div>
        <div className="sim-chips">
          {dca.map((d, i) => (
            <button key={i} type="button" className={`sim-chip${d.members[ch] ? ' is-active' : ''}`} aria-pressed={d.members[ch]} onClick={() => a.setDcaMember(i, ch, !d.members[ch])}>
              {d.name}
            </button>
          ))}
        </div>
      </div>
      <div className="sim-group">
        <div className="sim-group-title">
          <span>뮤트 그룹 · 한꺼번에 끄기</span>
        </div>
        <div className="sim-chips">
          {muteGroups.map((g, i) => (
            <button key={i} type="button" className={`sim-chip${g.members[ch] ? ' is-active' : ''}`} aria-pressed={g.members[ch]} onClick={() => a.setMuteGroupMember(i, ch, !g.members[ch])}>
              {g.name}
            </button>
          ))}
        </div>
      </div>
      <label className="sim-group-title">
        <span>리콜 세이프 · 씬을 불러와도 이 채널은 그대로</span>
        <Switch on={safe} onChange={(on) => a.setSafe(ch, on)} />
      </label>
    </>
  );
}
