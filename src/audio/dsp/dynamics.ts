// 컴프레서·게이트·리미터의 샘플 단위 처리. Web Audio에 의존하지 않아
// 워클릿과 테스트가 같은 코드를 쓴다.
//
// 구조: 검출기(Peak 또는 RMS) → 정적 게인 계산(dB) → 어택·릴리스로 게인을 부드럽게 → 곱하기.
// 어택은 게인이 줄어드는(누르는·닫히는) 쪽, 릴리스는 돌아오는 쪽 시간이다.
// 키(사이드체인) 배열을 주면 검출만 키로 하고 게인은 본 신호에 건다.

import { dbToGain, gainToDb } from './units';

export type DetectorMode = 'peak' | 'rms';
/** comp: 큰 소리를 누른다. exp: 스레숄드 아래 작은 소리를 더 작게(아래로 늘리기). */
export type CompMode = 'comp' | 'exp';
/** gate: 닫히면 레인지만큼. exp: 비율로 서서히(레인지가 한계). duck: 키가 크면 줄인다. */
export type GateMode = 'gate' | 'exp' | 'duck';

/** 시간 상수(ms) → 한 샘플당 one-pole 계수. 0 ms면 즉시 따라간다. */
export function timeCoef(ms: number, sampleRate: number): number {
  if (ms <= 0) return 0;
  return Math.exp(-1 / ((ms / 1000) * sampleRate));
}

const RMS_WINDOW_MS = 10;
const FLOOR_DB = -120;
/** EXP 모드가 줄이는 한계 */
const EXP_FLOOR_DB = -80;
/** 게이트 익스팬더용 피크 엔벌로프가 내려오는 시간 */
const ENV_RELEASE_MS = 10;

export interface CompParams {
  thresholdDb: number;
  ratio: number; // 1 이상. Infinity면 리미터
  kneeDb: number; // 0이면 하드 니
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
  detector: DetectorMode;
  mode?: CompMode; // 기본 comp
  mixPct?: number; // 0~100, 기본 100. 줄이면 원음과 섞는다(병렬 압축)
}

/**
 * 입력 레벨(dB)에 대한 게인 변화(dB, 0 이하). 소프트 니는 니 폭 안에서 2차 곡선으로 잇는다.
 * (Giannoulis, Massberg, Reiss 2012, "Digital Dynamic Range Compressor Design")
 */
export function compGainDb(levelDb: number, p: Pick<CompParams, 'thresholdDb' | 'ratio' | 'kneeDb'>): number {
  const slope = p.ratio === Infinity ? 1 : 1 - 1 / p.ratio;
  const over = levelDb - p.thresholdDb;
  const knee = Math.max(0, p.kneeDb);
  if (knee > 0 && Math.abs(over) <= knee / 2) {
    return (-slope * (over + knee / 2) ** 2) / (2 * knee);
  }
  return over > 0 ? -slope * over : 0;
}

/** EXP 모드의 게인 변화(dB, 0 이하): 스레숄드 아래로 (ratio−1)배 더 내린다. 니는 같은 2차 곡선. */
export function expGainDb(levelDb: number, p: Pick<CompParams, 'thresholdDb' | 'ratio' | 'kneeDb'>): number {
  const slope = p.ratio === Infinity ? 1000 : p.ratio - 1;
  const under = levelDb - p.thresholdDb;
  const knee = Math.max(0, p.kneeDb);
  let g: number;
  if (knee > 0 && Math.abs(under) <= knee / 2) g = (-slope * (under - knee / 2) ** 2) / (2 * knee);
  else g = under < 0 ? slope * under : 0;
  return Math.max(EXP_FLOOR_DB, g);
}

/** 모드에 맞는 정적 게인 변화(dB) */
export function dynGainDb(levelDb: number, p: Pick<CompParams, 'thresholdDb' | 'ratio' | 'kneeDb' | 'mode'>): number {
  return p.mode === 'exp' ? expGainDb(levelDb, p) : compGainDb(levelDb, p);
}

/** 전달 곡선: 입력 레벨 → 출력 레벨(dB), 메이크업 포함. */
export function compTransferDb(levelDb: number, p: CompParams): number {
  return levelDb + dynGainDb(levelDb, p) + p.makeupDb;
}

/** i번째 샘플에서 여러 채널 중 절댓값이 가장 큰 값 */
function maxAt(channels: Float32Array[], i: number): number {
  let x = 0;
  for (const ch of channels) if (Math.abs(ch[i] ?? 0) > Math.abs(x)) x = ch[i];
  return x;
}

class Detector {
  private ms = 0;
  private readonly a: number;
  constructor(sampleRate: number) {
    this.a = timeCoef(RMS_WINDOW_MS, sampleRate);
  }
  levelDb(x: number, mode: DetectorMode): number {
    if (mode === 'peak') return gainToDbFloor(Math.abs(x));
    const a = this.a;
    this.ms = a * this.ms + (1 - a) * x * x;
    return gainToDbFloor(Math.sqrt(this.ms));
  }
}

function gainToDbFloor(g: number): number {
  return Math.max(FLOOR_DB, gainToDb(g));
}

