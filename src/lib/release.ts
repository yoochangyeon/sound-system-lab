// 공개 전 '준비 중' 모드. Vercel 프로덕션 빌드(VERCEL_ENV=production)에서만 켜진다.
// 프리뷰·로컬 빌드는 전체 사이트를 만든다. 값은 astro.config.mjs의 vite.define이 빌드 때 넣는다.
// 공개(#23) 때 astro.config.mjs의 조건을 걷어 낸다.
declare const __COMING_SOON__: boolean;

export const COMING_SOON: boolean = typeof __COMING_SOON__ !== 'undefined' && __COMING_SOON__;

export const SITE_NAME = '음향 시스템 랩';
