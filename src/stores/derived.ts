// 믹서 상태에서 바로 계산하는 숫자들. 그래프와 미션 판정이 같은 함수를 쓴다.
// Web Audio 없이 계산하므로 Node(Vitest)에서 그대로 검사한다.

import { BUTTERWORTH_Q_DB, biquadResponseDb, type BiquadParams } from '../audio/dsp/biquad';
import { compGainDb } from '../audio/dsp/dynamics';
import { geqResponseDb } from '../audio/dsp/geq';
import { stemById, type Stem } from '../audio/stems';
import type { ChannelState, MixerState } from './mixer-model';

const NEG_INF = -Infinity;

export function hpfFilter(ch: ChannelState): BiquadParams | null {
  return ch.preamp.hpfOn ? { type: 'highpass', freq: ch.preamp.hpfFreq, gainDb: 0, q: BUTTERWORTH_Q_DB } : null;
}

export function peqFilters(ch: ChannelState): BiquadParams[] {
  if (!ch.peq.on) return [];
  return ch.peq.bands.map((b) => ({ type: b.type, freq: b.freq, gainDb: b.gainDb, q: b.q }));
}

/** 채널 EQ(HPF + PEQ) 합성 응답(dB). */
export function channelEqResponseDb(ch: ChannelState, f: number): number {
  let total = 0;
  const hpf = hpfFilter(ch);
  if (hpf) total += biquadResponseDb(hpf, f);
  for (const p of peqFilters(ch)) total += biquadResponseDb(p, f);
  return total;
}

/** PEQ만의 응답(HPF 제외). */
export function peqResponseDb(ch: ChannelState, f: number): number {
  let total = 0;
  for (const p of peqFilters(ch)) total += biquadResponseDb(p, f);
  return total;
}

/** 채널에 꽂힌 스템(없으면 null). */
export function channelStem(s: MixerState, ch: number): Stem | null {
  const input = s.patch[ch];
  if (input === null || input === undefined) return null;
  const id = s.inputs[input]?.stemId;
  return id ? (stemById(id) ?? null) : null;
}

/** 채널 입력 피크 추정(dBFS) = 스템 피크 + 프리엠프 게인. 프리엠프 입력 미터와 같은 지점이다. */
export function inputPeakDb(s: MixerState, ch: number): number {
  const stem = channelStem(s, ch);
  if (!stem) return NEG_INF;
  return stem.peakDb + s.channels[ch].preamp.gainDb;
}

export function inputRmsDb(s: MixerState, ch: number): number {
  const stem = channelStem(s, ch);
  if (!stem) return NEG_INF;
  return stem.rmsDb + s.channels[ch].preamp.gainDb;
}

/** 클리핑 판정 기준(0 dBFS). */
export const CLIP_DB = 0;

/** 컴프 GR 추정(dB, 0 이하): 입력 RMS 추정에 정적 게인 계산을 적용한다. 미터가 아니라 판정용이다. */
export function compGrEstimateDb(s: MixerState, ch: number): number {
  const c = s.channels[ch].comp;
  if (!c.on) return 0;
  const lvl = inputRmsDb(s, ch);
  if (!Number.isFinite(lvl)) return 0;
  return compGainDb(lvl, c);
}

/** 채널 신호가 메인까지 가는가(패치·스템·뮤트·페이더·메인 할당·메인 뮤트·메인 페이더). */
export function channelReachesMain(s: MixerState, ch: number): boolean {
  const c = s.channels[ch];
  if (!c) return false;
  if (!channelStem(s, ch)) return false;
  if (c.mute || c.faderDb === NEG_INF || !c.mainAssign) return false;
  if (s.main.mute || s.main.faderDb === NEG_INF) return false;
  return true;
}

/** 무엇 때문에 메인까지 안 가는지(힌트·디버그용). */
export function mainPathProblems(s: MixerState, ch: number): string[] {
  const c = s.channels[ch];
  const out: string[] = [];
  const input = s.patch[ch];
  if (input === null || input === undefined) out.push('patch-none');
  else if (!s.inputs[input]?.stemId) out.push('patch-empty');
  if (c.mute) out.push('mute');
  if (c.faderDb === NEG_INF) out.push('fader-down');
  if (!c.mainAssign) out.push('main-assign-off');
  if (s.main.mute) out.push('main-mute');
  if (s.main.faderDb === NEG_INF) out.push('main-fader-down');
  return out;
}

/**
 * 센드 경로 게인(c→a, dB) = 프리엠프 게인 + (post면 채널 페이더) + 센드 레벨 + Aux 페이더.
 * 채널·Aux 뮤트, 끝까지 내린 페이더·센드, 패치 없음이면 -∞.
 */
