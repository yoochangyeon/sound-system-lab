// '하나씩 들어 보기'(기획서 S02, #40): 요소 하나만 움직이는 작은 위젯.
// 슬라이더 1개, 그 요소를 보여 주는 그래프, 재생, 처리 켜기/끄기만 있다. 전체 처리기 위젯 앞에서 개념을 익힌다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { compTransferDb } from '../../audio/dsp/dynamics';
import type { MixerEngine } from '../../audio/engine';
import { channelEqResponseDb, inputPeakDb } from '../../stores/derived';
import type { MixerActions } from '../../stores/mixer';
import type { ChannelState, DeepPartial, MixerState } from '../../stores/mixer-model';
import type { ParamKey, Range } from '../../stores/profile';
import type { StemRole } from '../../audio/library';
import { Slider } from '../ui/controls';
import { ResponseGraph, TransferGraph } from '../ui/CurveGraph';
import { Meter } from '../ui/Meter';
import { fmtDb } from '../ui/scale';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

type Graph = 'eq' | 'comp' | 'gate' | 'input';

interface Preset {
  title: string;
  accent: string;
  /** 어울리는 소스 역할(첫 역할이 기본) */
  roles: StemRole[];
  initial: DeepPartial<MixerState>;
  graph: Graph;
  param: ParamKey;
  label: string;
  hint: string;
  get: (c: ChannelState) => number;
  set: (a: MixerActions, v: number) => void;
  format?: (v: number) => string;
  isOn?: (c: ChannelState) => boolean;
  setOn?: (a: MixerActions, on: boolean) => void;
  /** 무엇을 들어 볼지 한 줄 */
  tip: string;
}

const EQ = 'var(--fn-eq)';
const DYN = 'var(--fn-dyn)';
const peqOn = { isOn: (c: ChannelState) => c.peq.on, setOn: (a: MixerActions, on: boolean) => a.setPeqOn(0, on) };
const compOn = { isOn: (c: ChannelState) => c.comp.on, setOn: (a: MixerActions, on: boolean) => a.setComp(0, { on }) };
const gateOn = { isOn: (c: ChannelState) => c.gate.on, setOn: (a: MixerActions, on: boolean) => a.setGate(0, { on }) };

