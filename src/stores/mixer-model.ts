// 믹서 상태의 모양과 기본값. 엔진·UI·미션이 공유하는 유일한 계약이다.
// 값은 기종과 상관없는 표준 단위(dB, Hz, ms, 비율)로 저장한다.

import type { CompMode, DetectorMode, GateMode } from '../audio/dsp/dynamics';
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
  /** 극성 반전: 파형을 위아래로 뒤집는다 */
  invert: boolean;
  /** 채널 딜레이: 소리를 늦춘다(에코가 아니다). 마이크 거리·스피커 거리 맞추기 */
  delayOn: boolean;
  delayMs: number;
}

/** 키 필터: 검출할 소리만 골라 듣는다. lowcut은 저역을 빼고, band는 그 주변만 남긴다. */
export type KeyFilter = 'off' | 'lowcut' | 'highcut' | 'band';

/** 사이드체인(키): 다이내믹스가 무엇을 듣고 움직일지 */
export interface KeyState {
  /** 'self'는 자기 채널, 숫자는 그 채널(0부터)의 소리로 검출한다 */
  source: 'self' | number;
  filter: KeyFilter;
  freq: number;
  /** 켜면 처리 대신 키 신호를 들려준다(키 필터 맞추기) */
  listen: boolean;
}

export interface GateState {
  on: boolean;
  mode: GateMode;
  /** 익스팬더 비율(1:2면 2) */
  expRatio: number;
  thresholdDb: number;
  rangeDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
  key: KeyState;
}

export interface PeqState {
  on: boolean;
  bands: PeqBandState[];
}

export interface CompState {
  on: boolean;
  mode: CompMode;
  thresholdDb: number;
  ratio: number;
  kneeDb: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
  detector: DetectorMode;
  /** 0~100%. 100보다 작으면 원음과 섞는다(병렬 압축) */
  mixPct: number;
  key: KeyState;
}

/** 센드를 뽑는 자리: EQ 앞(게이트 뒤), 페이더 앞(컴프 뒤), 페이더 뒤 */
export type SendTap = 'pre-eq' | 'pre' | 'post';

export interface SendState {
  levelDb: number;
  tap: SendTap;
}

export type FxType = 'reverb' | 'delay' | 'chorus';

/** 이펙트 하나의 설정. 종류마다 쓰는 값만 쓴다(리버브: 잔향·프리딜레이, 딜레이: 시간·피드백, 코러스: 속도·깊이). */
export interface FxState {
  type: FxType;
  /** 리버브 잔향 길이(RT60, 초) */
  decayS: number;
  /** 리버브가 시작되기 전 틈(ms) */
  preDelayMs: number;
  /** 딜레이 시간(ms) */
  timeMs: number;
  /** 딜레이 반복 양(%) */
  feedbackPct: number;
  /** 코러스 흔들림 속도(Hz) */
  rateHz: number;
  /** 코러스 흔들림 깊이(%) */
  depthPct: number;
  /** 이펙트 소리의 고역·저역 자르기 */
  hiCutHz: number;
  loCutHz: number;
}

/** 채널 인서트: 페이더 앞(컴프 뒤)에 이펙트를 직접 끼운다. mixPct는 이펙트 소리의 비율 */
export interface InsertState {
  on: boolean;
  mixPct: number;
  fx: FxState;
}

export interface ChannelState {
  name: string;
  preamp: PreampState;
  gate: GateState;
  peq: PeqState;
  comp: CompState;
  insert: InsertState;
  faderDb: number;
  mute: boolean;
  pan: number; // -1(왼쪽) ~ 1(오른쪽)
  mainAssign: boolean;
  sends: SendState[]; // Aux 개수만큼
}

/**
 * 버스 종류. monitor: 무대 모니터(모노, 메인으로 안 간다), group: 서브그룹(스테레오, 채널 팬 뒤에서 받아 메인으로),
 * fx: 이펙트 센드(모노로 모아 이펙트에 넣고, 이펙트 출력은 FX 리턴으로 메인에 돌아온다), main: 메인 L/R.
 * 실제 콘솔의 믹스 버스처럼 같은 틀에 종류만 다르다.
 */
export type BusKind = 'monitor' | 'group' | 'fx' | 'main';

export interface BusState {
  name: string;
  kind: BusKind;
  faderDb: number;
  mute: boolean;
  geq: number[]; // 31밴드 게인(dB)
  /** 버스 처리: PEQ → 컴프 → GEQ 순서 */
  peq: PeqState;
  comp: CompState;
  /** 그룹·FX 리턴을 메인으로 보낼지(모니터·메인은 쓰지 않는다) */
  mainAssign: boolean;
  /** kind가 fx일 때: 이펙트 설정과 리턴(돌아오는 소리) */
  fx: FxState;
  returnDb: number;
  returnMute: boolean;
}

