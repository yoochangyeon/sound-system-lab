#!/usr/bin/env node
// 실전 퀴즈 데이터 통계(교수법 리뷰어용). 정답이 위치·길이로 티 나는지, 난이도별 단계 수, 해설 길이를 본다.
//   node tools/qa/quiz-stats.mjs [--out <폴더>]   → 표준 출력 + <폴더>/quiz-stats.md
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../../src/quizzes/', import.meta.url);
const files = (await readdir(root)).filter((f) => f.endsWith('.ts') && !/^(index|types)\.ts$|\.test\.ts$/.test(f));
const quizzes = [];
for (const f of files) for (const v of Object.values(await import(new URL(f, root)))) if (Array.isArray(v)) quizzes.push(...v.map((q) => ({ ...q, file: f })));

const MARK = ['가', '나', '다', '라', '마'];
const pos = {};
let longest = 0;
let shortest = 0;
let stepsTotal = 0;
const rows = [];
const byLevel = { 1: [], 2: [], 3: [] };
for (const q of quizzes) {
  byLevel[q.level].push(q.steps.length);
  q.steps.forEach((s, i) => {
    stepsTotal++;
    const ci = s.options.findIndex((o) => o.correct);
    const nCorrect = s.options.filter((o) => o.correct).length;
    pos[MARK[ci] ?? '없음'] = (pos[MARK[ci] ?? '없음'] ?? 0) + 1;
    const lens = s.options.map((o) => o.text.length);
    const isLongest = lens[ci] === Math.max(...lens) && lens.filter((l) => l === lens[ci]).length === 1;
    const isShortest = lens[ci] === Math.min(...lens) && lens.filter((l) => l === lens[ci]).length === 1;
    if (isLongest) longest++;
    if (isShortest) shortest++;
    const thinFeedback = s.options.filter((o) => o.feedback.length < 25).length;
    rows.push(`| ${q.id} | ${q.lesson} | ${q.level} | ${i + 1} | ${s.options.length} | ${MARK[ci] ?? '-'}${nCorrect !== 1 ? ` (정답 ${nCorrect}개!)` : ''} | ${isLongest ? '가장 김' : isShortest ? '가장 짧음' : ''} | ${s.inspect?.length ?? 0} | ${thinFeedback || ''} |`);
  });
}
const L = [
  `# 실전 퀴즈 통계`,
  '',
  `- 퀴즈 ${quizzes.length}개, 단계 ${stepsTotal}개 (파일: ${files.join(', ')})`,
  `- 정답 위치: ${Object.entries(pos).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  `- 정답 보기가 혼자 가장 긴 단계: ${longest}/${stepsTotal} (${Math.round((longest / stepsTotal) * 100)}%), 혼자 가장 짧은 단계: ${shortest}/${stepsTotal}`,
  `- 난이도별 단계 수: ${Object.entries(byLevel).map(([lv, a]) => `${({1:"쉬움",2:"보통",3:"어려움"})[lv]} ${a.length}개(단계 ${[...new Set(a)].sort().join("·")})`).join(', ')}`,
  '',
  '| 퀴즈 | 레슨 | 난이도 | 단계 | 보기 수 | 정답 | 정답 길이 | 확인할 곳 | 해설 25자 미만 |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows,
];
console.log(L.slice(0, 6).join('\n'));
if (process.argv.includes('--out')) {
  const out = process.argv[process.argv.indexOf('--out') + 1];
  await writeFile(join(out, 'quiz-stats.md'), L.join('\n'));
  console.log(`→ ${join(out, 'quiz-stats.md')}`);
}
