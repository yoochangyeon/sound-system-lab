// Actions "Devil's Words" 멀티트랙(Cambridge-MT 'Mixing Secrets' 무료 멀티트랙 라이브러리).
// 원본: 27트랙 24-bit/44.1 kHz, 190 BPM. 합창 한 마디 앞 다운비트(102.527초)부터 32마디(128박, 40.421초)를 잘라
// 10개 소스로 묶었다. 원곡 믹스(미리듣기 MP3)는 스템보다 146 ms 앞서 있어 그만큼 당겨 같은 구간을 잘랐다.
// 피크·RMS는 자르고 묶은 PCM에서 계산했다(2026-10-20). 만든 방법: tools/make-song.py + tools/songs/actions-devils-words.json (docs/audio-pipeline.md)
import type { Song } from '../types';

const DIR = '/audio/songs/actions-devils-words';

export const ACTIONS_DEVILS_WORDS: Song = {
  id: 'actions-devils-words',
  title: "Devil's Words",
  artist: 'Actions',
  genre: '록',
  bpm: 190,
  loopSeconds: 40.421,
  excerpt: { fromSec: 102.527, toSec: 142.948, bars: 32, note: '합창 한 마디 앞부터 32마디' },
  source: { name: "Cambridge-MT 'Mixing Secrets' Free Multitrack Download Library", url: 'https://cambridge-mt.com/ms3/mtk/' },
  terms: {
    summary: '교육 목적으로만 제공. 저작권자의 명시적 허락 없이 상업적으로 쓸 수 없다(원본 Readme).',
    url: 'https://cambridge-mt.com/ms3/mtk-faq/',
    checked: '2026-10-20',
    caution: '공개 웹사이트에서 소스를 들려주는 것이 허용되는지 FAQ 원문을 확인하지 못했다(확인 필요).',
  },
  changes:
    '102.5~142.9초(32마디)를 잘라 모노로 합치고, 여러 트랙은 한 소스로 더했다(0 dBFS를 넘으면 −3 dBFS 피크로 낮춤). 양 끝 5 ms 페이드, AAC 96 kbps(정답 믹스는 스테레오 160 kbps).',
  stems: [
    { key: 'lead-vocal', label: '리드 보컬', role: 'lead-vocal', file: `${DIR}/lead-vocal.m4a`, peakDb: -1.7, rmsDb: -17.1, from: '18_LeadVox' },
    { key: 'backing-vocals', label: '백킹 보컬', role: 'backing-vocal', file: `${DIR}/backing-vocals.m4a`, peakDb: -3.0, rmsDb: -19.9, from: '20~27 BackingVox 1~8 합침(−6.1 dB)' },
    { key: 'lead-double', label: '리드 보컬 더블', role: 'backing-vocal', file: `${DIR}/lead-double.m4a`, peakDb: -3.0, rmsDb: -18.6, from: '19_LeadVoxDT' },
    { key: 'kick', label: '킥', role: 'kick', file: `${DIR}/kick.m4a`, peakDb: -9.3, rmsDb: -40.2, from: '01_KickTrigger' },
    { key: 'snare', label: '스네어', role: 'snare', file: `${DIR}/snare.m4a`, peakDb: -2.5, rmsDb: -27.5, from: '02_Snare' },
    { key: 'toms', label: '탐', role: 'toms', file: `${DIR}/toms.m4a`, peakDb: -2.3, rmsDb: -26.3, from: '04_Tom1 + 05_Tom2' },
    { key: 'overheads', label: '오버헤드', role: 'overheads', file: `${DIR}/overheads.m4a`, peakDb: -4.0, rmsDb: -26.6, from: '03_Overheads(스테레오→모노)' },
    { key: 'tambourine', label: '탬버린', role: 'percussion', file: `${DIR}/tambourine.m4a`, peakDb: -3.0, rmsDb: -24.8, from: '06_Tambourine(스테레오→모노, −3.0 dB)' },
    { key: 'bass', label: '베이스', role: 'bass', file: `${DIR}/bass.m4a`, peakDb: -6.1, rmsDb: -18.6, from: '10_Bass' },
    { key: 'guitar', label: '일렉 기타', role: 'guitar', file: `${DIR}/guitar.m4a`, peakDb: -3.0, rmsDb: -16.0, from: '13~17 ElecGtr 합침(−3.3 dB)' },
  ],
  reference: {
    file: `${DIR}/reference.m4a`,
    peakDb: 0.0,
    rmsDb: -8.8,
    note: '원곡 믹스(DevilsWords_Full_Preview.mp3)의 같은 구간. 마스터링되어 크므로 재생할 때 크기를 낮춘다',
  },
  mixer: [
    { stem: 'lead-vocal', faderDb: 0, sends: [0, -10] },
    { stem: 'backing-vocals', faderDb: -6, sends: [-8, -12] },
    { stem: 'kick', faderDb: -3, sends: [-Infinity, -4] },
    { stem: 'snare', faderDb: -5, sends: [-Infinity, -6] },
    { stem: 'toms', faderDb: -8, sends: [-Infinity, -12] },
    { stem: 'overheads', faderDb: -8, sends: [-Infinity, -10] },
    { stem: 'bass', faderDb: -4, sends: [-Infinity, -4] },
    { stem: 'guitar', faderDb: -6, sends: [-12, 0] },
  ],
};
