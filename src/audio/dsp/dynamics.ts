// 컴프레서·게이트·리미터의 샘플 단위 처리. Web Audio에 의존하지 않아
// 워클릿과 테스트가 같은 코드를 쓴다.
//
// 구조: 검출기(Peak 또는 RMS) → 정적 게인 계산(dB) → 어택·릴리스로 게인을 부드럽게 → 곱하기.
// 어택은 게인이 줄어드는(누르는·닫히는) 쪽, 릴리스는 돌아오는 쪽 시간이다.

import { dbToGain, gainToDb } from './units';

export type DetectorMode = 'peak' | 'rms';

/** 시간 상수(ms) → 한 샘플당 one-pole 계수. 0 ms면 즉시 따라간다. */
export function timeCoef(ms: number, sampleRate: number): number {
  if (ms <= 0) return 0;
  return Math.exp(-1 / ((ms / 1000) * sampleRate));
}

const RMS_WINDOW_MS = 10;
const FLOOR_DB = -120;

export interface CompParams {
  thresholdDb: number;
  ratio: number; // 1 이상. Infinity면 리미터
  kneeDb: number; // 0이면 하드 니
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
  detector: DetectorMode;
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

/** 전달 곡선: 입력 레벨 → 출력 레벨(dB), 메이크업 포함. */
export function compTransferDb(levelDb: number, p: CompParams): number {
  return levelDb + compGainDb(levelDb, p) + p.makeupDb;
}

class Detector {
  private ms = 0;
  constructor(private sampleRate: number) {}
  levelDb(x: number, mode: DetectorMode): number {
    if (mode === 'peak') return gainToDbFloor(Math.abs(x));
    const a = timeCoef(RMS_WINDOW_MS, this.sampleRate);
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

  process(channels: Float32Array[], p: CompParams, bypass = false): void {
    const n = channels[0]?.length ?? 0;
    const att = timeCoef(p.attackMs, this.sampleRate);
    const rel = timeCoef(p.releaseMs, this.sampleRate);
    const makeup = dbToGain(p.makeupDb);
    for (let i = 0; i < n; i++) {
      let x = 0;
      for (const ch of channels) if (Math.abs(ch[i]) > Math.abs(x)) x = ch[i];
      const target = compGainDb(this.det.levelDb(x, p.detector), p);
      const c = target < this.grDb ? att : rel;
      this.grDb = c * this.grDb + (1 - c) * target;
      if (bypass) continue;
      const g = dbToGain(this.grDb) * makeup;
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
}

export class Gate {
  private holdLeft = 0;
  /** 현재 감쇠량(dB, 0 이하) */
  grDb = 0;
  /** 지금 열려 있는가(홀드 포함) */
  open = false;
  constructor(private sampleRate: number) {}

  process(channels: Float32Array[], p: GateParams, bypass = false): void {
    const n = channels[0]?.length ?? 0;
    const att = timeCoef(p.attackMs, this.sampleRate);
    const rel = timeCoef(p.releaseMs, this.sampleRate);
    const holdSamples = Math.round((p.holdMs / 1000) * this.sampleRate);
    for (let i = 0; i < n; i++) {
      let peak = 0;
      for (const ch of channels) peak = Math.max(peak, Math.abs(ch[i]));
      if (gainToDbFloor(peak) >= p.thresholdDb) {
        this.open = true;
        this.holdLeft = holdSamples;
      } else if (this.holdLeft > 0) {
        this.holdLeft--;
        this.open = true;
      } else {
        this.open = false;
      }
      const target = this.open ? 0 : -Math.abs(p.rangeDb);
      const c = target > this.grDb ? att : rel;
      this.grDb = c * this.grDb + (1 - c) * target;
      if (bypass) continue;
      const g = dbToGain(this.grDb);
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
