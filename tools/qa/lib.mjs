// QA 공용 모듈. qa-engineer 에이전트의 순회(crawl.mjs)와 시나리오 스크립트가 같이 쓴다.
// - 브라우저 띄우기(자동재생 허용), 휴대폰·데스크톱 화면 크기
// - 페이지 오류 수집(콘솔 오류, 예외, 실패한 요청)
// - 소리 탭: 출력(destination)으로 가는 신호를 AnalyserNode로 엿들어 크기·대역 에너지를 잰다
// - 화면 깨짐 검사(가로 넘침, 화면 밖으로 나간 요소, 깨진 이미지, 이름 없는 버튼)
// - 보이는 조작 요소를 하나씩 눌러 보기
import { chromium, webkit } from 'playwright';

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { width: 1024, height: 768, hasTouch: true },
};

export async function launch(engine = 'chromium') {
  const type = engine === 'webkit' ? webkit : chromium;
  const args = engine === 'webkit' ? [] : ['--autoplay-policy=no-user-gesture-required'];
  return type.launch({ headless: true, args });
}

// 페이지보다 먼저 실행된다. AudioNode.connect를 감싸서 destination으로 가는 연결을 분석기에도 잇는다.
const INIT_SCRIPT = () => {
  const taps = [];
  window.__qaTaps = taps;
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest);
    try {
      if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
        const ctx = dest.context;
        if (!ctx.__qaTap) {
          const a = ctx.createAnalyser();
          a.fftSize = 4096;
          a.smoothingTimeConstant = 0;
          ctx.__qaTap = a;
          taps.push(a);
        }
        orig.call(this, ctx.__qaTap);
      }
    } catch {}
    return r;
  };
  // 지금 들리는 소리: 전체 RMS(dBFS)와 저·중·고역 에너지(dB). 실시간 컨텍스트만 본다.
  window.__qaSound = () =>
    taps
      .filter((a) => a.context instanceof AudioContext)
      .map((a) => {
        const t = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(t);
        let sum = 0;
        let peak = 0;
        for (const v of t) {
          sum += v * v;
          peak = Math.max(peak, Math.abs(v));
        }
        const f = new Float32Array(a.frequencyBinCount);
        a.getFloatFrequencyData(f);
        const hz = a.context.sampleRate / a.fftSize;
        const band = (lo, hi) => {
          let e = 0;
          for (let i = Math.floor(lo / hz); i < Math.min(f.length, Math.ceil(hi / hz)); i++) e += Math.pow(10, f[i] / 10);
          return e > 0 ? Math.round(10 * Math.log10(e) * 10) / 10 : -Infinity;
        };
        const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);
        return {
          state: a.context.state,
          rmsDb: db(Math.sqrt(sum / t.length)),
          peakDb: db(peak),
          lowDb: band(20, 250),
          midDb: band(250, 4000),
          highDb: band(4000, 16000),
        };
      });
};

/** 오류 수집기를 단 새 페이지. errors 배열에 쌓인다. */
export async function openPage(browser, viewport = 'desktop') {
  const vp = VIEWPORTS[viewport] ?? viewport;
  const { width, height, ...rest } = vp;
  const context = await browser.newContext({ viewport: { width, height }, ...rest, locale: 'ko-KR' });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  const errors = [];
  let step = '페이지 열기';
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push({ kind: 'console', step, text: m.text().slice(0, 500) });
  });
  page.on('pageerror', (e) => errors.push({ kind: 'exception', step, text: String(e).slice(0, 500) }));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push({ kind: 'http', step, text: `${r.status()} ${r.url()}` });
  });
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (!why.includes('ERR_ABORTED')) errors.push({ kind: 'request', step, text: `${why} ${r.url()}` });
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  return {
    page,
    context,
    errors,
    /** 이후 오류에 붙일 '무엇을 하던 중' 표시 */
    setStep: (s) => (step = s),
  };
}

/** 지금 들리는 소리(컨텍스트마다 하나). 소리 탭이 없으면 빈 배열. */
export async function sound(page) {
  return page.evaluate(() => (window.__qaSound ? window.__qaSound() : []));
}

/** 가장 큰 소리를 내는 컨텍스트의 값(없으면 null). ms 동안 여러 번 재서 가장 큰 RMS를 쓴다. */
export async function loudest(page, ms = 600) {
  let best = null;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const s of await sound(page)) if (!best || s.rmsDb > best.rmsDb) best = s;
    await page.waitForTimeout(100);
  }
  return best;
}

