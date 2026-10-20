// 채널 PEQ: BiquadFilterNode 4개를 직렬로 잇는다(lowshelf, peaking 2, highshelf).
// HPF는 프리엠프 구역(channel-strip.ts)에 따로 있다. 화면 응답 곡선은 노드가 아니라
// dsp/biquad.ts의 순수 함수로 계산한다(stores/derived.ts).

import type { PeqState } from '../stores/mixer-model';

export const RAMP = 0.01; // 초. 노브를 돌릴 때 지퍼 노이즈가 나지 않게 짧게 램프한다.

export class Peq {
  readonly filters: BiquadFilterNode[];

  constructor(
    private ctx: BaseAudioContext,
    bandCount = 4,
  ) {
    this.filters = Array.from({ length: bandCount }, () => ctx.createBiquadFilter());
    this.filters.forEach((f, i) => {
      f.gain.value = 0;
      if (i > 0) this.filters[i - 1].connect(f);
    });
  }

  get input(): AudioNode {
    return this.filters[0];
  }

  get output(): AudioNode {
    return this.filters[this.filters.length - 1];
  }

  apply(state: PeqState): void {
    const t = this.ctx.currentTime;
    state.bands.forEach((b, i) => {
      const f = this.filters[i];
      if (!f) return;
      if (f.type !== b.type) f.type = b.type;
      f.frequency.setTargetAtTime(b.freq, t, RAMP);
      f.Q.setTargetAtTime(b.q, t, RAMP);
      // 끄면 게인을 0으로 둔다(shelf·peaking은 0 dB면 통과와 같다).
      f.gain.setTargetAtTime(state.on ? b.gainDb : 0, t, RAMP);
    });
  }
}
