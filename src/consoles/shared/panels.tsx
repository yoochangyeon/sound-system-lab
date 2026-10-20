// 콘솔 화면 조각들. X32 스타일과 dLive 스타일이 같이 쓰고, 배치만 다르게 한다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { compTransferDb } from '../../audio/dsp/dynamics';
import { GEQ_FREQS, geqResponseDb } from '../../audio/dsp/geq';
import type { MixerEngine } from '../../audio/engine';
import { channelEqResponseDb } from '../../stores/derived';
import type { MixerStoreApi } from '../../stores/mixer';
import { ResponseGraph, TransferGraph } from '../../components/ui/CurveGraph';
import { Fader } from '../../components/ui/Fader';
import { GeqSliders } from '../../components/ui/GeqSliders';
import { Knob } from '../../components/ui/Knob';
import { Meter } from '../../components/ui/Meter';
import { Rta } from '../../components/ui/Rta';

export interface PanelProps {
  store: MixerStoreApi;
  engine: MixerEngine | null;
  playing: boolean;
}

export type StripSection = 'preamp' | 'gate' | 'peq' | 'comp';

export const SECTION_LABEL: Record<StripSection, string> = {
  preamp: '프리엠프·HPF',
  gate: '게이트',
  peq: 'PEQ',
  comp: '컴프레서',
};

function OnButton({ on, onClick, label = '' }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" className={`sim-btn is-small${on ? ' is-active' : ''}`} aria-pressed={on} onClick={onClick}>
      {label}
      {on ? '켜짐' : '꺼짐'}
    </button>
  );
}

