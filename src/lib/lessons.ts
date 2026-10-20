import { getCollection, type CollectionEntry } from 'astro:content';

export type Lesson = CollectionEntry<'lessons'>;

export const CHAPTERS = [
  { key: 'basics', no: 1, label: '1장. 음향 기초', short: '1장', name: '음향 기초', blurb: '소리가 지나가는 길과 dB, 주파수, 마이크, 스피커' },
  { key: 'processing', no: 2, label: '2장. 처리기 다루기', short: '2장', name: '처리기 다루기', blurb: '게인, EQ, 하울링, 다이내믹스, 이펙트를 직접 만져 본다' },
  { key: 'consoles', no: 3, label: '3장. 믹서 실습', short: '3장', name: '믹서 실습', blurb: '쉬운 믹서로 버스·솔로·씬을 익히고 주일 예배 문제를 풀어 본다' },
] as const;

export function chapterOf(lesson: Lesson) {
  return CHAPTERS.find((c) => c.key === lesson.data.chapter)!;
}

/** 장 순서 → 레슨 순서로 정렬한 전체 레슨. */
export async function sortedLessons(): Promise<Lesson[]> {
  const all = await getCollection('lessons');
  return all.sort((a, b) => chapterOf(a).no - chapterOf(b).no || a.data.order - b.data.order);
}

export function lessonHref(lesson: Lesson): string {
  return `/lessons/${lesson.id}/`;
}
