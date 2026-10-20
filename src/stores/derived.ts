// 믹서 상태에서 바로 계산하는 숫자들. 그래프와 미션 판정이 같은 함수를 쓴다.
// Web Audio 없이 계산하므로 Node(Vitest)에서 그대로 검사한다.

import { BUTTERWORTH_Q_DB, biquadResponseDb, type BiquadParams } from '../audio/dsp/biquad';
import { compGainDb } from '../audio/dsp/dynamics';
import { geqResponseDb } from '../audio/dsp/geq';
import { stemById, type Stem } from '../audio/stems';
import type { ChannelState, MixerState } from './mixer-model';

const NEG_INF = -Infinity;

/** 채널 ch를 묶은 DCA들 */
export function dcasOf(s: MixerState, ch: number) {
  return s.dca.filter((d) => d.members[ch]);
}

/** 뮤트 그룹 때문에 꺼졌는가 */
export function mutedByGroup(s: MixerState, ch: number): boolean {
  return s.muteGroups.some((g) => g.on && g.members[ch]);
}

/**
 * 실제로 소리에 걸리는 채널 상태: 페이더에 묶인 DCA 페이더를 더하고, DCA 뮤트·뮤트 그룹을 뮤트에 합친다.
 * 엔진과 판정이 같은 값을 쓴다. 바뀐 것이 없으면 같은 객체를 돌려준다.
 */
export function effectiveChannel(s: MixerState, ch: number): ChannelState {
  const c = s.channels[ch];
  const dcas = dcasOf(s, ch);
  const mute = c.mute || dcas.some((d) => d.mute) || mutedByGroup(s, ch);
  const faderDb = dcas.reduce((db, d) => db + d.faderDb, c.faderDb);
  if (mute === c.mute && faderDb === c.faderDb) return c;
  return { ...c, mute, faderDb: Number.isNaN(faderDb) ? NEG_INF : faderDb };
}

export function hpfFilter(ch: ChannelState): BiquadParams | null {
  return ch.preamp.hpfOn ? { type: 'highpass', freq: ch.preamp.hpfFreq, gainDb: 0, q: BUTTERWORTH_Q_DB } : null;
}

export function lpfFilter(ch: ChannelState): BiquadParams | null {
  return ch.preamp.lpfOn ? { type: 'lowpass', freq: ch.preamp.lpfFreq, gainDb: 0, q: BUTTERWORTH_Q_DB } : null;
}

export function peqFilters(ch: ChannelState): BiquadParams[] {
  if (!ch.peq.on) return [];
  return ch.peq.bands.map((b) => ({ type: b.type, freq: b.freq, gainDb: b.gainDb, q: b.q }));
}

/** 채널 EQ(HPF + LPF + PEQ) 합성 응답(dB). */
export function channelEqResponseDb(ch: ChannelState, f: number): number {
  let total = 0;
  const hpf = hpfFilter(ch);
  if (hpf) total += biquadResponseDb(hpf, f);
  const lpf = lpfFilter(ch);
  if (lpf) total += biquadResponseDb(lpf, f);
  for (const p of peqFilters(ch)) total += biquadResponseDb(p, f);
  return total;
}

/** 센드가 지나는 채널 필터의 응답. pre-eq 센드는 HPF·LPF만 지나고 PEQ를 건너뛴다. */
export function sendEqResponseDb(s: MixerState, ch: number, aux: number, f: number): number {
  const c = s.channels[ch];
  return c.sends[aux]?.tap === 'pre-eq' ? channelEqResponseDb(c, f) - peqResponseDb(c, f) : channelEqResponseDb(c, f);
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

/** 채널이 그룹 a를 거쳐 메인으로 가는가(센드·그룹 뮤트·그룹 페이더·그룹의 메인 할당). */
export function channelReachesMainViaGroup(s: MixerState, ch: number, a: number): boolean {
  const b = s.auxes[a];
  const send = s.channels[ch]?.sends[a];
  if (!b || b.kind !== 'group' || !send) return false;
  return send.levelDb !== NEG_INF && !b.mute && b.faderDb !== NEG_INF && b.mainAssign;
}

/** 채널 신호가 메인까지 가는가(패치·스템·뮤트·페이더, 그리고 메인 할당이나 그룹 경로, 메인 뮤트·페이더). */
export function channelReachesMain(s: MixerState, ch: number): boolean {
  if (!s.channels[ch]) return false;
  const c = effectiveChannel(s, ch);
  if (!channelStem(s, ch)) return false;
  if (c.mute || c.faderDb === NEG_INF) return false;
  const direct = c.mainAssign;
  const viaGroup = s.auxes.some((_, a) => channelReachesMainViaGroup(s, ch, a));
  if (!direct && !viaGroup) return false;
  if (s.main.mute || s.main.faderDb === NEG_INF) return false;
  return true;
}

/** 무엇 때문에 메인까지 안 가는지(힌트·디버그용). */
export function mainPathProblems(s: MixerState, ch: number): string[] {
  const c = s.channels[ch];
  const dcas = dcasOf(s, ch);
  const out: string[] = [];
  const input = s.patch[ch];
  if (input === null || input === undefined) out.push('patch-none');
  else if (!s.inputs[input]?.stemId) out.push('patch-empty');
  if (c.mute) out.push('mute');
  if (c.faderDb === NEG_INF) out.push('fader-down');
  if (dcas.some((x) => x.mute)) out.push('dca-mute');
  if (dcas.some((x) => x.faderDb === NEG_INF)) out.push('dca-down');
  if (mutedByGroup(s, ch)) out.push('mute-group');
  if (!c.mainAssign && !s.auxes.some((_, a) => channelReachesMainViaGroup(s, ch, a))) out.push('main-assign-off');
  if (s.main.mute) out.push('main-mute');
  if (s.main.faderDb === NEG_INF) out.push('main-fader-down');
  return out;
}

/**
 * 센드 경로 게인(c→a, dB) = 프리엠프 게인 + (post면 채널 페이더) + 센드 레벨 + Aux 페이더.
 * 채널 EQ는 들어 있지 않다(주파수마다 다르므로 loopGainDb가 더한다. pre-eq 센드에는 더하지 않는다).
 * 채널·Aux 뮤트, 끝까지 내린 페이더·센드, 패치 없음이면 -∞.
 */
export function sendPathGainDb(s: MixerState, ch: number, aux: number): number {
  if (!s.channels[ch]) return NEG_INF;
  const c = effectiveChannel(s, ch);
  const bus = s.auxes[aux];
  const send = c.sends[aux];
  if (!bus || !send) return NEG_INF;
  if (!channelStem(s, ch)) return NEG_INF;
  if (c.mute || bus.mute) return NEG_INF;
  if (send.levelDb === NEG_INF || bus.faderDb === NEG_INF) return NEG_INF;
  let g = c.preamp.gainDb + send.levelDb + bus.faderDb;
  if (send.tap === 'post') {
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
    sendEqResponseDb(s, ch, aux, f) +
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
    const db = sendEqResponseDb(s, ch, aux, f) + geqResponseDb(s.auxes[aux].geq, f);
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
