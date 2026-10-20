// 출력. 기본 보기: 모니터 2개 + 메인. 전체 보기: 모니터·그룹·FX·매트릭스·메인 탭, 버스마다 EQ·컴프 처리.
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { compTransferDb } from '../audio/dsp/dynamics';
import { geqResponseDb } from '../audio/dsp/geq';
import { More, Slider, Switch, Tabs } from '../components/ui/controls';
import { ResponseGraph, TransferGraph } from '../components/ui/CurveGraph';
import { GeqSliders } from '../components/ui/GeqSliders';
import { Meter } from '../components/ui/Meter';
import { Rta } from '../components/ui/Rta';
import { fmtDb } from '../components/ui/scale';
import { peqResponseDb } from '../stores/derived';
import type { BusRef } from '../stores/mixer';
import type { BusKind } from '../stores/mixer-model';
import { BUS_COLOR, DYN_COLOR, FX_COLOR, type Ctx } from './ctx';
import { FxControls } from './FxControls';

type OutTab = BusKind | 'matrix';

export function Outputs(ctx: Ctx) {
  const auxes = useStore(ctx.store, (s) => s.auxes);
  const matrix = useStore(ctx.store, (s) => s.matrix);
  const [tab, setTab] = useState<OutTab>('monitor');
  const of = (kind: BusKind) => auxes.map((b, i) => [b, i] as const).filter(([b]) => b.kind === kind);
  if (!ctx.full) {
    return (
      <section className="mx-card" aria-label="출력">
        <div className="mx-card-head">
          <h2>모니터 · 메인</h2>
        </div>
        <div className="mx-outs">
          {of('monitor').map(([, i]) => (
            <BusRow key={i} {...ctx} bus={i} />
          ))}
          <BusRow {...ctx} bus="main" />
        </div>
      </section>
    );
  }
  const tabs: { id: OutTab; label: string }[] = [
    { id: 'monitor', label: '모니터' },
    ...(of('group').length ? [{ id: 'group' as const, label: '그룹' }] : []),
    ...(of('fx').length ? [{ id: 'fx' as const, label: 'FX' }] : []),
    ...(matrix.length ? [{ id: 'matrix' as const, label: '매트릭스' }] : []),
    { id: 'main', label: '메인' },
  ];
  return (
    <section className="mx-card" aria-label="출력">
      <div className="mx-card-head">
        <h2>출력</h2>
      </div>
      <Tabs label="출력 종류" items={tabs} value={tab} onChange={setTab} />
      <div className="mx-outs" style={{ marginTop: 10 }}>
        {tab === 'main' && <BusRow {...ctx} bus="main" />}
        {(tab === 'monitor' || tab === 'group') && of(tab).map(([, i]) => <BusRow key={i} {...ctx} bus={i} />)}
        {tab === 'fx' && of('fx').map(([, i]) => <FxRow key={i} {...ctx} bus={i} />)}
        {tab === 'matrix' && matrix.map((_, i) => <MatrixRow key={i} {...ctx} index={i} />)}
      </div>
    </section>
  );
}

