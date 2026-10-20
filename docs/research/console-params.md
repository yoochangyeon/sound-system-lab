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