/** 화면 깨짐 검사. 문제 목록을 돌려준다. */
export async function layoutIssues(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw > vw + 1) out.push({ kind: 'page-overflow-x', text: `페이지 가로 넘침: 내용 ${sw}px > 화면 ${vw}px` });
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    // 가로 스크롤 상자 안에 있는 요소는 넘쳐도 정상이다(믹서 채널 줄, GEQ 31밴드).
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll' || ox === 'hidden') && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    };
    const label = (el) => {
      const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ');
      const wrap = el.closest('label')?.textContent || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || '';
      return (el.getAttribute('aria-label') || by || el.textContent || wrap || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    };
    let offscreen = 0;
    for (const el of document.querySelectorAll('button, a, input, select, [role=slider], [role=switch], [role=tab], h1, h2, h3, p, img, svg, canvas')) {
      if (!visible(el) || inScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 2 || r.left < -2) && offscreen < 10) {
        offscreen++;
        out.push({ kind: 'offscreen', text: `화면 밖으로 나감: <${el.tagName.toLowerCase()}> "${label(el)}" (left ${Math.round(r.left)}, right ${Math.round(r.right)}, 화면 ${vw})` });
      }
    }
    for (const img of document.querySelectorAll('img')) {
      if (visible(img) && img.complete && img.naturalWidth === 0) out.push({ kind: 'broken-image', text: `깨진 이미지: ${img.src}` });
    }
    for (const el of document.querySelectorAll('button, [role=button], [role=tab], [role=switch], [role=slider], a[href]')) {
      if (visible(el) && !label(el) && !el.querySelector('img[alt]:not([alt=""])')) {
        out.push({ kind: 'no-name', text: `이름 없는 조작 요소: <${el.tagName.toLowerCase()} class="${el.className}">` });
      }
    }
    // 글자가 상자 밖으로 삐져나온 버튼(줄바꿈 없이 잘림)
    for (const el of document.querySelectorAll('button')) {
      if (visible(el) && !inScroller(el) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') {
        out.push({ kind: 'clipped-text', text: `버튼 글자 잘림: "${label(el)}"` });
      }
    }
    return out;
  });
}

// 눌러 볼 요소. 링크는 누르지 않는다(주소 검사는 따로 한다).
const CONTROL_SELECTOR = [
  'button:not([disabled])',
  '[role=button]',
  '[role=tab]',
  '[role=switch]',
  '[role=radio]',
  '[role=checkbox]',
  'summary',
  'input[type=checkbox]',
  'input[type=radio]',
].join(', ');

/**
 * 보이는 조작 요소를 아직 안 누른 것부터 하나씩 누른다. 누를 때마다 새로 생긴 요소도 다시 찾는다.
 * 슬라이더는 최소·최대·가운데로 옮기고, select는 모든 보기를 고른다.
 * skip(label) 이 true면 누르지 않는다(예: 페이지를 떠나는 버튼).
 */
export async function exerciseControls(page, { setStep = () => {}, done = new Set(), max = 200, skip = () => false, afterAction = async () => {} } = {}) {
  const log = [];
  for (let n = 0; n < max; n++) {
    const handles = await page.$$(CONTROL_SELECTOR + ', input[type=range], [role=slider], select');
    let acted = false;
    for (const h of handles) {
      const info = await h
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const shown = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[hidden], .is-off, [aria-hidden=true]');
          const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
          // 같은 이름이 여러 개일 수 있어 DOM 경로를 붙여 구별한다.
          let path = '';
          for (let p = el; p && p !== document.body; p = p.parentElement) path = `${p.tagName}:${Array.prototype.indexOf.call(p.parentElement?.children ?? [], p)}/` + path;
          const kind = el.matches('input[type=range], [role=slider]') ? 'slider' : el.tagName === 'SELECT' ? 'select' : 'click';
          return { shown, name, key: `${kind}|${name}|${path}`, kind };
        })
        .catch(() => null);
      if (!info || !info.shown || done.has(info.key) || skip(info.name)) continue;
      done.add(info.key);
      setStep(`${info.kind === 'click' ? '누르기' : info.kind === 'slider' ? '슬라이더 움직이기' : '보기 고르기'}: "${info.name}"`);
      try {
        if (info.kind === 'click') {
          await h.scrollIntoViewIfNeeded({ timeout: 1000 });
          await h.click({ timeout: 1500 });
        } else if (info.kind === 'slider') {
          await h.scrollIntoViewIfNeeded({ timeout: 1000 });
          await h.focus();
          for (const k of ['End', 'Home', 'PageUp', 'ArrowRight', 'ArrowLeft']) await page.keyboard.press(k);
          await h.evaluate((el) => {
            if (el instanceof HTMLInputElement) {
              const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              for (const v of [el.max || 100, el.min || 0, ((+el.max || 100) + (+el.min || 0)) / 2]) {
                set.call(el, String(v));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          });
        } else {
          const values = await h.evaluate((el) => Array.from(el.options).map((o) => o.value));
          for (const v of values) await h.selectOption(v);
        }
        log.push({ ok: true, ...info });
        await afterAction(info);
      } catch (e) {
        log.push({ ok: false, ...info, error: String(e).split('\n')[0] });
      }
      await page.waitForTimeout(120);
      acted = true;
      break; // 화면이 바뀌었을 수 있으니 요소를 다시 찾는다.
    }
    if (!acted) break;
  }
  return log;
}

/** 볼륨 안내(S08)가 떠 있으면 '재생' 쪽 버튼을 누른다. */
export async function acceptVolumeNotice(page) {
  const btn = page.locator('[role=dialog] .sim-btn.is-primary');
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