/** 선택한 채널의 처리 구역 하나. */
export function StripSectionPanel({ store, engine, playing, ch, section, big }: PanelProps & { ch: number; section: StripSection; big?: boolean }) {
  const c = useStore(store, (s) => s.channels[ch]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const eq = useMemo(() => (f: number) => channelEqResponseDb(c, f), [c]);
  const transfer = useMemo(() => (d: number) => compTransferDb(d, c.comp), [c.comp]);
  const size = big ? 60 : 48;

  if (section === 'preamp') {
    return (
      <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-preamp)' }}>
        <div className="sim-group-title">
          <span>{SECTION_LABEL.preamp}</span>
          <OnButton on={c.preamp.hpfOn} onClick={() => a.setPreamp(ch, { hpfOn: !c.preamp.hpfOn })} label="HPF " />
        </div>
        <div className="sim-row is-center">
          <Knob label="게인" value={c.preamp.gainDb} range={r.gain} onChange={(v) => a.setPreamp(ch, { gainDb: v })} color="var(--fn-preamp)" size={size + 8} />
          <Meter read={() => engine?.inputPeakDb(ch) ?? -Infinity} active={playing} height={big ? 130 : 100} label="입력" />
          <Knob
            label="HPF"
            value={c.preamp.hpfFreq}
            range={r.hpfFreq}
            onChange={(v) => a.setPreamp(ch, { hpfFreq: v })}
            color="var(--fn-preamp)"
            size={size}
            disabled={!c.preamp.hpfOn}
          />
        </div>
      </div>
    );
  }

  if (section === 'gate') {
    const g = c.gate;
    const set = (p: Partial<typeof g>) => a.setGate(ch, p);
    return (
      <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-dyn)' }}>
        <div className="sim-group-title">
          <span>{SECTION_LABEL.gate}</span>
          <OnButton on={g.on} onClick={() => set({ on: !g.on })} />
        </div>
        <div className="sim-row is-center">
          <Knob label="스레숄드" value={g.thresholdDb} range={r.gateThreshold} onChange={(v) => set({ thresholdDb: v })} color="var(--fn-dyn)" size={size} disabled={!g.on} />
          <Knob label="레인지" value={g.rangeDb} range={r.gateRange} onChange={(v) => set({ rangeDb: v })} color="var(--fn-dyn)" size={size} disabled={!g.on} />
          <Knob label="어택" value={g.attackMs} range={r.gateAttack} onChange={(v) => set({ attackMs: v })} color="var(--fn-dyn)" size={size} disabled={!g.on} />
          <Knob label="홀드" value={g.holdMs} range={r.gateHold} onChange={(v) => set({ holdMs: v })} color="var(--fn-dyn)" size={size} disabled={!g.on} />
          <Knob label="릴리스" value={g.releaseMs} range={r.gateRelease} onChange={(v) => set({ releaseMs: v })} color="var(--fn-dyn)" size={size} disabled={!g.on} />
          <Meter read={() => engine?.gateGrDb(ch) ?? 0} active={playing && g.on} height={big ? 110 : 90} min={-60} reduction label="GR" />
        </div>
      </div>
    );
  }

  if (section === 'peq') {
    return (
      <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-eq)' }}>
        <div className="sim-group-title">
          <span>{SECTION_LABEL.peq}</span>
          <OnButton on={c.peq.on} onClick={() => a.setPeqOn(ch, !c.peq.on)} />
        </div>
        <ResponseGraph response={eq} height={big ? 130 : 96} />
        <div className="sim-row" style={{ marginTop: 6 }}>
          {c.peq.bands.map((b, i) => (
            <div key={i} className="con-band">
              <div className="con-band-name">
                {i + 1}. {b.type === 'lowshelf' ? '로우셸프' : b.type === 'highshelf' ? '하이셸프' : '피킹'}
              </div>
              <div className="sim-row">
                <Knob label="주파수" value={b.freq} range={r.eqFreq} onChange={(v) => a.setPeqBand(ch, i, { freq: v })} size={size - 6} disabled={!c.peq.on} />
                <Knob label="게인" value={b.gainDb} range={r.eqGain} onChange={(v) => a.setPeqBand(ch, i, { gainDb: v })} size={size - 6} disabled={!c.peq.on} />
                {b.type === 'peaking' && (
                  <Knob label="Q" value={b.q} range={r.eqQ} onChange={(v) => a.setPeqBand(ch, i, { q: v })} size={size - 6} disabled={!c.peq.on} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const k = c.comp;
  const set = (p: Partial<typeof k>) => a.setComp(ch, p);
  return (
    <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-dyn)' }}>
      <div className="sim-group-title">
        <span>{SECTION_LABEL.comp}</span>
        <OnButton on={k.on} onClick={() => set({ on: !k.on })} />
      </div>
      <div className="sim-row is-center">
        <TransferGraph transfer={transfer} thresholdDb={k.thresholdDb} />
        <Knob label="스레숄드" value={k.thresholdDb} range={r.compThreshold} onChange={(v) => set({ thresholdDb: v })} color="var(--fn-dyn)" size={size} disabled={!k.on} />
        <Knob label="레이시오" value={k.ratio} range={r.ratio} onChange={(v) => set({ ratio: v })} color="var(--fn-dyn)" size={size} disabled={!k.on} />
        <Knob label="니" value={k.kneeDb} range={r.knee} onChange={(v) => set({ kneeDb: v })} color="var(--fn-dyn)" size={size} disabled={!k.on} />
        <Knob label="어택" value={k.attackMs} range={r.compAttack} onChange={(v) => set({ attackMs: v })} color="var(--fn-dyn)" size={size} disabled={!k.on} />
        <Knob label="릴리스" value={k.releaseMs} range={r.compRelease} onChange={(v) => set({ releaseMs: v })} color="var(--fn-dyn)" size={size} disabled={!k.on} />
        <Knob label="메이크업" value={k.makeupDb} range={r.makeup} onChange={(v) => set({ makeupDb: v })} color="var(--fn-dyn)" size={size} disabled={!k.on} />
        <Meter read={() => engine?.compGrDb(ch) ?? 0} active={playing && k.on} height={big ? 110 : 90} min={-24} reduction label="GR" />
      </div>
      <div className="sim-row is-center">
        <span className="sim-stat">검출</span>
        {(['peak', 'rms'] as const).map((d) => (
          <button key={d} type="button" className={`sim-btn is-small${k.detector === d ? ' is-active' : ''}`} aria-pressed={k.detector === d} onClick={() => set({ detector: d })} disabled={!k.on}>
            {d === 'peak' ? 'Peak' : 'RMS'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 버스(메인 또는 Aux)의 GEQ와 RTA. */
export function BusGeqPanel({ store, engine, playing, bus, first, last }: PanelProps & { bus: 'main' | number; first?: number; last?: number }) {
  const b = useStore(store, (s) => (bus === 'main' ? s.main : s.auxes[bus]));
  const range = useStore(store, (s) => s.profile.ranges.geqGain);
  const a = useStore(store, (s) => s.actions);
  const response = useMemo(() => (f: number) => geqResponseDb(b.geq, f), [b.geq]);
  const lo = first ?? 0;
  const hi = last ?? GEQ_FREQS.length - 1;
  return (
    <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-bus)' }}>
      <div className="sim-group-title">
        <span>
          {b.name} · GEQ {hi - lo + 1}밴드 + RTA
        </span>
        <button type="button" className="sim-btn is-small" onClick={() => a.resetGeq(bus)}>
          GEQ 평평하게
        </button>
      </div>
      <Rta read={() => engine?.rta(bus) ?? []} active={playing} height={96} first={lo} last={hi} />
      <ResponseGraph response={response} color="var(--fn-bus)" range={16} height={64} />
      <GeqSliders gains={b.geq} range={range} onChange={(i, d) => a.setGeqBand(bus, i, d)} first={lo} last={hi} />
    </div>
  );
}

/** Aux 하나: 채널별 센드(레벨·pre/post), Aux 페이더·뮤트. */
export function AuxSendsPanel({ store, engine, playing, aux }: PanelProps & { aux: number }) {
  const channels = useStore(store, (s) => s.channels);
  const bus = useStore(store, (s) => s.auxes[aux]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  return (
    <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-bus)' }}>
      <div className="sim-group-title">
        <span>{bus.name} · 채널별 센드</span>
      </div>
      <div className="con-sends">
        {channels.map((c, i) => (
          <div key={i} className="con-send">
            <div className="con-send-name" title={c.name}>
              {i + 1}. {c.name}
            </div>
            <Knob label="센드" value={c.sends[aux].levelDb} range={r.send} onChange={(v) => a.setSend(i, aux, { levelDb: v })} color="var(--fn-bus)" size={40} />
            <button
              type="button"
              className={`sim-btn is-small${c.sends[aux].pre ? ' is-active' : ''}`}
              aria-pressed={c.sends[aux].pre}
              onClick={() => a.setSend(i, aux, { pre: !c.sends[aux].pre })}
              title="pre: 채널 페이더와 상관없이 보냄 / post: 채널 페이더를 따라감"
            >
              {c.sends[aux].pre ? 'PRE' : 'POST'}
            </button>
          </div>
        ))}
        <div className="con-send con-send-master">
          <div className="con-send-name">{bus.name}</div>
          <Fader label={`${bus.name} 페이더`} value={bus.faderDb} onChange={(v) => a.setBusFader(aux, v)} height={130} color="var(--fn-bus)" />
          <Meter read={() => engine?.busPeakDb(aux) ?? -Infinity} active={playing} height={100} />
          <button type="button" className={`sim-btn is-small is-mute${bus.mute ? ' is-active' : ''}`} aria-pressed={bus.mute} onClick={() => a.setBusMute(aux, !bus.mute)}>
            MUTE
          </button>
        </div>
      </div>
    </div>
  );
}

/** 라우팅/패치: 채널마다 어떤 입력(무대 박스 단자)이 꽂혀 있는지. */
export function RoutingPanel({ store }: { store: MixerStoreApi }) {
  const inputs = useStore(store, (s) => s.inputs);
  const patch = useStore(store, (s) => s.patch);
  const channels = useStore(store, (s) => s.channels);
  const a = useStore(store, (s) => s.actions);
  const stemLabel = (i: number | null) => {
    if (i === null) return '연결 없음';
    const input = inputs[i];
    return input.stemId ? `${input.label}` : `${input.label} (빈 단자)`;
  };
  return (
    <div className="con-section" style={{ ['--accent-fn' as string]: 'var(--fn-preamp)' }}>
      <div className="sim-group-title">
        <span>입력 패치: 무대 박스 단자 → 채널</span>
      </div>
      <div className="con-patch">
        {channels.map((c, ch) => (
          <label key={ch} className={`con-patch-row${patch[ch] !== null && !inputs[patch[ch]!]?.stemId ? ' is-empty' : ''}`}>
            <span className="con-patch-ch">
              CH {ch + 1} <small>{c.name}</small>
            </span>
            <select value={patch[ch] ?? ''} onChange={(e) => a.setPatch(ch, e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">연결 없음</option>
              {inputs.map((inp, i) => (
                <option key={i} value={i}>
                  {stemLabel(i)}
                  {inp.stemId ? '' : ''}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="sim-stat" style={{ marginTop: 8 }}>
        무대 박스 단자: {inputs.map((inp) => `${inp.label}${inp.stemId ? '' : '(빈)'}`).join(' · ')}
      </p>
    </div>
  );
}

/** 메인: 레벨, 뮤트, 미터. */
export function MainStripPanel({ store, engine, playing }: PanelProps) {
  const main = useStore(store, (s) => s.main);
  const a = useStore(store, (s) => s.actions);
  return (
    <div className="con-main-strip">
      <div className="con-strip-name">MAIN L/R</div>
      <Meter read={() => engine?.busPeakDb('main') ?? -Infinity} active={playing} height={120} />
      <Fader label="메인 페이더" value={main.faderDb} onChange={(v) => a.setBusFader('main', v)} height={150} color="var(--fn-bus)" />
      <button type="button" className={`sim-btn is-small is-mute${main.mute ? ' is-active' : ''}`} aria-pressed={main.mute} onClick={() => a.setBusMute('main', !main.mute)}>
        MUTE
      </button>
    </div>
  );
}