/** 상태를 가진 컴프레서. 여러 채널은 가장 큰 값으로 검출해 같은 게인을 건다(링크). */
export class Compressor {
  private det: Detector;
  /** 현재 게인 리덕션(dB, 0 이하) */
  grDb = 0;
  constructor(private sampleRate: number) {
    this.det = new Detector(sampleRate);
  }

  process(channels: Float32Array[], p: CompParams, bypass = false, key?: Float32Array[]): void {
    // 꺼져 있으면 아무것도 하지 않는다(콘솔 16채널의 처리량을 줄인다).
    if (bypass) {
      this.grDb = 0;
      return;
    }
    const n = channels[0]?.length ?? 0;
    const att = timeCoef(p.attackMs, this.sampleRate);
    const rel = timeCoef(p.releaseMs, this.sampleRate);
    const makeup = dbToGain(p.makeupDb);
    const wet = Math.min(1, Math.max(0, (p.mixPct ?? 100) / 100));
    const src = key && key.length > 0 ? key : channels;
    const mix = (gr: number) => 1 - wet + wet * dbToGain(gr) * makeup;
    let g = mix(this.grDb);
    for (let i = 0; i < n; i++) {
      const target = dynGainDb(this.det.levelDb(maxAt(src, i), p.detector), p);
      const c = target < this.grDb ? att : rel;
      this.grDb = c * this.grDb + (1 - c) * target;
      // dB → 배율 변환은 8샘플마다(약 0.17 ms) 한 번. 귀로 구분되지 않고 계산은 크게 준다.
      if ((i & 7) === 0) g = mix(this.grDb);
      for (const ch of channels) ch[i] *= g;
    }
  }
}

export interface GateParams {
  thresholdDb: number;
  rangeDb: number; // 닫혔을 때 줄이는 양(양수)
  attackMs: number; // 열리는 시간
  holdMs: number; // 신호가 내려가도 열어 두는 시간
  releaseMs: number; // 닫히는 시간
  mode?: GateMode; // 기본 gate
  expRatio?: number; // exp 모드 비율(1:2면 2)
}

export class Gate {
  private holdLeft = 0;
  private env = 0;
  /** 현재 감쇠량(dB, 0 이하) */
  grDb = 0;
  /** 지금 열려 있는가(홀드 포함) */
  open = false;
  constructor(private sampleRate: number) {}

  process(channels: Float32Array[], p: GateParams, bypass = false, key?: Float32Array[]): void {
    if (bypass) {
      this.grDb = 0;
      this.open = true;
      return;
    }
    const n = channels[0]?.length ?? 0;
    let g = dbToGain(this.grDb);
    const att = timeCoef(p.attackMs, this.sampleRate);
    const rel = timeCoef(p.releaseMs, this.sampleRate);
    const envRel = timeCoef(ENV_RELEASE_MS, this.sampleRate);
    const holdSamples = Math.round((p.holdMs / 1000) * this.sampleRate);
    const mode = p.mode ?? 'gate';
    const range = -Math.abs(p.rangeDb);
    const expSlope = Math.max(1, p.expRatio ?? 2) - 1;
    const src = key && key.length > 0 ? key : channels;
    for (let i = 0; i < n; i++) {
      const peak = Math.abs(maxAt(src, i));
      this.env = Math.max(peak, envRel * this.env);
      if (gainToDbFloor(peak) >= p.thresholdDb) {
        this.open = true;
        this.holdLeft = holdSamples;
      } else if (this.holdLeft > 0) {
        this.holdLeft--;
        this.open = true;
      } else {
        this.open = false;
      }
      let target: number;
      if (mode === 'duck') target = this.open ? range : 0;
      else if (this.open) target = 0;
      else if (mode === 'exp') target = Math.max(range, expSlope * (gainToDbFloor(this.env) - p.thresholdDb));
      else target = range;
      // 게이트는 열리는(올라가는) 쪽이 어택, 덕킹은 줄이는(내려가는) 쪽이 어택이다.
      const opening = mode === 'duck' ? target < this.grDb : target > this.grDb;
      const c = opening ? att : rel;
      this.grDb = c * this.grDb + (1 - c) * target;
      if ((i & 7) === 0) g = dbToGain(this.grDb);
      for (const ch of channels) ch[i] *= g;
    }
  }
}

/**
 * 안전 리미터: 무한대 레이시오 컴프 + 마지막 하드 클립.
 * 어택이 있어 순간 피크가 지나갈 수 있으므로 상한(ceilingDb)에서 한 번 더 자른다.
 */
export class SafetyLimiter {
  private comp: Compressor;
  constructor(sampleRate: number, readonly ceilingDb = -1) {
    this.comp = new Compressor(sampleRate);
  }
  get grDb(): number {
    return this.comp.grDb;
  }
  process(channels: Float32Array[]): void {
    this.comp.process(channels, {
      thresholdDb: this.ceilingDb - 3,
      ratio: Infinity,
      kneeDb: 0,
      attackMs: 1,
      releaseMs: 80,
      makeupDb: 0,
      detector: 'peak',
    });
    const c = dbToGain(this.ceilingDb);
    for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] = Math.max(-c, Math.min(c, ch[i]));
  }
}
