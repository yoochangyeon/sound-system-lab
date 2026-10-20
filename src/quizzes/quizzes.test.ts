// 실전 퀴즈 데이터 검사(#43): 형식, 레슨마다 쉬움·보통·어려움, 원고에서 부르는 id가 실제로 있는지.
import { describe, expect, it } from 'vitest';
import { QUIZZES, quizzesOf } from '.';

const files = import.meta.glob<string>('../content/lessons/*/*.mdx', { query: '?raw', import: 'default', eager: true });
const lessons = Object.entries(files).map(([path, text]) => ({
  id: path.replace('../content/lessons/', '').replace(/\.mdx$/, ''),
  text,
}));

describe('실전 퀴즈 데이터', () => {
  it('id가 겹치지 않는다', () => {
    const ids = QUIZZES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(QUIZZES)('$id: 단계마다 정답이 하나, 보기·해설·단서가 있다', (q) => {
    expect(q.steps.length).toBeGreaterThan(0);
    for (const s of q.steps) {
      expect(s.options.filter((o) => o.correct).length).toBe(1);
      expect(s.options.length).toBeGreaterThanOrEqual(3);
      for (const o of s.options) expect(o.feedback.length).toBeGreaterThan(5);
      expect(s.clue.length).toBeGreaterThan(3);
    }
    expect(q.takeaway.length).toBeGreaterThan(5);
  });

  it.each(QUIZZES)('$id: 난이도와 단계 수가 맞다(쉬움 1, 보통 2, 어려움 3~4이고 확인할 곳이 있다)', (q) => {
    if (q.level === 1) expect(q.steps.length).toBe(1);
    if (q.level === 2) expect(q.steps.length).toBe(2);
    if (q.level === 3) {
      expect(q.steps.length).toBeGreaterThanOrEqual(3);
      expect(q.steps.length).toBeLessThanOrEqual(4);
      expect(q.steps.some((s) => s.inspect && s.inspect.length > 0)).toBe(true);
    }
  });

  it('정답 위치가 한쪽에 몰리지 않는다', () => {
    const pos = QUIZZES.flatMap((q) => q.steps.map((s) => s.options.findIndex((o) => o.correct)));
    const share = (i: number) => pos.filter((p) => p === i).length / pos.length;
    for (const i of [0, 1, 2]) expect(share(i)).toBeLessThan(0.5);
  });

  it.each(lessons)('$id: 퀴즈가 쉬움·보통·어려움으로 있고, 원고가 모두 부른다', ({ id, text }) => {
    const qs = quizzesOf(id);
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(new Set(qs.map((q) => q.level))).toEqual(new Set([1, 2, 3]));
    for (const q of qs) expect(text).toContain(`<CaseQuiz client:load id="${q.id}"`);
  });

  it('레슨 원고를 모두 읽었다', () => expect(lessons.length).toBe(13));

  it('원고가 부르는 퀴즈 id는 모두 데이터에 있다', () => {
    for (const { text } of lessons)
      for (const m of text.matchAll(/<CaseQuiz client:load id="([^"]+)"/g)) expect(QUIZZES.some((q) => q.id === m[1])).toBe(true);
  });
});
