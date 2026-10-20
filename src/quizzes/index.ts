// 실전 퀴즈 전체(#43). 레슨 원고에서 <CaseQuiz id="..." />로 부른다.
import { BASICS } from './basics';
import { MIXER } from './mixer';
import { PROCESSING } from './processing';
import type { Quiz } from './types';

export const QUIZZES: Quiz[] = [...BASICS, ...PROCESSING, ...MIXER];

export function quizById(id: string): Quiz | undefined {
  return QUIZZES.find((q) => q.id === id);
}

export function quizzesOf(lesson: string): Quiz[] {
  return QUIZZES.filter((q) => q.lesson === lesson).sort((a, b) => a.level - b.level);
}
