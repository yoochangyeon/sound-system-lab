// 음원 라이브러리 파일이 브라우저에서 디코딩되는지, 길이가 곡의 루프 길이와 같은지 확인한다(Chromium·WebKit).
import { describe, expect, it } from 'vitest';
import { SONGS } from '.';

describe.each(SONGS)('곡 파일: $title', (song) => {
  it('모든 소스와 정답 믹스가 decodeAudioData로 디코딩되고 길이가 루프 길이와 같다', async () => {
    const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 128, sampleRate: 44100 });
    const files = [...song.stems.map((s) => s.file), ...(song.reference ? [song.reference.file] : [])];
    for (const file of files) {
      const res = await fetch(file);
      expect(res.ok, file).toBe(true);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      expect(buf.duration, file).toBeGreaterThan(song.loopSeconds - 0.1);
      expect(buf.duration, file).toBeLessThan(song.loopSeconds + 0.1);
    }
  });
});
