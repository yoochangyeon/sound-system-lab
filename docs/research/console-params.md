# X32·dLive 채널 처리 파라미터 조사

확인일: 2026-10-20. 기종 프로필(`src/consoles/x32/`, `src/consoles/dlive/`)의 범위 근거다.

## 출처와 신뢰도

- dLive: Allen & Heath 공식 도움말(펌웨어 V2.x). 프리앰프 아날로그 게인만 판매처 사양표.
- X32: 공식 사이트의 제품·다운로드 페이지가 404였다. User Manual V5.0(2013-01-03) 판매처 사본은 수치가 거의 없어서, 수치 대부분은 비공식 문서 "Unofficial X32/M32 OSC Remote Protocol"(P-G. Maillot, v4.09)에서 가져왔다. 실기기나 X32-Edit로 확인하기 전까지는 확인 필요로 본다.

| 기호 | 출처 |
|---|---|
| A1 | https://support.allen-heath.com/hc/en-gb/articles/39827102349457-Processing-specs |
| A2 | https://support.allen-heath.com/hc/en-gb/articles/39790636807825-Processing-Screen |
| A3 | https://support.allen-heath.com/hc/en-gb/articles/39827415078033-DEEP-Processing-RackExtra-FX-and-RackUltra-FX |
| A4 | https://support.allen-heath.com/hc/en-gb/articles/39821854915857-Surface-Setup |
| A5 | (판매처) https://www.markertek.com/product/ah-dlive-dm64/allen-heath-ah-dlive-dm64-dlive-s-class-mixrack-64x32-i-o-128x64-fpga-3-option-card-slots-me-1-port-dual-dx-expander |
| B1 | X32 User Manual V5.0 사본: https://shop.ccisolutions.com/StoreFront/jsp/pdf/DAU-84934.pdf |
| B2 | 비공식 OSC 문서: https://www.sites.google.com/site/patrickmaillot/x32 |

## 범위

| 항목 | X32 | dLive |
|---|---|---|
| 아날로그 게인 | −12~+60 dB, 0.5 dB [B2], "72 dB gain range" [B1] | +5~+60 dB, 1 dB, −20 dB 패드 [A5](확인 필요) |
| HPF | 20~400 Hz [B2] | 20 Hz~2 kHz, 12/18/24 dB/oct [A1] |
| 게이트 Threshold | −80~0 dB [B2] | −72~+12 dBu [A1] |
| 게이트 Range/Depth | 3~60 dB [B2] | 0~60 dB [A1] |
| 게이트 Attack/Hold/Release | 0~120 ms / 0.02~2000 ms / 5~4000 ms [B2] | 50 µs~300 ms / 10 ms~5 s / 10 ms~1 s [A1] |
| 컴프 Threshold | −60~0 dB [B2] | −46~+18 dBu [A1] |
| 컴프 Ratio | 1.1~100 단계값 [B2] | 1:1~∞ [A2] |
| Knee / Makeup | 0~5 / 0~24 dB [B2] | 수치 확인 필요 [A2] |
| 컴프 Attack/Release | 0~120 ms / 5~4000 ms [B2] | 확인 필요 |
| 검출기 | PEAK/RMS [B2] | Manual Peak / Manual RMS 등 모델 선택 [A3] |
| 채널 PEQ | 4밴드, 20 Hz~20 kHz, ±15 dB, Q 0.3~10 [B2] | 4밴드, ±15 dB, 20 Hz~20 kHz, 폭 1.5~1/9 옥타브 [A1] |
| GEQ | 31밴드, FX 슬롯 인서트 [B1] | 28밴드, 31 Hz~16 kHz, ±12 dB, Mix 출력 [A1][A2] |
| 페이더·센드 | −∞~+10 dB [B2] | 상한 확인 필요 |

## 화면 흐름

- X32 [B1]: 채널 Select → 채널 스트립 섹션(Config/Preamp, Gate·Dynamics, EQ, Bus Sends·Main)이 그 채널을 따른다. View 버튼으로 화면 탭(home/config/gate/dyn/eq/sends/main). 센드는 Bus Sends 노브, 또는 "Sends on Faders".
- dLive [A2][A4]: 채널 Sel → 처리 화면 탭(Preamp, Filter, Gate, Inserts, PEQ, Compressor, Delay). Mix 채널에는 NEQ 탭. 센드는 Mix 키로 "Sends on Faders", 또는 Routing 화면.

