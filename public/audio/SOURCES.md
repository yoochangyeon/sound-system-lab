# 음원 출처

사이트 출처 페이지(`/credits/`)와 같은 내용이다. 음원을 바꾸면 두 곳을 같이 고친다.

## 밴드 스템

| 항목 | 내용 |
|---|---|
| 곡명 | Forget It - Demo |
| 만든 사람 | Tom Ray (ccMixter 사용자 tmray) |
| 출처 | https://ccmixter.org/files/tmray/40208 |
| 라이선스 | Creative Commons Attribution 3.0 (CC BY 3.0), https://creativecommons.org/licenses/by/3.0/ |
| 라이선스 확인 | 2026-10-20, ccMixter API(`/api/query?f=json&ids=40208`)의 `license_name: Attribution (3.0)`와 곡 페이지 표기 |
| 원본 | FLAC 스템 12개(44.1 kHz, 스테레오, 3분 13초, 80 BPM) |
| 바꾼 점 | 60~108초(16마디)를 잘라 모노로 합치고, 양 끝에 10 ms 페이드를 넣고, AAC 96 kbps(m4a)로 인코딩했다. 이 구간에서 소리가 없는 sax 스템은 뺐다 |

| 파일 | 원본 스템 이름 | 사이트 표기 |
|---|---|---|
| `band/vocals.m4a` | vocals | 보컬 |
| `band/drums.m4a` | drums | 드럼 |
| `band/percussion.m4a` | drums-2 | 퍼커션 |
| `band/shaker.m4a` | shaker | 셰이커 |
| `band/bass.m4a` | bass | 베이스 |
| `band/guitar-main.m4a` | guitar-main | 일렉 기타 |
| `band/guitar-verse.m4a` | guitar-verse | 기타(벌스) |
| `band/guitar-plucks.m4a` | guitar-plucks | 기타(피킹) |
| `band/sax-guitar.m4a` | sax/guitar | 색소폰·기타 |
| `band/organ.m4a` | organ | 오르간 |
| `band/keys.m4a` | car-keys | 건반 |

형식 메모: AAC(m4a)는 Chrome·Edge·Safari와 macOS·Windows의 Firefox에서 `decodeAudioData`로 디코딩된다. 리눅스 Firefox는 시스템 코덱에 따라 안 될 수 있다(확인 필요).

## 설교

운영자가 직접 녹음한 한국어 설교 낭독이 들어올 예정이다(#5). 그때까지 설교 채널은 보컬 음원을 임시로 쓴다.