function BusRow(props: Ctx & { bus: BusRef }) {
  const { store, engine, playing, bus, full } = props;
  const b = useStore(store, (s) => (bus === 'main' ? s.main : s.auxes[bus]));
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const [open, setOpen] = useState<'geq' | 'proc' | null>(null);
  const response = useMemo(() => (f: number) => geqResponseDb(b.geq, f), [b.geq]);
  const cut = b.geq.some((g) => g !== 0);
  const name = bus === 'main' ? '메인 (회중석)' : b.name;
  const toggle = (k: 'geq' | 'proc') => setOpen(open === k ? null : k);
  return (
    <div className={`mx-out${bus === 'main' ? ' is-main' : ''}`}>
      <div className="mx-out-row">
        <Meter read={() => engine?.busPeakDb(bus) ?? -Infinity} active={playing} height={74} width={10} />
        <div className="grow">
          <Slider label={name} value={b.faderDb} range={r.fader} scale="fader" onChange={(v) => a.setBusFader(bus, v)} color={BUS_COLOR} format={fmtDb} />
        </div>
      </div>
      <div className="mx-out-actions">
        <button type="button" className={`mx-toggle is-mute${b.mute ? ' is-on' : ''}`} aria-pressed={b.mute} onClick={() => a.setBusMute(bus, !b.mute)}>
          {b.mute ? '꺼짐' : '끄기'}
        </button>
        {full && b.kind === 'group' && typeof bus === 'number' && (
          <button type="button" className={`mx-toggle is-main${b.mainAssign ? ' is-on' : ''}`} aria-pressed={b.mainAssign} onClick={() => a.setBusMainAssign(bus, !b.mainAssign)}>
            메인
          </button>
        )}
        {full && (
          <button type="button" className={`sim-btn is-small${open === 'proc' ? ' is-active' : ''}`} aria-expanded={open === 'proc'} onClick={() => toggle('proc')}>
            EQ·컴프{b.comp.on || b.peq.bands.some((x) => x.gainDb !== 0) ? ' · 켜짐' : ''}
          </button>
        )}
        <button type="button" className={`sim-btn is-small${open === 'geq' ? ' is-active' : ''}`} aria-expanded={open === 'geq'} onClick={() => toggle('geq')}>
          {open === 'geq' ? 'GEQ·RTA 닫기' : 'GEQ·RTA 열기'}
          {cut && open !== 'geq' ? ' · 조정됨' : ''}
        </button>
      </div>
      {open === 'geq' && (
        <div className="mx-geq" style={{ ['--accent-fn' as string]: BUS_COLOR }}>
          <span className="sim-stat">RTA · {name}로 나가는 소리</span>
          <Rta read={() => engine?.rta(bus) ?? []} active={playing} height={96} />
          <span className="sim-stat">GEQ 모양</span>
          <ResponseGraph response={response} color={BUS_COLOR} range={16} height={64} />
          <GeqSliders gains={b.geq} range={r.geqGain} onChange={(i, d) => a.setGeqBand(bus, i, d)} />
          <button type="button" className="sim-btn is-small" onClick={() => a.resetGeq(bus)}>
            GEQ 평평하게
          </button>
        </div>
      )}
      {open === 'proc' && <BusProcessing {...props} />}
    </div>
  );
}

const BAND_NAMES = ['저음', '중저음', '중고음', '고음'];

/** 버스 처리: 4밴드 PEQ와 컴프 */
function BusProcessing({ store, engine, playing, bus }: Ctx & { bus: BusRef }) {
  const b = useStore(store, (s) => (bus === 'main' ? s.main : s.auxes[bus]));
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const [band, setBand] = useState(1);
  const eq = useMemo(() => (f: number) => peqResponseDb(b, f), [b.peq]);
  const transfer = useMemo(() => (d: number) => compTransferDb(d, b.comp), [b.comp]);
  const bd = b.peq.bands[band];
  const setComp = (p: Parameters<typeof a.setBusComp>[1]) => a.setBusComp(bus, p);
  return (
    <div className="mx-geq">
      <div className="sim-group-title">
        <span>버스 EQ</span>
        <Switch on={b.peq.on} onChange={(on) => a.setBusPeqOn(bus, on)} />
      </div>
      <ResponseGraph response={eq} height={64} />
      <Tabs label="밴드" items={BAND_NAMES.map((n, i) => ({ id: i, label: n }))} value={band} onChange={setBand} />
      <Slider label="주파수" value={bd.freq} range={r.eqFreq} onChange={(v) => a.setBusPeqBand(bus, band, { freq: v })} disabled={!b.peq.on} />
      <Slider label="올리기·내리기" value={bd.gainDb} range={r.eqGain} onChange={(v) => a.setBusPeqBand(bus, band, { gainDb: v })} defaultValue={0} disabled={!b.peq.on} />
      <div className="sim-group-title" style={{ ['--accent-fn' as string]: DYN_COLOR }}>
        <span>버스 컴프 · 버스 전체를 같이 누르기</span>
        <Switch on={b.comp.on} onChange={(on) => setComp({ on })} color={DYN_COLOR} />
      </div>
      <div className="sim-visual" style={{ justifyContent: 'center' }}>
        <TransferGraph transfer={transfer} thresholdDb={b.comp.thresholdDb} />
        <Meter read={() => engine?.busCompGrDb(bus) ?? 0} active={playing && b.comp.on} height={110} min={-24} reduction label="GR" />
      </div>
      <Slider label="스레숄드" value={b.comp.thresholdDb} range={r.compThreshold} onChange={(v) => setComp({ thresholdDb: v })} color={DYN_COLOR} disabled={!b.comp.on} />
      <Slider label="레이시오" value={b.comp.ratio} range={r.ratio} onChange={(v) => setComp({ ratio: v })} color={DYN_COLOR} disabled={!b.comp.on} />
      <More label="더 자세히: 어택·릴리스·메이크업">
        <Slider label="어택" value={b.comp.attackMs} range={r.compAttack} onChange={(v) => setComp({ attackMs: v })} color={DYN_COLOR} disabled={!b.comp.on} />
        <Slider label="릴리스" value={b.comp.releaseMs} range={r.compRelease} onChange={(v) => setComp({ releaseMs: v })} color={DYN_COLOR} disabled={!b.comp.on} />
        <Slider label="메이크업" value={b.comp.makeupDb} range={r.makeup} onChange={(v) => setComp({ makeupDb: v })} color={DYN_COLOR} disabled={!b.comp.on} />
      </More>
    </div>
  );
}

