// X32 스타일 기종 프로필.
// 근거: docs/research/console-params.md (확인 2026-10-20)
//  - 수치 대부분은 비공식 "Unofficial X32/M32 OSC Remote Protocol"(P-G. Maillot, v4.09)에서 가져왔다.
//    공식 사이트 문서가 404여서 실기기나 X32-Edit로 다시 확인해야 한다(확인 필요).
//  - User Manual V5.0(2013-01-03) 판매처 사본: "72 dB gain range", 채널 PEQ 4밴드, 버스 32/16.
// 단순화: 컴프 레이시오는 실제로는 단계값(1.1~100)이지만 연속 노브로 둔다. GEQ 게인 범위는 확인 필요(±15 dB로 둠).
import type { DeviceProfile } from '../profile';

export const X32_PROFILE: DeviceProfile = {
  id: 'x32',
  name: 'X32 스타일',
  ranges: {
    gain: { min: -12, max: 60, step: 0.5, unit: 'dB' },
    hpfFreq: { min: 20, max: 400, step: 1, unit: 'Hz', log: true },
    gateThreshold: { min: -80, max: 0, step: 0.5, unit: 'dB' },
    gateRange: { min: 3, max: 60, step: 1, unit: 'dB' },
    gateAttack: { min: 0, max: 120, step: 1, unit: 'ms' },
    gateHold: { min: 0.02, max: 2000, step: 0.01, unit: 'ms', log: true },
    gateRelease: { min: 5, max: 4000, step: 1, unit: 'ms', log: true },
    compThreshold: { min: -60, max: 0, step: 0.5, unit: 'dB' },
    ratio: { min: 1.1, max: 100, step: 0.1, unit: ':1', log: true },
    knee: { min: 0, max: 5, step: 1, unit: 'dB' },
    compAttack: { min: 0, max: 120, step: 1, unit: 'ms' },
    compRelease: { min: 5, max: 4000, step: 1, unit: 'ms', log: true },
    makeup: { min: 0, max: 24, step: 0.5, unit: 'dB' },
    eqFreq: { min: 20, max: 20000, step: 1, unit: 'Hz', log: true },
    eqGain: { min: -15, max: 15, step: 0.25, unit: 'dB' },
    eqQ: { min: 0.3, max: 10, step: 0.1, unit: '', log: true },
    fader: { min: -90, max: 10, step: 0.5, unit: 'dB' },
    send: { min: -90, max: 10, step: 0.5, unit: 'dB' },
    geqGain: { min: -15, max: 15, step: 0.5, unit: 'dB' },
  },
};
