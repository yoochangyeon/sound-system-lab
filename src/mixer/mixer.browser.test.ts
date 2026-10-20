// #36: 쉬운 믹서(8채널, 채널마다 게이트·컴프 워클릿) + 모니터 2 + 메인을 실시간보다 빨리 처리하는지 잰다.
// OfflineAudioContext 렌더 시간 ÷ 오디오 길이 = 실시간 대비 부하. 1보다 작아야 끊기지 않는다.
import { describe, expect, it } from 'vitest';
import { MixerEngine } from '../audio/engine';
import { sineBuffer } from '../audio/test-helpers';
import { STEMS } from '../audio/stems';
import { createMixerStore } from '../stores/mixer';
import { GENERIC_PROFILE } from '../stores/profile';
import { mixerDefaultState } from './mixer-state';

async function measure(allOn: boolean): Promise<number> {
  const seconds = 4;
  const sr = 48000;
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: seconds * sr, sampleRate: sr });
  const state = mixerDefaultState();
  if (allOn) state.channels = state.channels.map((c) => ({ ...c, mute: false, gate: { ...c.gate, on: true }, comp: { ...c.comp, on: true } }));
  const store = createMixerStore(state, GENERIC_PROFILE);
  const buffers = new Map(STEMS.map((s, i) => [s.id, sineBuffer(ctx, 110 * (i + 1), -18, seconds)]));
  const engine = await MixerEngine.create(ctx, store, { buffers, howlTickMs: 0 });
  engine.play(0);
  const t0 = performance.now();
  await ctx.startRendering();
  const ratio = (performance.now() - t0) / 1000 / seconds;
  engine.dispose();
  return ratio;
}

describe('쉬운 믹서 처리 부하', () => {
  it('기본 믹스(게이트·컴프 꺼짐)가 실시간보다 충분히 빠르다', async () => {
    const ratio = await measure(false);
    console.log(`기본 믹스 처리 부하: ${(ratio * 100).toFixed(1)}%`);
    expect(ratio).toBeLessThan(0.5);
  });

  it('8채널 전체 처리(게이트·컴프 켬)가 실시간보다 빠르다', async () => {
    const ratio = await measure(true);
    console.log(`전체 켬 처리 부하: ${(ratio * 100).toFixed(1)}%`);
    expect(ratio).toBeLessThan(0.6);
  });
});