export function sendPathGainDb(s: MixerState, ch: number, aux: number): number {
  const c = s.channels[ch];
  const bus = s.auxes[aux];
  const send = c?.sends[aux];
  if (!c || !bus || !send) return NEG_INF;
  if (!channelStem(s, ch)) return NEG_INF;
  if (c.mute || bus.mute) return NEG_INF;
  if (send.levelDb === NEG_INF || bus.faderDb === NEG_INF) return NEG_INF;
  let g = c.preamp.gainDb + send.levelDb + bus.faderDb;
  if (!send.pre) {
    if (c.faderDb === NEG_INF) return NEG_INF;
    g += c.faderDb;
  }
  return g;
}

/** 하울링 결합 계수: 무대 모니터에서 마이크로 돌아오는 양(dB). 방 공진(+9 dB)이 더해지면, 게인·센드·Aux를 모두 0 dB로 둔 보컬 모니터가 하울링 직전(+9 dB)이 되도록 정했다. 그래서 하울링 대역을 9 dB 넘게 깎아야 멈춘다. */
export const FEEDBACK_COUPLING_DB = 0;

/**
 * 방·모니터 공진: 하울링 주파수(howl.freq) 근처만 좁게 튀어나온 응답.
 * 실제로 하울링이 특정 주파수 하나에서 먼저 시작되는 이유(스피커·방·마이크 응답의 봉우리)를 흉내 낸다.
 */
export const ROOM_RESONANCE_DB = 9;
export const ROOM_RESONANCE_Q = 8;

export function roomResponseDb(howlFreq: number, f: number): number {
  return biquadResponseDb({ type: 'peaking', freq: howlFreq, gainDb: ROOM_RESONANCE_DB, q: ROOM_RESONANCE_Q }, f);
}

/** 주파수 f에서의 루프 게인(dB) = 센드 경로 게인 + 채널 EQ(f) + Aux GEQ(f) + 결합 계수 + 방 공진(f). */
export function loopGainDb(s: MixerState, ch: number, aux: number, f: number): number {
  const path = sendPathGainDb(s, ch, aux);
  if (path === NEG_INF) return NEG_INF;
  return (
    path +
    channelEqResponseDb(s.channels[ch], f) +
    geqResponseDb(s.auxes[aux].geq, f) +
    FEEDBACK_COUPLING_DB +
    roomResponseDb(s.howl.freq, f)
  );
}

/** 지금 하울링 설정(howl)에서의 루프 게인. 하울링이 꺼져 있으면 -∞. */
export function howlLoopGainDb(s: MixerState): number {
  if (!s.howl.active) return NEG_INF;
  return loopGainDb(s, s.howl.channel, s.howl.aux, s.howl.freq);
}

/** 보컬 대역(200 Hz~5 kHz, 1/3옥타브 간격) 주파수. */
export const VOICE_BAND_FREQS = [200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000];

/**
 * 모니터 레벨 추정(dB): 채널 c가 Aux a에서 들리는 크기.
 * = 센드 경로 게인 + 보컬 대역에서 (채널 EQ + Aux GEQ) 응답을 선형 전력으로 평균한 값.
 * 하울링 대역 하나만 좁게 깎으면 거의 바뀌지 않고, 페이더·센드·뮤트·GEQ 전체로 줄이면 크게 내려간다.
 */
export function monitorLevelDb(s: MixerState, ch: number, aux: number): number {
  const path = sendPathGainDb(s, ch, aux);
  if (path === NEG_INF) return NEG_INF;
  let power = 0;
  for (const f of VOICE_BAND_FREQS) {
    const db = channelEqResponseDb(s.channels[ch], f) + geqResponseDb(s.auxes[aux].geq, f);
    power += Math.pow(10, db / 10);
  }
  return path + 10 * Math.log10(power / VOICE_BAND_FREQS.length);
}

/** 주파수 대역 [lo, hi]에서 채널 EQ 응답의 평균(dB). 설교 미션의 저중역 감쇠량 판정에 쓴다. */
export function bandAverageDb(ch: ChannelState, lo: number, hi: number, includeHpf = false): number {
  const freqs: number[] = [];
  for (let f = lo; f <= hi * 1.0001; f *= Math.pow(2, 1 / 6)) freqs.push(f);
  let sum = 0;
  for (const f of freqs) sum += includeHpf ? channelEqResponseDb(ch, f) : peqResponseDb(ch, f);
  return sum / freqs.length;
}
