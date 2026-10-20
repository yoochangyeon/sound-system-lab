// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],
  // 레슨 아래 고정 버튼과 겹쳐서 끈다.
  devToolbar: { enabled: false },
});
