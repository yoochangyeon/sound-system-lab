#!/usr/bin/env node
// 전체 순회: 사이트의 모든 페이지를 화면 크기별로 열고, 보이는 조작 요소를 전부 눌러 본다.
// 레슨은 카드를 한 장씩 넘기며 카드마다 누른다. 재생 버튼을 누르면 실제로 소리가 나는지 잰다.
//
//   node tools/qa/crawl.mjs --base http://127.0.0.1:4329 --out qa-reports/<run> [--viewports desktop,mobile]
//                           [--only lab] [--engine chromium|webkit] [--card-shots]
//
// 결과: <out>/crawl.json(전체 기록), <out>/crawl-summary.md(사람용 요약), <out>/screens/*.png
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { acceptVolumeNotice, exerciseControls, launch, layoutIssues, loudest, openPage } from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const base = String(args.base ?? 'http://127.0.0.1:4329').replace(/\/$/, '');
const out = String(args.out ?? `qa-reports/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`);
const viewports = String(args.viewports ?? 'desktop,mobile').split(',');
const only = args.only ? String(args.only) : null;
const engine = String(args.engine ?? 'chromium');
const cardShots = Boolean(args['card-shots']);
const SILENT_DB = -70; // 이보다 작으면 '소리 안 남'. 게이트·익스팬더 위젯은 의도대로 -60 dBFS 근처까지 작아진다

await mkdir(join(out, 'screens'), { recursive: true });

async function pageList() {
  try {
    const idx = await (await fetch(`${base}/sitemap-index.xml`)).text();
    const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    const paths = [];
    for (const m of maps) {
      const xml = await (await fetch(base + m)).text();
      paths.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => new URL(x[1]).pathname));
    }
    if (paths.length) return paths;
  } catch {}
  return ['/', '/lab/', '/credits/'];
}

const slug = (p) => p.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '_') || 'home';
// 재생 버튼만 고른다. 퀴즈 타일("녹음 들어 보기 ①")처럼 이름에 '들어 보기'가 들어간 다른 버튼은 뺀다.
const isPlay = (name) => /^(▶|재생|소리 켜기)/.test(name.trim()) && !/정지|멈춤|■|⏸/.test(name);

const paths = (await pageList()).filter((p) => !only || p.includes(only));
console.log(`페이지 ${paths.length}개 × 화면 ${viewports.join(', ')} (${engine}) → ${out}`);

const browser = await launch(engine);
const results = [];
const links = new Set();