## 시뮬레이터에서 단순화한 것

- dBu 단위 임계값은 화면 표시만 dBu로 바꾸고, 내부 값은 dBFS로 둔다(0 dBFS = +18 dBu로 가정, 확인 필요).
- dLive GEQ는 28밴드지만, 엔진·미션을 공유하려고 31밴드 엔진에서 31 Hz~16 kHz 28개 밴드만 화면에 보인다.

---

# X32 기본 기능 조사 (4차 확장 근거)

확인일: 2026-10-20. 4차 확장(PRD 3장 "4차 확장")에서 레슨과 쉬운 믹서가 다룰 개념의 이름·범위 근거다. 쉬운 믹서는 이 기종을 재현하지 않는다. 레슨에서 "X32 계열에서는"이라고 쓸 때만 이 표를 인용한다.

## 출처

| 기호 | 문서 | 비고 |
|---|---|---|
| B1 | X32 User Manual V5.0(2013-01-03) 판매처 사본 https://shop.ccisolutions.com/StoreFront/jsp/pdf/DAU-84934.pdf | 머리말이 "Preliminary". FW 1.x라 게이트 모드·컴프 Mix·스니펫·오토믹스가 없다 |
| B2 | 비공식 "X32/M32 OSC Remote Protocol" v4.09-02(2025-11-30, FW 4.0 이상) https://www.sites.google.com/site/patrickmaillot/x32 | 수치 대부분의 근거. 비공식이다 |
| B3 | X32 COMPACT User Manual 사본(FW 2.x 이후 판) https://www.adorama.com/col/productManuals/BEX32COMPACT.pdf | 효과 목록·Safe 화면 |

공식 최신(FW 4.x) 매뉴얼과 X32-Edit 화면은 찾지 못했다. 아래 '확인 필요'는 실기기나 공식 문서로 다시 본다.

## 채널 처리

| 항목 | X32 표기 | 범위·옵션 | 출처 |
|---|---|---|---|
| 극성 | 매뉴얼은 phase(위상 반전), OSC는 invert | 켜기/끄기. 화면 아이콘은 확인 필요 | B1 p.12, B2 |
| 채널 딜레이 | Delay("에코 효과가 아니다") | 0.3~500 ms | B1 p.43, B2 |
| 스테레오 링크 | Link | 이웃 홀짝 채널(1-2…). 링크할 항목(Delay+HA, EQ, Dynamics, Mute/Fader)을 Setup에서 고른다 | B1, B2 |
| 게이트 모드 | EXP2, EXP3, EXP4, GATE, DUCK | EXP는 1:2~1:4 익스팬더, DUCK은 키가 크면 줄이는 덕커로 보인다(뜻은 확인 필요) | B2 |
| 키 소스 | Key Source | 자기 채널(OFF), 다른 입력·Aux·FX 리턴·버스 | B1 p.43, B2 |
| 키 필터 | Key Filter | LC6·LC12·HC6·HC12와 대역 통과(1.0~10.0, Q로 추정), 20 Hz~20 kHz. 키를 솔로로 듣는 기능 | B2, B1 p.43 |
| 컴프 모드 | COMP / EXP | — | B1 p.44, B2 |
| 컴프 레이시오 | Ratio | 1.1~100, 12단계 | B2 |
| 니 | Knee | 0~5(다섯 단계) | B1, B2 |
| 병렬 압축 | Mix | 0~100 % | B2(B1에는 없음) |
| 그 밖의 컴프 | Env LIN/LOG, Det PEAK/RMS, Auto(시간 자동), 위치 EQ 앞/뒤 | — | B2, B1 p.44 |
| EQ 종류 | LCut, LShv, PEQ, VEQ, HShv, HCut | 채널 4밴드, 버스·메인·매트릭스 6밴드 | B2, B1 p.45 |
| 인서트 | Insert(PRE/POST) | FX 1~8, Aux로 끼운다. 정확한 지점은 확인 필요 | B2, B1 p.42 |

## 버스와 센드

