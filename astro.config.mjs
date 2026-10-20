// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// 공개 전(#2): Vercel 프로덕션 빌드에서만 '준비 중' 페이지를 낸다. 공개(#23) 때 이 조건을 지운다.
const env = /** @type {Record<string, string | undefined>} */ (/** @type {any} */ (globalThis).process.env);
const comingSoon = env.VERCEL_ENV === 'production' || env.FORCE_COMING_SOON === '1';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],
  vite: {
    define: { __COMING_SOON__: JSON.stringify(comingSoon) },
  },
});
