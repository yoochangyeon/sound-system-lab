// 곡 매니페스트 검사: 새 곡을 넣을 때 빠뜨리기 쉬운 것들.
import { describe, expect, it } from 'vitest';
import { SONGS, STEMS, stemsFor } from '.';
import { buildMissions } from '../../missions';

describe.each(SONGS)('곡 매니페스트: $title', (song) => {
  it('소스 키가 겹치지 않고, 파일이 곡 폴더 아래에 있다', () => {
    const keys = song.stems.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of song.stems) expect(s.file).toBe(`/audio/songs/${song.id}/${s.key}.m4a`);
  });

  it('믹서 채널 배치는 8개이고 모두 곡의 소스를 가리킨다', () => {
    expect(song.mixer.length).toBe(8);
    for (const slot of song.mixer) expect(song.stems.some((s) => s.key === slot.stem)).toBe(true);
  });

  it('출처·조건·바꾼 점이 적혀 있다', () => {
    expect(song.source.url).toMatch(/^https:\/\//);
    expect(song.terms.summary.length).toBeGreaterThan(5);
    expect(song.changes.length).toBeGreaterThan(5);
  });

  it('피크·RMS가 그럴듯하다(피크 ≤ 0 dBFS, RMS < 피크)', () => {
    for (const s of song.stems) {
      expect(s.peakDb).toBeLessThanOrEqual(0);
      expect(s.rmsDb).toBeLessThan(s.peakDb);
    }
  });

  it('미션 4종에 필요한 역할이 모두 있다', () => {
    expect(buildMissions(song).map((m) => m.id)).toEqual(['howl', 'sermon', 'gain', 'no-sound']);
  });

  it('역할로 고르면 역할 순서대로 나온다', () => {
    const picked = stemsFor(song, ['toms', 'snare']);
    expect(picked[0].role).toBe('toms');
  });
});

it('사이트 전체 소스 id가 겹치지 않는다', () => {
  const ids = STEMS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});
