#!/usr/bin/env node
// 퀴즈 전부 풀기: 레슨마다 카드를 넘기며 O/X 퀴즈와 실전 시나리오 퀴즈(CaseQuiz)를 끝까지 푼다.
// 기획서 S02 '실전 퀴즈' 규칙을 확인한다.
// - 방탈출형: 확인할 곳을 모두 열기 전에는 보기가 안 보인다
// - 틀린 보기: '다시 생각해 봐요'와 해설이 뜨고 다시 고를 수 있다
// - 맞힌 단계의 단서가 단서 수첩에 쌓인다
// - 다 풀면 결과(틀린 횟수가 실제와 같은지), 사고 흐름(단계 수만큼), 교훈, '처음부터 다시 풀기'
//
//   node tools/qa/quizzes.mjs --base http://127.0.0.1:4329 --out qa-reports/<run> [--viewport mobile] [--only 02-processing]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, openPage } from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const base = String(args.base ?? 'http://127.0.0.1:4329').replace(/\/$/, '');
const out = String(args.out ?? 'qa-reports/quizzes');
const viewport = String(args.viewport ?? 'mobile');
const only = args.only ? String(args.only) : null;
await mkdir(join(out, 'screens'), { recursive: true });

const idx = await (await fetch(`${base}/sitemap-index.xml`)).text();
const lessons = [];
for (const m of [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)]) {
  const xml = await (await fetch(base + new URL(m[1]).pathname)).text();
  lessons.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => new URL(x[1]).pathname).filter((p) => p.startsWith('/lessons/')));
}
const targets = lessons.filter((p) => !only || p.includes(only));

const browser = await launch();
const report = [];

