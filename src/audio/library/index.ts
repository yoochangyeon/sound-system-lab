// 음원 라이브러리 목록. 곡을 더하려면 songs/에 매니페스트를 만들고 SONGS에 넣는다(docs/audio-pipeline.md).
import { ACTIONS_DEVILS_WORDS } from './songs/actions-devils-words';
import type { Song, SongStem, StemRole } from './types';

export * from './types';

export const SONGS: Song[] = [ACTIONS_DEVILS_WORDS];
export const DEFAULT_SONG: Song = SONGS[0];

/** 엔진·저장소가 쓰는 소스(사이트 전체에서 유일한 id = 곡 id/소스 키). */
export interface Stem extends SongStem {
  id: string;
  songId: string;
}

export function stemId(song: Song, key: string): string {
  return `${song.id}/${key}`;
}

export const STEMS: Stem[] = SONGS.flatMap((song) => song.stems.map((s) => ({ ...s, id: stemId(song, s.key), songId: song.id })));

export function songById(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}

export function stemById(id: string): Stem | undefined {
  return STEMS.find((s) => s.id === id);
}

/** 곡에서 역할에 맞는 소스를 역할 순서대로. 역할을 주지 않으면 곡의 소스 전부. */
export function stemsFor(song: Song, roles?: StemRole[]): Stem[] {
  const all = STEMS.filter((s) => s.songId === song.id);
  if (!roles) return all;
  return roles.flatMap((r) => all.filter((s) => s.role === r));
}
