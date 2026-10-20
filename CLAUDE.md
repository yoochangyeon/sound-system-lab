# CLAUDE.md

음향 시스템 학습 사이트. 기초 이론은 그림 위주의 카드로 짧게, 디지털 믹서의 처리 기능(PEQ·GEQ·컴프레서·게이트 등)은 화면에서 직접 만지고 소리 변화를 들으며 배운다. 마지막에 8채널 '쉬운 믹서'에서 현장 문제(미션)를 푼다.

완전 무료 학습 사이트다. 로그인·진도 저장·결제는 만들지 않는다.

## 대상과 문체

- 대상은 교회 방송실 봉사자처럼 음향을 전공하지 않고 현장에서 일하는 사람이다. 이론보다 "주일 예배에서 이 소리가 나면 무엇을 만지나"처럼 현장 상황에서 출발한다.
- 용어는 처음 나올 때 한 줄로 풀어 쓴다.
- 문서는 '~한다' 체로 쓴다.
- 강의 원고는 휴대폰에서도 읽히게, 쉬운 믹서는 휴대폰에서도 열리되 가로 태블릿 이상을 권장한다.
- 화면은 토스처럼 밝고 친근하게 만든다(흰 바탕, Pretendard, 둥근 카드, 파란 강조). 토큰은 `src/styles/tokens.css`.
- 레슨은 카드형이다. 원고의 `---`(앞뒤 빈 줄)로 카드를 나누고, 카드 하나에 개념 하나, 글은 2~3줄 안쪽으로 쓴다. 설명은 `src/components/lesson/`의 그림 컴포넌트(신호 흐름도, 주파수 지도, 비교 카드, O/X 퀴즈 등)를 먼저 쓴다.

## 스택

| 계층 | 선택 | 비고 |
|---|---|---|
| 사이트 | Astro 7 정적 빌드 + MDX | 서버 없음. Node 22.22 이상 |
| 인터랙티브 UI | React 아일랜드 | 조작은 가로 슬라이더·스위치(노브 없음), 채널 페이더는 SVG, 매 프레임 바뀌는 RTA·미터는 Canvas |
| 믹서 상태 | Zustand | 채널×파라미터를 React 밖 저장소 하나에 두고 UI와 오디오 엔진이 같이 구독한다 |
| 신호 처리 | Web Audio API + AudioWorklet(TS) | 성능이 모자라다고 측정되면 그 처리기만 WASM으로 옮긴다 |
| 테스트 | Vitest + 브라우저 모드(Playwright Chromium·WebKit) | unit(Node): DSP 순수 함수·믹서 상태·미션 판정. browser: OfflineAudioContext로 실제 그래프·워클릿 |

진도·설정처럼 사용자별로 남길 값이 생기면 `localStorage`로만 처리한다.

## 폴더

| 경로 | 내용 |
|---|---|
| `docs/prd.md` | 서비스 기획서(대상, 범위, 화면, 미션, 디자인 가이드). 기획이 바뀌면 이 문서를 먼저 고치고 개발 스펙(GitHub 이슈)을 맞춘다 |
| `docs/agents/` | supermatt 스킬 설정(이슈 트래커, 라벨, 외부 피어) |
| `src/content/lessons/<장>/` | 강의 원고(MDX). 장: `01-basics`, `02-processing`, `03-consoles`. 스키마는 `src/content.config.ts` |
| `src/audio/` | 오디오 엔진(프레임워크 무관 TS). UI 코드를 넣지 않는다 |
| `src/audio/dsp/` | 샘플 단위 처리 순수 함수(검출기, 게인 계산 등). Web Audio에 의존하지 않아 Vitest로 바로 검사한다 |
| `src/audio/worklets/` | `dsp/` 함수를 감싼 `AudioWorkletProcessor` |
| `src/stores/` | Zustand 저장소 |
| `src/components/lesson/` | 레슨 카드용 그림 컴포넌트(Astro)와 O/X 퀴즈·클리핑 체험(React) |
| `src/components/sim/` | 처리기 하나씩 만지는 React 위젯(PEQ, GEQ, Comp, Gate…). MDX에서 `client:only="react"`로 불러 쓴다 |
| `src/mixer/` | 실습실 쉬운 믹서(8채널, 모니터 2, 메인)와 미션 카드. `audio/` 엔진과 `stores/` 저장소를 쓴다 |
| `src/missions/` | 미션 데이터(시작 상태, 판정, 힌트, 해설) |
| `src/quizzes/` | 레슨별 실전 시나리오 퀴즈 데이터(쉬움·보통·어려움 방탈출형). 원고에서 `<CaseQuiz client:load id="..." />`로 부른다. 레슨 원고의 사실·수치를 벗어나지 않는다 |
| `public/audio/songs/<곡 id>/` | 실습 곡의 소스(역할별 m4a)와 정답 믹스(`reference.m4a`) |
| `src/audio/library/` | 음원 라이브러리: 곡 매니페스트(소스·역할·구간·출처·믹서 배치). 곡 추가는 `docs/audio-pipeline.md` |
| `tools/make-song.py`, `tools/songs/` | 멀티트랙에서 곡 소스를 만드는 도구와 곡별 설정(구간·묶음) |

파일·폴더 이름은 영문 소문자와 하이픈(kebab-case)으로 짓는다. 한글 파일명은 쓰지 않는다. 내용(본문·제목)은 한국어로 쓴다.