function FxRow({ store, engine, playing, bus, bpm }: Ctx & { bus: number }) {
  const b = useStore(store, (s) => s.auxes[bus]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-out" style={{ ['--accent-fn' as string]: FX_COLOR }}>
      <div className="mx-out-row">
        <Meter read={() => engine?.busPeakDb(bus) ?? -Infinity} active={playing} height={74} width={10} />
        <div className="grow">
          <Slider label={`${b.name} · 보내는 양 합계`} hint="채널들이 보낸 소리를 이펙트에 얼마나 넣을지" value={b.faderDb} range={r.fader} scale="fader" onChange={(v) => a.setBusFader(bus, v)} color={FX_COLOR} format={fmtDb} />
        </div>
      </div>
      <div className="mx-out-row">
        <Meter read={() => engine?.fxReturnPeakDb(bus) ?? -Infinity} active={playing} height={74} width={10} />
        <div className="grow">
          <Slider label="리턴 · 돌아오는 이펙트 소리" value={b.returnDb} range={r.fader} scale="fader" onChange={(v) => a.setFxReturn(bus, { returnDb: v })} color={FX_COLOR} format={fmtDb} />
        </div>
      </div>
      <div className="mx-out-actions">
        <button type="button" className={`mx-toggle is-mute${b.returnMute ? ' is-on' : ''}`} aria-pressed={b.returnMute} onClick={() => a.setFxReturn(bus, { returnMute: !b.returnMute })}>
          {b.returnMute ? '리턴 꺼짐' : '리턴 끄기'}
        </button>
        <button type="button" className={`mx-toggle is-main${b.mainAssign ? ' is-on' : ''}`} aria-pressed={b.mainAssign} onClick={() => a.setBusMainAssign(bus, !b.mainAssign)}>
          메인
        </button>
        <button type="button" className={`sim-btn is-small${open ? ' is-active' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '이펙트 설정 닫기' : '이펙트 설정'}
        </button>
      </div>
      {open && (
        <div className="mx-geq">
          <FxControls fx={b.fx} ranges={r} bpm={bpm} onChange={(p) => a.setFx(bus, p)} />
        </div>
      )}
    </div>
  );
}

function MatrixRow({ store, engine, playing, index }: Ctx & { index: number }) {
  const m = useStore(store, (s) => s.matrix[index]);
  const auxes = useStore(store, (s) => s.auxes);
  const r = useStore(store, (s) => s.profile.ranges);
  const listening = useStore(store, (s) => s.listen === `matrix-${index}`);
  const a = useStore(store, (s) => s.actions);
  return (
    <div className="mx-out">
      <p className="mx-note">메인과 그룹을 다시 섞어 따로 내보낸다(로비·방송). 채널은 여기로 바로 보낼 수 없다.</p>
      <div className="mx-out-row">
        <Meter read={() => engine?.matrixPeakDb(index) ?? -Infinity} active={playing} height={74} width={10} />
        <div className="grow">
          <Slider label={m.name} value={m.faderDb} range={r.fader} scale="fader" onChange={(v) => a.setMatrix(index, { faderDb: v })} color={BUS_COLOR} format={fmtDb} />
        </div>
      </div>
      <Slider label="메인에서 받기" value={m.fromMainDb} range={r.send} scale="fader" onChange={(v) => a.setMatrix(index, { fromMainDb: v })} color={BUS_COLOR} format={fmtDb} />
      {auxes.map((b, i) =>
        b.kind !== 'group' ? null : (
          <Slider key={i} label={`${b.name}에서 받기`} value={m.fromBusDb[i]} range={r.send} scale="fader" onChange={(v) => a.setMatrix(index, { fromBus: { bus: i, db: v } })} color={BUS_COLOR} format={fmtDb} />
        ),
      )}
      <div className="mx-out-actions">
        <button type="button" className={`mx-toggle is-mute${m.mute ? ' is-on' : ''}`} aria-pressed={m.mute} onClick={() => a.setMatrix(index, { mute: !m.mute })}>
          {m.mute ? '꺼짐' : '끄기'}
        </button>
        <button type="button" className={`sim-btn is-small${listening ? ' is-active' : ''}`} aria-pressed={listening} onClick={() => a.setListen(listening ? 'main' : `matrix-${index}`)}>
          {listening ? '매트릭스 듣는 중' : '이어폰으로 듣기'}
        </button>
      </div>
    </div>
  );
}
