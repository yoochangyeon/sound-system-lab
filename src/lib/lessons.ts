import { getCollection, type CollectionEntry } from 'astro:content';

export type Lesson = CollectionEntry<'lessons'>;

export const CHAPTERS = [
  { key: 'basics', no: 1, label: '1장. 음향 기초', short: '1장' },
  { key: 'processing', no: 2, label: '2장. 처리기 다루기', short: '2장' },
  { key: 'consoles', no: 3, label: '3장. 디지털 믹서 실습', short: '3장' },
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