## 오디오 엔진 원칙

- AudioContext는 `src/audio/context.ts`의 `getAudioContext()` 하나만 쓰고, 사용자 클릭 뒤에 처음 만든다(자동재생 정책).
- 파라미터 변경은 `setTargetAtTime` 등으로 램프해 지퍼 노이즈를 막는다.
- PEQ·GEQ는 `BiquadFilterNode`(GEQ는 31밴드 peaking)로 만든다.
- 다이내믹스(컴프레서·게이트·익스팬더·리미터·디에서)는 `DynamicsCompressorNode`를 쓰지 않고 AudioWorklet으로 직접 만든다. 내장 노드로는 사이드체인, Peak/RMS 검출, 홀드 같은 콘솔 기본 기능을 보여줄 수 없다.
- 그래프(주파수 응답, GR 미터)는 엔진이 숫자를 내주고 UI가 그린다.

## 실제 기기 표기 규칙

- 쉬운 믹서는 실제 기종을 재현하지 않는다(2차 개편, 2026-10-20). 실제 기기 UI·제조사 스크린샷·로고를 쓰지 않는다.
- 레슨에서 실제 콘솔 이야기를 할 때 기기명은 "X32 계열"처럼 설명 목적으로만 쓰고, 확인한 매뉴얼·날짜를 원고 주석에 남긴다(조사 기록은 `docs/research/console-params.md`).

## 음원

- 저작권과 이용 조건이 확인된 음원만 `public/audio/`에 넣고, 출처와 조건을 곡 매니페스트와 `public/audio/SOURCES.md`에 적는다.
- 실습 음원은 곡 단위다. 위젯·미션은 곡이 아니라 소스의 **역할**(리드 보컬, 스네어 등)로 소스를 찾으므로, 곡을 추가해도 코드를 고치지 않는다.
- 지금 곡은 Cambridge-MT의 Actions "Devil's Words"(무료·교육용·비상업, FAQ상 비영리 수업·시연 가능, 2026-10-20 확인). 그래서 사이트에 광고나 유료 기능을 넣지 않는다. 링크는 ZIP이 아니라 라이브러리 항목으로 건다.

## 명령

```bash
npm run dev      # http://localhost:4321
npm run build    # dist/ 정적 빌드
npx astro check  # 타입 검사
npm test         # Vitest 전체(unit + browser)
npm run test:unit     # Node 테스트만(*.test.ts)
npm run test:browser  # Chromium·WebKit 엔진 테스트만(*.browser.test.ts). 처음 한 번 npx playwright install chromium webkit
```

개발 서버는 `npx astro dev --background`로 띄우고 `npx astro dev stop`으로 끈다. 화면 확인은 Aside에서 `http://localhost:4321`을 바로 연다.

- Astro 문서: https://docs.astro.build

## 배포

- 공개 주소: https://unmute-please.vercel.app (2026-10-20 사이트 이름 변경, #47). 옛 주소 `sound-system-lab.vercel.app`은 프로젝트 도메인으로 남아 같은 내용을 200으로 연다. `vercel.json`에 호스트 리다이렉트(301)가 있지만 2026-10-20 배포에서 동작하지 않았고, 사용자가 리다이렉트는 없어도 된다고 정했다. 주소를 바꾸면 `astro.config.mjs`의 `SITE`와 `public/robots.txt`도 같이 고친다.
- Vercel 프로젝트: https://vercel.com/changyeon1/sound-system-lab (팀 changyeon1). Git 연동 없이 CLI로 직접 배포한다. 빌드 설정은 `vercel.json`(Astro, `dist`)이 정한다.
- 2026-10-20 공개(#23). 배포 명령(저장소 루트에서):
  `/Users/a-/Repository/claude-course/tools/env/node_modules/.bin/vercel deploy --prod --yes --scope changyeon1`
- 레슨 파일을 새로 만들거나 이름을 바꾼 배포는 `--force`를 붙인다. Vercel이 되살린 빌드 캐시의 콘텐츠 저장소가 옛 레슨 목록을 들고 있어 새 레슨이 404가 된 적이 있다(2026-10-20, #40).
- 확인용 프리뷰는 `--prod` 없이 배포한다. 프리뷰는 Vercel 인증으로 보호된다(비로그인 302). 내용 확인은 `vercel curl / --deployment <프리뷰 URL> --scope changyeon1`.
- `vercel link`가 만드는 `.env.local`(단기 토큰)은 지운다. 로그인이 풀렸으면 사용자에게 `cd /Users/a-/Repository/claude-course/tools/env && npx vercel login`을 부탁한다.
- 배포 뒤 공개 주소에서 페이지가 200으로 열리는지, `/.env.local`·`/CLAUDE.md`가 404인지, 옛 주소도 200으로 열리는지 확인한다.

## Agent skills

### Issue tracker

GitHub Issues(`yoochangyeon/sound-system-lab`)에 둔다. `docs/agents/issue-tracker.md` 참고.

### Triage labels

기본 라벨 7개를 이름 그대로 쓴다. `docs/agents/triage-labels.md` 참고.

### Domain docs

single-context: 루트 `GLOSSARY.md` 하나, ADR은 첫 결정이 생기면 `docs/adr/`에 둔다. `docs/agents/domain.md` 참고.

### External peers

host-only: code-review·jury가 외부 CLI(Claude·Codex 등)를 부르지 않는다. `docs/agents/cross-model.json` 참고.
