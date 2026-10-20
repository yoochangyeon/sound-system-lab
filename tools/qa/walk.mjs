#!/usr/bin/env node
// 레슨을 수강생이 보는 순서대로 카드 한 장씩 저장한다(조작은 하지 않는다).
// 카드마다 화면(png)과 보이는 글(txt)을 남기고, 레슨마다 전체 글을 index.md 하나로 모은다.
// 교수법 리뷰어와 수강생 리뷰어가 렌더링된 강의자료를 읽을 때 쓴다.
//
//   node tools/qa/walk.mjs --base http://127.0.0.1:4329 --out <폴더> [--only 01-basics] [--viewport mobile] [--no-shots]
//
// 결과: <out>/walk/<레슨>/01.png, 01.txt, …, index.md
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
const out = String(args.out ?? 'qa-reports/walk');
const viewport = String(args.viewport ?? 'mobile');
const only = args.only ? String(args.only) : null;
const shots = !args['no-shots'];

const idx = await (await fetch(`${base}/sitemap-index.xml`)).text();
const lessons = [];
for (const m of [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)]) {
  const xml = await (await fetch(base + new URL(m[1]).pathname)).text();
  lessons.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => new URL(x[1]).pathname).filter((p) => p.startsWith('/lessons/')));
}

// 지금 보이는 카드의 글. 스타일·스크립트 태그와 숨은 카드는 뺀다.
const cardText = () =>
  Array.from(document.querySelector('[data-body]')?.children ?? [])
    .filter((el) => !['STYLE', 'SCRIPT', 'LINK', 'HR'].includes(el.tagName) && !el.classList.contains('is-off'))
    .map((el) => el.innerText.trim())
    .filter(Boolean)
    .join('\n\n');

const browser = await launch();
for (const path of lessons.filter((p) => !only || p.includes(only))) {
  const slug = path.replace(/^\/lessons\/|\/$/g, '').replace(/\//g, '__');
  const dir = join(out, 'walk', slug);
  await mkdir(dir, { recursive: true });
  const { page, context, errors } = await openPage(browser, viewport);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  const title = await page.title();
  const md = [`# ${title}`, '', `주소: ${path}`, ''];
  let card = 1;
  for (; card <= 40; card++) {
    await page.waitForTimeout(250); // 카드 등장 애니메이션
    const n = String(card).padStart(2, '0');
    const text = await page.evaluate(cardText);
    const count = await page.locator('[data-count]').innerText().catch(() => '');
    await writeFile(join(dir, `${n}.txt`), text);
    if (shots) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(dir, `${n}.png`), fullPage: true });
    }
    md.push(`## 카드 ${card} (${count})${shots ? ` · ${n}.png` : ''}`, '', text, '');
    const next = page.locator('[data-next]');
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  const finish = await page.locator('[data-finish]').innerText().catch(() => '');
  md.push(`---`, `마지막 카드 버튼: ${finish.trim() || '(없음)'}`);
  if (errors.length) md.push('', '페이지 오류:', ...errors.map((e) => `- [${e.kind}] ${e.text}`));
  await writeFile(join(dir, 'index.md'), md.join('\n'));
  console.log(`${path}  카드 ${card}장 → ${dir}`);
  await context.close();
}
await browser.close();