export const PRESETS = {
  gain: {
    title: '게인 하나만',
    accent: 'var(--fn-preamp)',
    roles: ['snare', 'kick', 'lead-vocal'],
    initial: { channels: { 0: { preamp: { gainDb: -20 } } } },
    graph: 'input',
    param: 'gain',
    label: '게인',
    hint: '마이크 신호를 얼마나 키울지',
    get: (c) => c.preamp.gainDb,
    set: (a, v) => a.setPreamp(0, { gainDb: v }),
    tip: '오른쪽 끝까지 밀어 소리가 "지직" 깨지는 순간을 들어 본다.',
  },
  hpf: {
    title: 'HPF 하나만',
    accent: EQ,
    roles: ['bass', 'kick', 'lead-vocal'],
    initial: { channels: { 0: { preamp: { hpfOn: true, hpfFreq: 20 } } } },
    graph: 'eq',
    param: 'hpfFreq',
    label: 'HPF 차단 주파수',
    hint: '이 주파수 아래를 깎는다',
    get: (c) => c.preamp.hpfFreq,
    set: (a, v) => a.setPreamp(0, { hpfFreq: v }),
    isOn: (c) => c.preamp.hpfOn,
    setOn: (a, on) => a.setPreamp(0, { hpfOn: on }),
    tip: '오른쪽으로 밀수록 베이스의 "웅" 하는 아래쪽이 사라지고 가벼워진다.',
  },
  lpf: {
    title: 'LPF 하나만',
    accent: EQ,
    roles: ['overheads', 'guitar', 'lead-vocal'],
    initial: { channels: { 0: { preamp: { lpfOn: true, lpfFreq: 20000 } } } },
    graph: 'eq',
    param: 'lpfFreq',
    label: 'LPF 차단 주파수',
    hint: '이 주파수 위를 깎는다',
    get: (c) => c.preamp.lpfFreq,
    set: (a, v) => a.setPreamp(0, { lpfFreq: v }),
    isOn: (c) => c.preamp.lpfOn,
    setOn: (a, on) => a.setPreamp(0, { lpfOn: on }),
    tip: '왼쪽으로 밀수록 오버헤드의 심벌 "치익"이 사라지고 담요를 덮은 듯 먹먹해진다.',
  },
  freq: {
    title: '주파수 옮겨 보기',
    accent: EQ,
    roles: ['lead-vocal', 'guitar', 'backing-vocal'],
    initial: { channels: { 0: { peq: { bands: { 1: { freq: 250, gainDb: 12, q: 2 } } } } } },
    graph: 'eq',
    param: 'eqFreq',
    label: '주파수',
    hint: '종 모양의 가운데를 어디에 둘지',
    get: (c) => c.peq.bands[1].freq,
    set: (a, v) => a.setPeqBand(0, 1, { freq: v }),
    ...peqOn,
    tip: '+12 dB로 크게 올려 둔 종을 왼쪽에서 오른쪽으로 옮기며 "웅웅 → 콧소리 → 쨍"으로 바뀌는 것을 듣는다.',
  },
  boost: {
    title: '올리기·내리기',
    accent: EQ,
    roles: ['lead-vocal', 'guitar', 'backing-vocal'],
    initial: { channels: { 0: { peq: { bands: { 2: { freq: 3000, gainDb: 0, q: 1 } } } } } },
    graph: 'eq',
    param: 'eqGain',
    label: '3 kHz 올리기·내리기',
    hint: '0보다 크면 올리고, 작으면 깎는다',
    get: (c) => c.peq.bands[2].gainDb,
    set: (a, v) => a.setPeqBand(0, 2, { gainDb: v }),
    ...peqOn,
    tip: '올리면 말이 앞으로 나오다 귀를 찌르고, 내리면 멀고 흐려진다.',
  },
  q: {
    title: 'Q(폭) 하나만',
    accent: EQ,
    roles: ['lead-vocal', 'overheads', 'guitar'],
    initial: { channels: { 0: { peq: { bands: { 1: { freq: 1000, gainDb: 12, q: 1 } } } } } },
    graph: 'eq',
    param: 'eqQ',
    label: 'Q (폭)',
    hint: '클수록 좁게, 작을수록 넓게',
    get: (c) => c.peq.bands[1].q,
    set: (a, v) => a.setPeqBand(0, 1, { q: v }),
    format: (v) => v.toFixed(1),
    ...peqOn,
    tip: 'Q를 키우면 종이 뾰족해져 "삐" 하는 한 음만, 줄이면 넓게 퍼져 전체 색이 바뀐다.',
  },
  shelf: {
    title: '셸프 하나만',
    accent: EQ,
    roles: ['bass', 'kick', 'lead-vocal'],
    initial: { channels: { 0: { peq: { bands: { 0: { type: 'lowshelf', freq: 200, gainDb: 0 } } } } } },
    graph: 'eq',
    param: 'eqGain',
    label: '200 Hz 아래 전체',
    hint: '셸프: 기준 주파수 아래 전체를 계단처럼',
    get: (c) => c.peq.bands[0].gainDb,
    set: (a, v) => a.setPeqBand(0, 0, { gainDb: v }),
    ...peqOn,
    tip: '종 모양과 달리 한 점이 아니라 아래쪽 전체가 함께 오르내린다.',
  },
  threshold: {
    title: '스레숄드 하나만',
    accent: DYN,
    roles: ['lead-vocal', 'bass', 'snare'],
    initial: { channels: { 0: { comp: { on: true, thresholdDb: 0, ratio: 8, attackMs: 5, releaseMs: 120 } } } },
    graph: 'comp',
    param: 'compThreshold',
    label: '스레숄드',
    hint: '이 크기를 넘는 소리부터 누른다',
    get: (c) => c.comp.thresholdDb,
    set: (a, v) => a.setComp(0, { thresholdDb: v }),
    ...compOn,
    tip: '내릴수록 GR 미터가 더 자주, 더 깊게 움직이고 소리가 납작해진다.',
  },
  ratio: {
    title: '레이시오 하나만',
    accent: DYN,
    roles: ['lead-vocal', 'bass', 'snare'],
    initial: { channels: { 0: { comp: { on: true, thresholdDb: -30, ratio: 1, attackMs: 5, releaseMs: 120 } } } },
    graph: 'comp',
    param: 'ratio',
    label: '레이시오',
    hint: '넘친 만큼을 몇 분의 1로 줄일지',
    get: (c) => c.comp.ratio,
    set: (a, v) => a.setComp(0, { ratio: v }),
    ...compOn,
    tip: '1:1이면 아무 일도 없다. 올릴수록 곡선이 꺾이고 큰 소리가 더 세게 눌린다.',
  },
  attack: {
    title: '어택 하나만',
    accent: DYN,
    roles: ['snare', 'kick', 'guitar'],
    initial: { channels: { 0: { comp: { on: true, thresholdDb: -32, ratio: 10, attackMs: 0.5, releaseMs: 120 } } } },
    graph: 'comp',
    param: 'compAttack',
    label: '어택',
    hint: '넘은 뒤 누르기 시작하기까지',
    get: (c) => c.comp.attackMs,
    set: (a, v) => a.setComp(0, { attackMs: v }),
    ...compOn,
    tip: '짧으면 드럼의 "탁"이 뭉개지고, 길게 하면 첫머리가 살아 나온다.',
  },
  gateThreshold: {
    title: '게이트 스레숄드 하나만',
    accent: DYN,
    roles: ['toms', 'snare'],
    initial: { channels: { 0: { gate: { on: true, thresholdDb: -80, rangeDb: 40, attackMs: 1, holdMs: 60, releaseMs: 120 } } } },
    graph: 'gate',
    param: 'gateThreshold',
    label: '스레숄드',
    hint: '이보다 작은 소리면 문을 닫는다',
    get: (c) => c.gate.thresholdDb,
    set: (a, v) => a.setGate(0, { thresholdDb: v }),
    ...gateOn,
    tip: '탐을 치지 않는 사이에 새어 든 스네어·심벌 소리가 올릴수록 줄어들다가, 너무 올리면 탐 소리까지 잘린다.',
  },
  gateRange: {
    title: '게이트 레인지 하나만',
    accent: DYN,
    roles: ['toms', 'snare'],
    initial: { channels: { 0: { gate: { on: true, thresholdDb: -18, rangeDb: 3, attackMs: 1, holdMs: 60, releaseMs: 120 } } } },
    graph: 'gate',
    param: 'gateRange',
    label: '레인지',
    hint: '문이 닫혔을 때 얼마나 줄일지',
    get: (c) => c.gate.rangeDb,
    set: (a, v) => a.setGate(0, { rangeDb: v }),
    ...gateOn,
    tip: '작으면 울림이 살짝 남아 자연스럽고, 크면 사이가 뚝뚝 끊긴다.',
  },
} satisfies Record<string, Preset>;

