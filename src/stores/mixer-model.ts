// 믹서 상태의 모양과 기본값. 엔진·UI·미션이 공유하는 유일한 계약이다.
// 값은 기종과 상관없는 표준 단위(dB, Hz, ms, 비율)로 저장한다.

import type { DetectorMode } from '../audio/dsp/dynamics';
import { flatGeq } from '../audio/dsp/geq';

export type PeqBandType = 'lowshelf' | 'peaking' | 'highshelf';

export interface PeqBandState {
  type: PeqBandType;
  freq: number;
  gainDb: number;
  q: number;
}

export interface PreampState {
  gainDb: number;
  hpfOn: boolean;
  hpfFreq: number;
  /** LPF(로우패스 필터): 이 주파수 위를 깎는다 */
  lpfOn: boolean;
  lpfFreq: number;
}

export interface GateState {
  on: boolean;
  thresholdDb: number;
  rangeDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}

export interface PeqState {
  on: boolean;
  bands: PeqBandState[];
}

export interface CompState {
  on: boolean;
  thresholdDb: number;
  ratio: number;
  kneeDb: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
  detector: DetectorMode;
}

export interface SendState {
  levelDb: number;
  pre: boolean;
}

export interface ChannelState {
  name: string;
  preamp: PreampState;
  gate: GateState;
  peq: PeqState;
  comp: CompState;
  faderDb: number;
  mute: boolean;
  pan: number; // -1(왼쪽) ~ 1(오른쪽)
  mainAssign: boolean;
  sends: SendState[]; // Aux 개수만큼
}

export interface BusState {
  name: string;
  faderDb: number;
  mute: boolean;
  geq: number[]; // 31밴드 게인(dB)
}

export interface InputState {
  /** 무대 박스 단자 이름 */
  label: string;
  /** 연결된 스템 id. null이면 빈 입력 */
  stemId: string | null;
}

export interface HowlState {
  active: boolean;
  channel: number;
  aux: number;
  freq: number;
}

/** 'main' 메인, number 모니터(Aux) 번호(0부터), 'reference' 정답 믹스(원곡 믹스) */
export type ListenTarget = 'main' | number | 'reference';

export interface MixerState {
  inputs: InputState[];
  /** 채널 → 입력 번호. null이면 연결 없음 */
  patch: (number | null)[];
  channels: ChannelState[];
  main: BusState;
  auxes: BusState[];
  listen: ListenTarget;
  howl: HowlState;
}

export const DEFAULT_PEQ_BANDS: PeqBandState[] = [
  { type: 'lowshelf', freq: 120, gainDb: 0, q: 0.7 },
  { type: 'peaking', freq: 500, gainDb: 0, q: 1 },
  { type: 'peaking', freq: 2500, gainDb: 0, q: 1 },
  { type: 'highshelf', freq: 8000, gainDb: 0, q: 0.7 },
];

export function defaultChannel(name: string, auxCount: number): ChannelState {
  return {
    name,
    preamp: { gainDb: 0, hpfOn: false, hpfFreq: 80, lpfOn: false, lpfFreq: 12000 },
    gate: { on: false, thresholdDb: -40, rangeDb: 40, attackMs: 1, holdMs: 50, releaseMs: 150 },
    peq: { on: true, bands: DEFAULT_PEQ_BANDS.map((b) => ({ ...b })) },
    comp: {
      on: false,
      thresholdDb: -20,
      ratio: 3,
      kneeDb: 2,
      attackMs: 10,
      releaseMs: 150,
      makeupDb: 0,
      detector: 'peak',
    },
    faderDb: 0,
    mute: false,
    pan: 0,
    mainAssign: true,
    sends: Array.from({ length: auxCount }, () => ({ levelDb: -Infinity, pre: true })),
  };
}

export function defaultBus(name: string): BusState {
  return { name, faderDb: 0, mute: false, geq: flatGeq() };
}

export interface MixerShape {
  channels: number;
  auxes: number;
  inputs: InputState[];
  auxNames?: string[];
}

/** 채널 n개, Aux m개짜리 기본 상태. 입력 i는 채널 i에 꽂힌다. */
export function defaultMixerState(shape: MixerShape): MixerState {
  const auxNames = shape.auxNames ?? Array.from({ length: shape.auxes }, (_, i) => `Aux ${i + 1}`);
  return {
    inputs: shape.inputs.map((x) => ({ ...x })),
    patch: Array.from({ length: shape.channels }, (_, i) => (i < shape.inputs.length ? i : null)),
    channels: Array.from({ length: shape.channels }, (_, i) =>
      defaultChannel(shape.inputs[i]?.label ?? `CH ${i + 1}`, shape.auxes),
    ),
    main: defaultBus('Main'),
    auxes: auxNames.map((n) => defaultBus(n)),
    listen: 'main',
    howl: { active: false, channel: 0, aux: 0, freq: 2500 },
  };
}

/** 깊은 부분 덮어쓰기용 타입(미션 초기 상태). 배열은 인덱스 키 객체로 일부만 바꿀 수 있다. */
export type DeepPartial<T> = T extends (infer U)[]
  ? { [index: number]: DeepPartial<U> } | U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (patch === undefined) return base;
  if (Array.isArray(patch)) return patch as T;
  if (Array.isArray(base)) {
    const out = base.slice() as unknown[];
    for (const [k, v] of Object.entries(patch as object)) {
      const i = Number(k);
      out[i] = deepMerge(out[i], v as never);
    }
    return out as T;
  }
  if (base !== null && typeof base === 'object' && typeof patch === 'object' && patch !== null) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(patch as object)) out[k] = deepMerge(out[k], v as never);
    return out as T;
  }
  return patch as T;
}
