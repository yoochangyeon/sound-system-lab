// 실제 음원 파일이 브라우저에서 디코딩되는지, 길이가 같은지 확인한다(Chromium·WebKit).
import { describe, expect, it } from 'vitest';
import { STEMS } from './stems';
import { LOOP_SECONDS } from './stems.data';

describe('스템 파일', () => {
  it('모든 스템이 decodeAudioData로 디코딩되고 길이가 루프 길이와 같다', async () => {
    const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 128, sampleRate: 44100 });
    const files = [...new Set(STEMS.map((s) => s.file))];
    for (const file of files) {
      const res = await fetch(file);
      expect(res.ok, file).toBe(true);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      expect(buf.duration, file).toBeGreaterThan(LOOP_SECONDS - 0.1);
      expect(buf.duration, file).toBeLessThan(LOOP_SECONDS + 0.1);
    }
  });
});
