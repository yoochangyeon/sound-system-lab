// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://sound-system-lab.vercel.app';

const redirects = {
  // 2차 개편(#36): 기종별 콘솔(X32·dLive 스타일)을 쉬운 믹서 하나로 합쳤다.
  '/lab/x32': '/lab/',
  '/lab/dlive': '/lab/',
  // #40: 2장에 EQ 기초 레슨을 넣어 번호가 한 칸씩 밀렸다.
  '/lessons/02-processing/02-peq-hpf': '/lessons/02-processing/03-peq-hpf/',
  '/lessons/02-processing/03-geq-feedback': '/lessons/02-processing/04-geq-feedback/',
  '/lessons/02-processing/04-compressor': '/lessons/02-processing/05-compressor/',
  '/lessons/02-processing/05-gate': '/lessons/02-processing/06-gate/',
};
// 옮겨 간 옛 주소는 sitemap에 넣지 않는다.
const redirectPages = new Set(Object.keys(redirects).map((from) => `${SITE}${from}/`));

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [react(), mdx(), sitemap({ filter: (page) => !redirectPages.has(page) })],
  // 레슨 아래 고정 버튼과 겹쳐서 끈다.
  devToolbar: { enabled: false },
  redirects,
});