for (const path of targets) {
  const { page, context, errors, setStep } = await openPage(browser, viewport);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  const found = { path, ox: [], cases: [], errors };
  const seenCase = new Set();
  const seenOx = new Set();
  for (let card = 1; card <= 40; card++) {
    // O/X 퀴즈
    for (const q of await page.locator('.quiz').all()) {
      if (!(await q.isVisible())) continue;
      const text = (await q.locator('.quiz-q').innerText()).trim();
      if (seenOx.has(text)) continue;
      seenOx.add(text);
      setStep(`O/X "${text.slice(0, 30)}"`);
      const r = { card, q: text, problems: [] };
      for (const pick of ['O', 'X']) {
        await q.locator('.quiz-btn', { hasText: new RegExp(`^${pick}$`) }).click();
        const res = q.locator('.quiz-result');
        if (!(await res.isVisible())) r.problems.push(`${pick}를 눌렀는데 결과가 안 뜸`);
        const head = await res.locator('strong').innerText();
        const answer = (await q.locator('.quiz-btn.is-answer').innerText()).trim();
        const expectRight = answer === pick;
        if (expectRight !== head.startsWith('정답')) r.problems.push(`${pick} 선택: 정답 표시(${answer})와 결과 문구("${head}")가 어긋남`);
        if (!(await res.locator('p').innerText()).trim()) r.problems.push('해설이 비어 있음');
      }
      found.ox.push(r);
    }

    // 실전 시나리오 퀴즈
    for (const q of await page.locator('.cq').all()) {
      if (!(await q.isVisible())) continue;
      const title = (await q.locator('.cq-title').innerText().catch(() => '')).trim();
      if (!title || seenCase.has(title)) continue;
      seenCase.add(title);
      setStep(`실전 퀴즈 "${title}"`);
      const level = (await q.locator('.cq-level').innerText()).trim();
      const r = { card, title, level, steps: 0, wrongClicks: 0, problems: [] };
      if (await q.locator('.cq-missing').count()) r.problems.push('퀴즈 데이터를 찾지 못함');
      for (let step = 0; step < 6 && !(await q.locator('.cq-result').isVisible()); step++) {
        r.steps++;
        const tiles = q.locator('.cq-tile');
        const nTiles = await tiles.count();
        if (level.includes('방탈출') && nTiles === 0) r.problems.push(`단계 ${step + 1}: 방탈출형인데 확인할 곳 타일이 없음(기획서 S02: 단계마다 타일을 열고 답을 고른다)`);
        if (nTiles > 0) {
          if (await q.locator('.cq-options').isVisible()) r.problems.push(`단계 ${step + 1}: 단서를 열기 전에 보기가 보임`);
          for (let i = 0; i < nTiles; i++) {
            await tiles.nth(i).click();
            if (!(await tiles.nth(i).locator('.cq-tile-reading').isVisible())) r.problems.push(`단계 ${step + 1}: 타일 ${i + 1}을 눌러도 단서가 안 보임`);
          }
        }
        const notebookBefore = await q.locator('.cq-notebook li').count();
        const opts = q.locator('.cq-opt');
        const nOpts = await opts.count();
        if (nOpts < 2) r.problems.push(`단계 ${step + 1}: 보기가 ${nOpts}개`);
        let solved = false;
        for (let i = 0; i < nOpts && !solved; i++) {
          await opts.nth(i).click();
          const fb = q.locator('.cq-feedback');
          if (!(await fb.isVisible())) {
            r.problems.push(`단계 ${step + 1}: 보기 ${i + 1}을 눌러도 해설이 안 뜸`);
            continue;
          }
          solved = (await fb.getAttribute('class')).includes('is-right');
          if (!(await fb.locator('p').innerText()).trim()) r.problems.push(`단계 ${step + 1}: 보기 ${i + 1}의 해설이 비어 있음`);
          if (!solved) {
            r.wrongClicks++;
            if (!(await opts.nth(i).getAttribute('class')).includes('is-wrong')) r.problems.push(`단계 ${step + 1}: 틀린 보기 ${i + 1}에 표시가 없음`);
          }
        }
        if (!solved) {
          r.problems.push(`단계 ${step + 1}: 정답 보기가 없음(모든 보기가 오답)`);
          break;
        }
        // 단서 수첩은 맞힌 직후 한 줄 늘어야 한다.
        const nb = await q.locator('.cq-notebook li').count();
        if (nb !== notebookBefore + 1) r.problems.push(`단계 ${step + 1}: 맞힌 뒤 단서 수첩 ${notebookBefore}→${nb}줄(1줄 늘어야 함)`);
        await q.locator('.cq-next').click();
      }
      const result = q.locator('.cq-result');
      if (!(await result.isVisible())) r.problems.push('끝까지 풀었는데 결과가 안 뜸');
      else {
        const tally = await result.locator('.cq-result-head span').innerText();
        const expect = r.wrongClicks === 0 ? '한 번도 틀리지 않았어요' : `틀린 횟수 ${r.wrongClicks}번`;
        if (tally.trim() !== expect) r.problems.push(`결과 틀린 횟수 "${tally}" ≠ 실제 "${expect}"`);
        const flow = await result.locator('.cq-flow li').count();
        if (flow !== r.steps) r.problems.push(`사고 흐름 ${flow}줄 ≠ 단계 ${r.steps}개`);
        if (!(await result.locator('.cq-takeaway').innerText()).trim()) r.problems.push('교훈이 비어 있음');
        const want = { 쉬움: [1, 1], 보통: [2, 2], 어려움: [3, 4] }[level.split(' ')[0]];
        if (want && (r.steps < want[0] || r.steps > want[1])) r.problems.push(`난이도 ${level}인데 단계 ${r.steps}개(기획: ${want.join('~')}단계)`);
        await q.locator('.cq-again').click();
        if (!(await q.locator('.cq-step').isVisible()) || (await result.isVisible())) r.problems.push("'처음부터 다시 풀기' 뒤 처음으로 안 돌아감");
      }
      if (r.problems.length) {
        const file = join('screens', `quiz-${path.replace(/[^a-z0-9]+/gi, '_')}-${found.cases.length + 1}.png`);
        await q.screenshot({ path: join(out, file) }).catch(() => {});
        r.shot = file;
      }
      found.cases.push(r);
    }

    const next = page.locator('[data-next]');
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(150);
  }
  report.push(found);
  const bad = found.ox.filter((x) => x.problems.length).length + found.cases.filter((x) => x.problems.length).length + errors.length;
  console.log(`${bad ? '✗' : '✓'} ${path}  O/X ${found.ox.length} · 실전 ${found.cases.length} · 문제 ${bad}`);
  await context.close();
}
await browser.close();

await writeFile(join(out, 'quizzes.json'), JSON.stringify(report, null, 2));
const totalOx = report.reduce((n, r) => n + r.ox.length, 0);
const totalCase = report.reduce((n, r) => n + r.cases.length, 0);
const L = [`# 퀴즈 전부 풀기 요약`, '', `- 대상: ${base} (${viewport}), 레슨 ${report.length}개`, `- O/X ${totalOx}개, 실전 퀴즈 ${totalCase}개를 풀었다`, ''];
for (const r of report) {
  const items = [
    ...r.errors.map((e) => `- [${e.kind}] (${e.step}) ${e.text}`),
    ...r.ox.flatMap((x) => x.problems.map((p) => `- O/X (카드 ${x.card}) "${x.q.slice(0, 40)}": ${p}`)),
    ...r.cases.flatMap((x) => x.problems.map((p) => `- 실전 (카드 ${x.card}) "${x.title}" [${x.level}]: ${p}${x.shot ? ` (${x.shot})` : ''}`)),
  ];
  if (!r.ox.length && !r.cases.length) items.push('- 퀴즈가 하나도 없음');
  if (items.length) L.push(`## ${r.path}`, '', ...items, '');
}
await writeFile(join(out, 'quizzes-summary.md'), L.join('\n'));
console.log(`\nO/X ${totalOx} · 실전 ${totalCase} → ${join(out, 'quizzes-summary.md')}`);
