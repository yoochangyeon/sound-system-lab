// 브라우저 엔진 테스트용 도우미. OfflineAudioContext로 그래프를 렌더링하고 레벨을 잰다.
import { dbToGain } from './dsp/units';
import { MixerEngine } from './engine';
import { createMixerStore, type MixerStoreApi } from '../stores/mixer';
import { defaultMixerState, type MixerShape, type MixerState } from '../stores/mixer-model';

export const SR = 48000;

export function sineBuffer(ctx: BaseAudioContext, freq: number, db: number, seconds = 1): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  const a = dbToGain(db);
  for (let i = 0; i < d.length; i++) d[i] = a * Math.sin((2 * Math.PI * freq * i) / ctx.sampleRate);
  return buf;
}

/** 뒤쪽 절반 구간의 RMS(dBFS). 램프·어택이 끝난 정상 상태를 본다. */
export function tailRmsDb(buf: AudioBuffer, channel = 0, fromFraction = 0.5): number {
  const d = buf.getChannelData(channel);
  const start = Math.floor(d.length * fromFraction);
  let s = 0;
  for (let i = start; i < d.length; i++) s += d[i] * d[i];
  const r = Math.sqrt(s / (d.length - start));
  return r > 0 ? 20 * Math.log10(r) : -Infinity;
}

export function maxAbs(buf: AudioBuffer): number {
  let p = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) p = Math.max(p, Math.abs(v));
  return p;
}

export interface RenderedMixer {
  store: MixerStoreApi;
  engine: MixerEngine;
  ctx: OfflineAudioContext;
}

/**
 * 한 채널짜리 믹서에 사인파를 넣고 렌더링한다.
 * prepare에서 저장소 액션으로 상태를 바꾼 뒤 렌더링한다.
 */
export async function renderMixer(opts: {
  freq: number;
  db: number;
  seconds?: number;
  shape?: Partial<MixerShape>;
  initial?: (s: MixerState) => MixerState;
  prepare?: (r: RenderedMixer) => void;
}): Promise<AudioBuffer> {
  const seconds = opts.seconds ?? 0.6;
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.round(seconds * SR), sampleRate: SR });
  let state = defaultMixerState({
    channels: opts.shape?.channels ?? 1,
    auxes: opts.shape?.auxes ?? 0,
    inputs: opts.shape?.inputs ?? [{ label: 'IN 1', stemId: 'test' }],
  });
  if (opts.initial) state = opts.initial(state);
  const store = createMixerStore(state);
  const buffers = new Map([['test', sineBuffer(ctx, opts.freq, opts.db, seconds)]]);
  const engine = await MixerEngine.create(ctx, store, { buffers, howlTickMs: 0 });
  opts.prepare?.({ store, engine, ctx });
  engine.play(0);
  const out = await ctx.startRendering();
  engine.dispose();
  return out;
}