for (const path of paths) {
  for (const vp of viewports) {
    const { page, context, errors, setStep } = await openPage(browser, vp);
    const r = { path, viewport: vp, layout: [], clicks: [], sound: [], shots: [], cards: 0 };
    const t0 = Date.now();
    const afterAction = async (info) => {
      if (info.kind !== 'click' || !isPlay(info.name)) return;
      await page.waitForTimeout(150);
      await acceptVolumeNotice(page);
      // 첫 재생은 음원을 받고 디코딩하느라 늦게 소리가 난다. 최대 4초 기다리며 잰다.
      let s = null;
      for (let t = 0; t < 4 && !(s && s.rmsDb >= SILENT_DB); t++) {
        const v = await loudest(page, 1000);
        if (v && (!s || v.rmsDb > s.rmsDb)) s = v;
      }
      r.sound.push({ button: info.name, card: r.cards, ...(s ?? { rmsDb: null }), silent: !s || s.rmsDb < SILENT_DB });
    };
    try {
      setStep('페이지 열기');
      const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 });
      r.status = res?.status();
      for (const href of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) {
        if (href && href.startsWith('/') && !href.startsWith('//')) links.add(href.split('#')[0]);
      }
      const shot = async (name) => {
        const file = join('screens', `${slug(path)}-${vp}${name ? '-' + name : ''}.png`);
        const full = !name || name === 'after';
        if (full) await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: join(out, file), fullPage: full });
        r.shots.push(file);
      };
      for (const i of await layoutIssues(page)) r.layout.push({ card: 0, ...i });
      await shot('');

      const done = new Set();
      const hasCards = await page.locator('[data-next]').isVisible().catch(() => false);
      if (hasCards) {
        // 카드형 레슨: 카드마다 검사하고 누른 뒤 '다음'
        for (let card = 1; card <= 40; card++) {
          r.cards = card;
          setStep(`카드 ${card}`);
          const before = r.layout.length;
          for (const i of await layoutIssues(page)) r.layout.push({ card, ...i });
          r.clicks.push(...(await exerciseControls(page, { setStep: (s) => setStep(`카드 ${card} · ${s}`), done, skip: (n) => /^(이전|다음)$/.test(n), afterAction })).map((c) => ({ card, ...c })));
          if (cardShots || r.layout.length > before) await shot(`card${card}`);
          const next = page.locator('[data-next]');
          if (!(await next.isVisible().catch(() => false))) break;
          await next.click();
          await page.waitForTimeout(200);
        }
        r.finishVisible = await page.locator('[data-finish]').isVisible().catch(() => false);
      } else {
        r.clicks.push(...(await exerciseControls(page, { setStep, done, max: 400, afterAction })));
        for (const i of await layoutIssues(page)) r.layout.push({ card: 'after', ...i });
        await shot('after');
      }
    } catch (e) {
      r.fatal = String(e).split('\n')[0];
    }
    r.errors = errors;
    r.ms = Date.now() - t0;
    results.push(r);
    const bad = r.errors.length + r.layout.length + r.clicks.filter((c) => !c.ok).length + r.sound.filter((s) => s.silent).length + (r.fatal ? 1 : 0);
    console.log(`${bad ? '✗' : '✓'} ${path} [${vp}] 누름 ${r.clicks.length} · 오류 ${r.errors.length} · 화면 ${r.layout.length} · 소리 ${r.sound.length}(무음 ${r.sound.filter((s) => s.silent).length})${r.fatal ? ' · 중단: ' + r.fatal : ''}`);
    await context.close();
  }
}
await browser.close();

// 링크 검사: 페이지에 걸린 내부 주소가 모두 열리는지
const linkResults = [];
for (const href of [...links].sort()) {
  const res = await fetch(base + href, { redirect: 'follow' }).catch((e) => ({ status: String(e) }));
  linkResults.push({ href, status: res.status });
}

await writeFile(join(out, 'crawl.json'), JSON.stringify({ base, engine, viewports, at: new Date().toISOString(), results, links: linkResults }, null, 2));

const L = [`# 전체 순회 요약`, '', `- 대상: ${base} (${engine}, ${viewports.join(', ')})`, `- 페이지 ${paths.length}개, 내부 링크 ${linkResults.length}개`, ''];
L.push('| 페이지 | 화면 | 누름(실패) | 콘솔·예외·요청 오류 | 화면 문제 | 재생(무음) |', '|---|---|---|---|---|---|');
for (const r of results) {
  L.push(`| ${r.path} | ${r.viewport} | ${r.clicks.length}(${r.clicks.filter((c) => !c.ok).length}) | ${r.errors.length} | ${r.layout.length} | ${r.sound.length}(${r.sound.filter((s) => s.silent).length}) |${r.fatal ? ' 중단: ' + r.fatal : ''}`);
}
const badLinks = linkResults.filter((l) => l.status !== 200);
L.push('', `## 깨진 내부 링크 (${badLinks.length})`, '', ...badLinks.map((l) => `- ${l.href} → ${l.status}`));
L.push('', '## 상세', '');
for (const r of results) {
  const items = [
    ...r.errors.map((e) => `- [${e.kind}] (${e.step}) ${e.text}`),
    ...r.layout.map((i) => `- [화면:${i.kind}] (카드 ${i.card}) ${i.text}`),
    ...r.clicks.filter((c) => !c.ok).map((c) => `- [누르기 실패] (카드 ${c.card ?? '-'}) "${c.name}": ${c.error}`),
    ...r.sound.filter((s) => s.silent).map((s) => `- [무음] (카드 ${s.card}) "${s.button}" 누른 뒤 RMS ${s.rmsDb} dBFS`),
  ];
  if (items.length) L.push(`### ${r.path} [${r.viewport}]`, '', ...items, '');
}
await writeFile(join(out, 'crawl-summary.md'), L.join('\n'));
console.log(`\n요약: ${join(out, 'crawl-summary.md')}`);
