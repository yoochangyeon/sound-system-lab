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

| 항목 | 내용 |
|---|---|
| 파일 | `sermon.m4a` |
| 내용 | John Wesley, "Salvation by Faith" (Sermons on Several Occasions, First Series 01) |
| 낭독 | Robert G. Smith (LibriVox) |
| 출처 | https://librivox.org/sermons-on-several-occasions-first-series-by-john-wesley/ , 원본 https://www.archive.org/download/sermonsfirstseries_1307_librivox/sermonsfirstseries_01_wesley_64kb.mp3 |
| 라이선스 | 퍼블릭 도메인. LibriVox 저작권 안내: "you may do whatever you like with our recordings" (https://librivox.org/pages/public-domain/). LibriVox는 미국 기준이며 다른 나라는 각국 저작권을 확인하라고 권한다 |
| 확인 | 2026-10-20 |
| 바꾼 점 | 120~168초(48초)를 잘라 모노로 합치고, 양 끝 10 ms 페이드, AAC 96 kbps(m4a) |

영어 낭독이다(기획서는 한국어 설교). 운영자의 한국어 녹음(#5)이 들어오면 이 파일을 바꾼다.