export type TryKind = keyof typeof PRESETS;

function Visual({ graph, c, engine, playing, accent }: { graph: Graph; c: ChannelState; engine: MixerEngine | null; playing: boolean; accent: string }) {
  const response = useMemo(() => (f: number) => channelEqResponseDb(c, f), [c]);
  const transfer = useMemo(() => (d: number) => compTransferDb(d, c.comp), [c.comp]);
  if (graph === 'eq')
    return (
      <div className="sim-visual">
        <div className="grow">
          <ResponseGraph response={response} height={120} color={accent} />
        </div>
        <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={playing} height={108} label="출력" />
      </div>
    );
  if (graph === 'comp')
    return (
      <div className="sim-visual" style={{ justifyContent: 'center' }}>
        <TransferGraph transfer={transfer} thresholdDb={c.comp.thresholdDb} />
        <div className="sim-meters">
          <Meter read={() => engine?.compGrDb(0) ?? 0} active={playing && c.comp.on} height={130} min={-24} reduction label="GR" />
          <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={playing} height={130} label="출력" />
        </div>
      </div>
    );
  if (graph === 'gate')
    return (
      <div className="sim-visual" style={{ justifyContent: 'center' }}>
        <div className="sim-meters">
          <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={playing} height={110} label="입력" />
          <Meter read={() => engine?.gateGrDb(0) ?? 0} active={playing && c.gate.on} height={110} min={-60} reduction label="GR" />
          <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={playing} height={110} label="출력" />
        </div>
      </div>
    );
  return null;
}

function InputVisual({ engine, playing, est }: { engine: MixerEngine | null; playing: boolean; est: number }) {
  const v = est >= 0 ? { cls: 'is-warn', t: '클리핑' } : est < -18 ? { cls: '', t: '너무 작다' } : { cls: 'is-on', t: '알맞다' };
  return (
    <div className="sim-visual" style={{ alignItems: 'center' }}>
      <Meter read={() => engine?.inputPeakDb(0) ?? -Infinity} active={playing} height={110} width={16} label="입력" />
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <span className={`sim-lamp ${v.cls}`}>{v.t}</span>
        <span className="sim-stat">
          가장 큰 순간 <strong>{Number.isFinite(est) ? fmtDb(est).replace(' dB', ' dBFS') : '—'}</strong>
        </span>
      </div>
    </div>
  );
}

export default function TryOne({ kind }: { kind: TryKind }) {
  const p: Preset = PRESETS[kind];
  const store = useMemo(() => createWidgetStore({ roles: p.roles, initial: p.initial }), [kind]);
  const c = useStore(store, (s) => s.channels[0]);
  const range: Range = useStore(store, (s) => s.profile.ranges[p.param]);
  const a = useStore(store, (s) => s.actions);
  const est = useStore(store, (s) => inputPeakDb(s, 0));
  const on = p.isOn ? p.isOn(c) : true;

  return (
    <WidgetShell
      title={p.title}
      accent={p.accent}
      store={store}
      bypassed={p.isOn ? !on : undefined}
      onBypass={p.setOn ? () => p.setOn!(a, !on) : undefined}
      footer={p.tip}
    >
      {({ engine, status }) =>
        p.graph === 'input' ? (
          <>
            <InputVisual engine={engine} playing={status === 'playing'} est={est} />
            <Slider label={p.label} hint={p.hint} value={p.get(c)} range={range} onChange={(v) => p.set(a, v)} color={p.accent} format={p.format} />
          </>
        ) : (
          <>
            <Visual graph={p.graph} c={c} engine={engine} playing={status === 'playing'} accent={p.accent} />
            <Slider label={p.label} hint={p.hint} value={p.get(c)} range={range} onChange={(v) => p.set(a, v)} color={p.accent} format={p.format} />
          </>
        )
      }
    </WidgetShell>
  );
}
