import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// 두 경계를 나눠 돌린다.
// - unit: Node. DSP 순수 함수(②), 믹서 상태·미션 판정(①). 파일명 *.test.ts
// - browser: Chromium. OfflineAudioContext로 실제 그래프·워클릿(③). 파일명 *.browser.test.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