| 항목 | X32 | 출처 |
|---|---|---|
| 믹스 버스 | 16개. 버스로 쓸지 그룹으로 쓸지 나눠 쓴다. 홀짝 짝으로 스테레오 링크 | B1 p.29, B2 |
| 센드 탭 | IN/LC, ←EQ, EQ→, PRE, POST, GRP(매뉴얼 표기 Pre-EQ, Post-EQ, Pre-Fader, Post-Fader, Sub-Group) | B2, B1 p.45 |
| 메인 | Main LR + Mono/Center(M/C). 팬 모드 LR+M 또는 LCR | B1, B2 |
| 매트릭스 | 6개. 메인 LRC와 믹스 버스만 보낼 수 있고 입력 채널은 못 보낸다 | B1 p.11, B3 |
| 버스·메인·매트릭스 처리 | 인서트, 6밴드 EQ, 컴프. 게이트는 입력 채널에만 | B1 p.11, B2 |

## 이펙트

| 항목 | X32 | 출처 |
|---|---|---|
| FX 슬롯 | 8개(스테레오). 1~4는 센드·인서트 둘 다, 5~8은 인서트 전용 | B1 p.11, B2 |
| FX 리턴 | FX 1~4의 출력이 리턴 채널 FX 1L~4R로 돌아온다. 기본값은 Bus 13~16이 FX 1~4로 가는 센드 | B1 p.26-27 |
| 리버브 | Hall, Ambiance, Rich Plate, Room, Chamber, Plate, Vintage Reverb, Vintage Room, Gated, Reverse | B2 부록 |
| 딜레이 | Stereo Delay, 3-Tap Delay, Rhythm Delay | B2 부록 |
| 모듈레이션 | Chorus, Flanger, Phaser, Dimension-C, Rotary, Tremolo 등 | B2 부록 |
| 다이내믹스·EQ | DeEsser, Precision Limiter, 컴프 계열, GEQ·TrueEQ | B2 부록 |
| 리버브 손잡이 | Pre Delay 0~200 ms, Decay, Size, Damping, Lo/Hi Cut | B2 p.88 |
| 딜레이 손잡이 | Time 1~3000 ms, Factor(1/4~3), Feedback, Lo/Hi Cut | B2 p.90 |
| 탭 템포 | 콘솔 기능으로는 찾지 못했다(확인 필요) | — |

## 운용

| 항목 | X32 | 출처 |
|---|---|---|
| DCA | 8개. 솔로·뮤트는 되고 선택은 안 된다 | B1 p.9, B2 |
| 뮤트 그룹 | 6개 | B1 p.29 |
| 솔로 | 채널·버스·DCA마다 PFL/AFL. Exclusive, Clear Solo | B1 p.28, B2 |
| 토크백 | A/B 두 경로, 내장·외장 마이크, 목적지 여러 개 | B1 p.28, B2 |
| 오실레이터 | Sine, Pink, White. 목적지는 버스·메인·매트릭스 하나 | B1 p.59, B2 |
| 씬 | 100개. Safe로 고른 항목은 씬을 불러와도 바뀌지 않는다 | B2 p.44, B3 |
| 스니펫 | 100개. 고른 항목만 저장·호출(FW 2부터) | B2, B3 |
| 오토믹스 | 채널 1~8, 그룹 X/Y, 채널별 Weight(Dugan식). 도입 펌웨어는 확인 필요 | B2 |
| USB 녹음 | 스테레오 녹음·재생(재생은 Aux 7/8로) | B1 p.60 |
| 입출력 패치 | 로컬, AES50 A/B, 카드, User In/Out(FW 4.0) | B1 p.6, B2 |

## 쉬운 믹서에서 단순화한 것(4차)

- 버스 수: 모니터 2, 그룹 2, FX 2(리버브·딜레이), 매트릭스 1. 실제 16 버스·8 FX를 다 두지 않는다.
- DCA 4개, 뮤트 그룹 4개(X32는 8, 6).
- 센드 탭: EQ 앞, 페이더 앞, 페이더 뒤 세 곳만.
- 키 필터: 로우컷·하이컷·대역 통과 세 종류(기울기·Q 선택 없음).
- 리버브는 코드로 만든 잔향(감쇠 노이즈)을 쓴다. 기종의 알고리즘 이름을 흉내 내지 않는다.
