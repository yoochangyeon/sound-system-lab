// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],
  // 레슨 아래 고정 버튼과 겹쳐서 끈다.
  devToolbar: { enabled: false },
  // 2차 개편(#36): 기종별 콘솔(X32·dLive 스타일)을 쉬운 믹서 하나로 합쳤다.
  redirects: {
    '/lab/x32': '/lab/',
    '/lab/dlive': '/lab/',
  },
});
