// dLive 스타일 기종 프로필.
// 근거: docs/research/console-params.md (확인 2026-10-20), Allen & Heath 도움말
//  - Processing specs: https://support.allen-heath.com/hc/en-gb/articles/39827102349457-Processing-specs
//  - Processing Screen: https://support.allen-heath.com/hc/en-gb/articles/39790636807825-Processing-Screen
// 단순화한 점(확인 필요 포함):
//  - 프리앰프 게인 +5~+60 dB에 −20 dB 패드를 합쳐 −15~+60 dB 하나의 노브로 둔다(게인 범위는 판매처 사양표만 확인).
//  - 게이트·컴프 스레숄드는 실제 화면이 dBu다. 내부 값은 dBFS로 두고 0 dBFS = +18 dBu로 가정해 표시만 바꾼다(확인 필요).
//    게이트 −72~+12 dBu → −90~−6 dBFS, 컴프 −46~+18 dBu → −64~0 dBFS.
//  - 컴프 니·메이크업·어택·릴리스 수치 범위는 공식 문서에 없어 일반적인 범위로 둔다(확인 필요).
//  - PEQ 폭 1.5~1/9 옥타브 → Q 약 0.9~13.
//  - GEQ는 28밴드(31 Hz~16 kHz, ±12 dB). 엔진은 31밴드를 공유하고 화면에는 28밴드만 보인다.
import type { DeviceProfile } from '../profile';

export const DLIVE_DBU_OFFSET = 18;

export const DLIVE_PROFILE: DeviceProfile = {
  id: 'dlive',
  name: 'dLive 스타일',
  ranges: {
    gain: { min: -15, max: 60, step: 1, unit: 'dB' },
    hpfFreq: { min: 20, max: 2000, step: 1, unit: 'Hz', log: true },
    gateThreshold: { min: -90, max: -6, step: 0.5, unit: 'dBu', offset: DLIVE_DBU_OFFSET },
    gateRange: { min: 0, max: 60, step: 1, unit: 'dB' },
    gateAttack: { min: 0.05, max: 300, step: 0.05, unit: 'ms', log: true },
    gateHold: { min: 10, max: 5000, step: 1, unit: 'ms', log: true },
    gateRelease: { min: 10, max: 1000, step: 1, unit: 'ms', log: true },
    compThreshold: { min: -64, max: 0, step: 0.5, unit: 'dBu', offset: DLIVE_DBU_OFFSET },
    ratio: { min: 1, max: 50, step: 0.1, unit: ':1', log: true },
    knee: { min: 0, max: 10, step: 1, unit: 'dB' },
    compAttack: { min: 0.3, max: 300, step: 0.1, unit: 'ms', log: true },
    compRelease: { min: 50, max: 2000, step: 1, unit: 'ms', log: true },
    makeup: { min: 0, max: 18, step: 0.5, unit: 'dB' },
    eqFreq: { min: 20, max: 20000, step: 1, unit: 'Hz', log: true },
    eqGain: { min: -15, max: 15, step: 0.25, unit: 'dB' },
    eqQ: { min: 0.9, max: 13, step: 0.1, unit: '', log: true },
    fader: { min: -90, max: 10, step: 0.5, unit: 'dB' },
    send: { min: -90, max: 10, step: 0.5, unit: 'dB' },
    geqGain: { min: -12, max: 12, step: 0.5, unit: 'dB' },
  },
};

/** dLive 화면에 보이는 GEQ 밴드: 31.5 Hz~16 kHz(28개) */
export const DLIVE_GEQ_FIRST = 2;
export const DLIVE_GEQ_LAST = 29;
