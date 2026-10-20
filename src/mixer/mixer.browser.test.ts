// #36: 쉬운 믹서(8채널, 채널마다 게이트·컴프 워클릿) + 모니터 2 + 메인을 실시간보다 빨리 처리하는지 잰다.
// OfflineAudioContext 렌더 시간 ÷ 오디오 길이 = 실시간 대비 부하. 1보다 작아야 끊기지 않는다.
import { describe, expect, it } from 'vitest';
import { MixerEngine } from '../audio/engine';
import { sineBuffer } from '../audio/test-helpers';
import { STEMS } from '../audio/stems';
import { createMixerStore } from '../stores/mixer';
import { GENERIC_PROFILE } from '../stores/profile';
import { mixerDefaultState } from './mixer-state';

type Load = 'default' | 'dyn' | 'everything';

async function measure(load: Load | boolean): Promise<number> {
  const mode: Load = load === true ? 'dyn' : load === false ? 'default' : load;
  const seconds = 4;
  const sr = 48000;
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: seconds * sr, sampleRate: sr });
  const state = mixerDefaultState();
  if (mode !== 'default') state.channels = state.channels.map((c) => ({ ...c, mute: false, gate: { ...c.gate, on: true }, comp: { ...c.comp, on: true } }));
  if (mode === 'everything') {
    // 4차 기능을 한꺼번에: 모든 채널이 그룹·리버브·딜레이로 보내고, 두 채널은 인서트, 버스 컴프·EQ, 매트릭스, 솔로
    state.channels = state.channels.map((c, i) => ({
      ...c,
      sends: c.sends.map((sd) => ({ ...sd, levelDb: -6 })),
      insert: { ...c.insert, on: i < 2, fx: { ...c.insert.fx, type: i === 0 ? 'reverb' : 'chorus' } },
      solo: i === 0,
    }));
    state.auxes = state.auxes.map((b) => ({ ...b, comp: { ...b.comp, on: true }, geq: b.geq.map((g, k) => (k === 10 ? -3 : g)) }));
    state.main = { ...state.main, comp: { ...state.main.comp, on: true } };
    state.matrix = state.matrix.map((m) => ({ ...m, fromMainDb: 0 }));
  }
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

  it('4차 기능 전부(FX 센드·인서트·그룹·버스 컴프·매트릭스·솔로)를 켜도 실시간보다 빠르다', async () => {
    const ratio = await measure('everything');
    console.log(`4차 전부 처리 부하: ${(ratio * 100).toFixed(1)}%`);
    // 2026-10-20 이 Mac에서 따로 재면 Chromium 32%, WebKit 37%. 두 브라우저 테스트가 함께 돌면 67%까지 올라간 적이 있어 기준을 넉넉히 둔다.
    expect(ratio).toBeLessThan(0.8);
  });

  it('8채널 전체 처리(게이트·컴프 켬)가 실시간보다 빠르다', async () => {
    const ratio = await measure(true);
    console.log(`전체 켬 처리 부하: ${(ratio * 100).toFixed(1)}%`);
    expect(ratio).toBeLessThan(0.6);
  });
});
