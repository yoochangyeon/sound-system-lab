#!/usr/bin/env node
// 조작 재생기: 정해 둔 조작을 차례로 하고, 중간중간 화면·글·소리를 남긴다.
// 브라우저 상태는 실행마다 새로 시작하므로, 이어서 해 보려면 앞 조작에 새 조작을 붙여 다시 돌린다.
// 수강생 리뷰어가 퀴즈를 직접 풀거나 위젯·미션을 만져 볼 때, QA가 재현 절차를 남길 때 쓴다.
//
//   node tools/qa/play.mjs --out <폴더> [--base http://127.0.0.1:4329] [--viewport mobile] --steps steps.json
//   node tools/qa/play.mjs --out <폴더> --steps '[{"goto":"/lab/?mission=howl"},{"shot":"start"}]'
//
// 조작 종류(한 줄에 하나):
//   {"goto": "/lessons/…/#3"}             주소 열기(앞에 base가 붙는다)
//   {"click": "보이는 글자"}               그 글자를 가진 버튼·링크·탭·스위치를 누른다. "css:선택자"로도 된다
//   {"slider": "이름", "value": 120}       aria-label이나 둘레 글자에 '이름'이 들어간 가로 슬라이더를 그 값으로
//   {"key": "ArrowRight"}                  키 누르기
//   {"next": 2}                            레슨 '다음' 버튼을 n번
//   {"volume": true}                       볼륨 안내가 떠 있으면 '재생' 쪽을 누른다
//   {"wait": 500}                          기다리기(ms)
//   {"shot": "이름"}                       화면 저장 → <out>/이름.png (지금 화면 전체)
//   {"text": "이름"}                       보이는 글 저장 → <out>/이름.txt
//   {"sound": "이름", "ms": 1500}          지금 나는 소리 재기(rmsDb, peakDb, lowDb, midDb, highDb)
//
// 결과: <out>/play-log.json, 표준 출력에 한 줄씩
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { acceptVolumeNotice, launch, loudest, openPage } from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const base = String(args.base ?? 'http://127.0.0.1:4329').replace(/\/$/, '');
const out = String(args.out ?? 'qa-reports/play');
const raw = String(args.steps ?? '[]');
const steps = JSON.parse(raw.trim().startsWith('[') ? raw : await readFile(raw, 'utf8'));
await mkdir(out, { recursive: true });

const CLICKABLE = ':is(button, a, [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox], summary, label):visible';
// innerText는 숨은 요소(다른 카드, 접힌 패널)를 빼고 화면에 보이는 글만 준다.
const visibleText = () => document.body.innerText;

const browser = await launch(String(args.engine ?? 'chromium'));
const { page, errors, setStep } = await openPage(browser, String(args.viewport ?? 'mobile'));
const log = [];
for (const [i, s] of steps.entries()) {
  const name = JSON.stringify(s);
  setStep(`${i + 1}. ${name}`);
  const entry = { i: i + 1, step: s, ok: true };
  try {
    if (s.goto) await page.goto(base + s.goto, { waitUntil: 'networkidle' });
    else if (s.click) {
      const loc = s.click.startsWith('css:') ? page.locator(s.click.slice(4)).first() : page.locator(CLICKABLE, { hasText: s.click }).first();
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      await loc.click({ timeout: 3000 });
      await page.waitForTimeout(200);
    } else if (s.slider) {
      const ok = await page.evaluate(
        ({ label, value }) => {
          const all = Array.from(document.querySelectorAll('input[type=range]')).filter((el) => el.getBoundingClientRect().width > 0);
          const hit = all.find((el) => {
            const around = (el.getAttribute('aria-label') || '') + ' ' + (el.closest('label, .sim-slider, div')?.textContent || '');
            return around.includes(label);
          });
          if (!hit) return false;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(hit, String(value));
          hit.dispatchEvent(new Event('input', { bubbles: true }));
          hit.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        },
        { label: s.slider, value: s.value },
      );
      if (!ok) throw new Error(`슬라이더 "${s.slider}"를 찾지 못함`);
      await page.waitForTimeout(200);
    } else if (s.key) await page.keyboard.press(s.key);
    else if (s.next) {
      for (let k = 0; k < s.next; k++) {
        await page.locator('[data-next]').click();
        await page.waitForTimeout(250);
      }
    } else if (s.volume) {
      await page.waitForTimeout(200);
      await acceptVolumeNotice(page);
    } else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.shot) {
      await page.screenshot({ path: join(out, `${s.shot}.png`), fullPage: false });
      entry.file = `${s.shot}.png`;
    } else if (s.text) {
      await writeFile(join(out, `${s.text}.txt`), await page.evaluate(visibleText));
      entry.file = `${s.text}.txt`;
    } else if (s.sound) {
      entry.sound = await loudest(page, s.ms ?? 1500);
    }
  } catch (e) {
    entry.ok = false;
    entry.error = String(e).split('\n')[0];
  }
  log.push(entry);
  console.log(`${entry.ok ? '✓' : '✗'} ${entry.i}. ${name}${entry.sound ? ' → ' + JSON.stringify(entry.sound) : ''}${entry.error ? ' → ' + entry.error : ''}`);
  if (!entry.ok && !args['keep-going']) break;
}
if (errors.length) console.log('페이지 오류:\n' + errors.map((e) => `- [${e.kind}] (${e.step}) ${e.text}`).join('\n'));
await writeFile(join(out, 'play-log.json'), JSON.stringify({ log, errors }, null, 2));
await browser.close();
