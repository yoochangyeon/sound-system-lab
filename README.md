# 음향 시스템 랩

교회 방송실 봉사자가 디지털 믹서의 처리 기능(게인, EQ, 컴프레서, 게이트, GEQ)을 브라우저에서 직접 만지고 들으며 배우는 무료 학습 사이트.

- 1장 기초 레슨 5편 → 2장 처리기 레슨 5편(위젯) → 3장 콘솔 레슨 → 실습실(X32 스타일·dLive 스타일 콘솔, 미션 4종)
- 모든 소리는 브라우저 안(Web Audio, AudioWorklet)에서 처리한다. 서버·로그인 없음.

```bash
npm install
npx playwright install chromium webkit   # 브라우저 테스트용, 처음 한 번
npm run dev        # http://localhost:4321
npm test           # unit(Node) + browser(Chromium·WebKit)
npm run build
```

| 문서 | 내용 |
|---|---|
| [docs/prd.md](docs/prd.md) | 서비스 기획서(대상, 범위, 화면, 미션, 디자인) |
| [CLAUDE.md](CLAUDE.md) | 구조와 작업 규칙, 배포 |
| [docs/research/console-params.md](docs/research/console-params.md) | X32·dLive 파라미터 조사 근거 |
| [public/audio/SOURCES.md](public/audio/SOURCES.md) | 음원 출처와 라이선스 |
