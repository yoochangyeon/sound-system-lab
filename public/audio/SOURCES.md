# 음원 출처

사이트 출처 페이지(`/credits/`)는 곡 매니페스트(`src/audio/library/songs/`)에서 만든다. 곡을 바꾸면 두 곳을 같이 고친다. 곡 추가 방법은 `docs/audio-pipeline.md`.

## Actions — "Devil's Words"

| 항목 | 내용 |
|---|---|
| 출처 | Cambridge-MT 'Mixing Secrets' Free Multitrack Download Library, https://cambridge-mt.com/ms3/mtk/ |
| 원본 | 27트랙 WAV 24-bit/44.1 kHz, 190 BPM, 원곡 믹스 `DevilsWords_Full_Preview.mp3` |
| 이용 조건 | 원본 Readme: "provided for educational purposes only", 저작권자의 명시적 허락 없는 상업적 이용 금지. 자세한 조건은 https://cambridge-mt.com/ms3/mtk-faq/ |
| 확인 | 2026-10-20. FAQ 원문은 사이트 보안 확인 페이지 때문에 열지 못했다. 공개 웹에서 들려주는 것이 허용되는지 **확인 필요** |
| 바꾼 점 | 102.5~142.9초(합창 한 마디 앞부터 32마디)를 잘라 모노로 합치고, 여러 트랙은 한 소스로 더함. 양 끝 5 ms 페이드, AAC 96 kbps. 원곡 믹스는 같은 구간(146 ms 보정)을 스테레오 160 kbps로 |

| 파일 | 원본 트랙 |
|---|---|
| `songs/actions-devils-words/lead-vocal.m4a` | 18_LeadVox |
| `.../lead-double.m4a` | 19_LeadVoxDT |
| `.../backing-vocals.m4a` | 20~27 BackingVox 1~8 합침(−6.1 dB) |
| `.../kick.m4a` | 01_KickTrigger |
| `.../snare.m4a` | 02_Snare |
| `.../toms.m4a` | 04_Tom1 + 05_Tom2 |
| `.../overheads.m4a` | 03_Overheads(스테레오→모노) |
| `.../tambourine.m4a` | 06_Tambourine(스테레오→모노, −3.0 dB) |
| `.../bass.m4a` | 10_Bass |
| `.../guitar.m4a` | 13~17 ElecGtr 합침(−3.3 dB) |
| `.../reference.m4a` | 원곡 믹스 같은 구간 |

쓰지 않은 원본: 07_Loop, 08_DrumsReverb, 09_ReverseCymbal(이 구간에서 소리가 없거나 효과음), 11·12 ElecGtr(이 구간에서 소리 없음).

## 이전 음원(삭제, 2026-10-20)

ccMixter tmray "Forget It - Demo"(CC BY 3.0) 스템과 LibriVox 설교 낭독(퍼블릭 도메인)은 3차 개편에서 뺐다.