/** 매트릭스: 메인과 그룹을 다시 섞어 따로 내보낸다(로비 스피커, 방송 송출). 입력 채널은 직접 보낼 수 없다. */
export interface MatrixState {
  name: string;
  faderDb: number;
  mute: boolean;
  /** 메인에서 받는 양 */
  fromMainDb: number;
  /** 버스(그룹)마다 받는 양. 그룹이 아닌 버스는 무시한다 */
  fromBusDb: number[];
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

/** 'main' 메인, number 버스 번호(0부터), 'reference' 정답 믹스(원곡 믹스), 'matrix-n' 매트릭스 */
export type ListenTarget = 'main' | number | 'reference' | `matrix-${number}`;

export interface MixerState {
  inputs: InputState[];
  /** 채널 → 입력 번호. null이면 연결 없음 */
  patch: (number | null)[];
  channels: ChannelState[];
  main: BusState;
  /** 믹스 버스(모니터·그룹). 채널의 sends[i]가 auxes[i]로 간다 */
  auxes: BusState[];
  matrix: MatrixState[];
  listen: ListenTarget;
  howl: HowlState;
  /** 스테레오 링크: links[k]면 채널 2k와 2k+1이 같이 움직인다(팬 제외) */
  links: boolean[];
}

export const DEFAULT_PEQ_BANDS: PeqBandState[] = [
  { type: 'lowshelf', freq: 120, gainDb: 0, q: 0.7 },
  { type: 'peaking', freq: 500, gainDb: 0, q: 1 },
  { type: 'peaking', freq: 2500, gainDb: 0, q: 1 },
  { type: 'highshelf', freq: 8000, gainDb: 0, q: 0.7 },
];

export function defaultKey(): KeyState {
  return { source: 'self', filter: 'off', freq: 1000, listen: false };
}

export function defaultComp(): CompState {
  return {
    on: false,
    mode: 'comp',
    thresholdDb: -20,
    ratio: 3,
    kneeDb: 2,
    attackMs: 10,
    releaseMs: 150,
    makeupDb: 0,
    detector: 'peak',
    mixPct: 100,
    key: defaultKey(),
  };
}

export function defaultPeq(): PeqState {
  return { on: true, bands: DEFAULT_PEQ_BANDS.map((b) => ({ ...b })) };
}

export function defaultChannel(name: string, auxCount: number): ChannelState {
  return {
    name,
    preamp: { gainDb: 0, hpfOn: false, hpfFreq: 80, lpfOn: false, lpfFreq: 12000, invert: false, delayOn: false, delayMs: 1 },
    gate: {
      on: false,
      mode: 'gate',
      expRatio: 2,
      thresholdDb: -40,
      rangeDb: 40,
      attackMs: 1,
      holdMs: 50,
      releaseMs: 150,
      key: defaultKey(),
    },
    peq: defaultPeq(),
    comp: defaultComp(),
    insert: { on: false, mixPct: 30, fx: defaultFx('reverb') },
    faderDb: 0,
    mute: false,
    pan: 0,
    mainAssign: true,
    sends: Array.from({ length: auxCount }, () => ({ levelDb: -Infinity, tap: 'pre' as const })),
  };
}

export function defaultBus(name: string): BusState {
  return defaultBusOf(name, 'monitor');
}

export function defaultFx(type: FxType = 'reverb'): FxState {
  return {
    type,
    decayS: 1.8,
    preDelayMs: 20,
    timeMs: 375,
    feedbackPct: 30,
    rateHz: 0.8,
    depthPct: 40,
    hiCutHz: 6000,
    loCutHz: 200,
  };
}

export function defaultBusOf(name: string, kind: BusKind, fxType: FxType = 'reverb'): BusState {
  return {
    name,
    kind,
    faderDb: 0,
    mute: false,
    geq: flatGeq(),
    peq: defaultPeq(),
    comp: defaultComp(),
    mainAssign: kind === 'group' || kind === 'fx',
    fx: defaultFx(fxType),
    returnDb: 0,
    returnMute: false,
  };
}

export function defaultMatrix(name: string, busCount: number): MatrixState {
  return { name, faderDb: 0, mute: false, fromMainDb: 0, fromBusDb: Array.from({ length: busCount }, () => -Infinity) };
}

export interface MixerShape {
  channels: number;
  auxes: number;
  inputs: InputState[];
  auxNames?: string[];
  /** 버스 종류(기본 모두 monitor) */
  auxKinds?: BusKind[];
  /** fx 버스의 이펙트 종류(버스 번호 순서) */
  auxFx?: (FxType | undefined)[];
  /** 매트릭스 이름들(기본 없음) */
  matrixNames?: string[];
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
    main: defaultBusOf('Main', 'main'),
    auxes: auxNames.map((n, i) => defaultBusOf(n, shape.auxKinds?.[i] ?? 'monitor', shape.auxFx?.[i])),
    matrix: (shape.matrixNames ?? []).map((n) => defaultMatrix(n, shape.auxes)),
    listen: 'main',
    howl: { active: false, channel: 0, aux: 0, freq: 2500 },
    links: Array.from({ length: Math.floor(shape.channels / 2) }, () => false),
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
