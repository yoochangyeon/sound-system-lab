import { getAudioContext } from './context';

export type PeqBandType = 'lowshelf' | 'peaking' | 'highshelf' | 'highpass' | 'lowpass';

export interface PeqBand {
  type: PeqBandType;
  freq: number; // Hz
  gain: number; // dB (shelf·peaking만 의미 있음)
  q: number;
}

// 콘솔 채널 EQ의 흔한 기본값: HPF + 4밴드
export const DEFAULT_BANDS: PeqBand[] = [
  { type: 'highpass', freq: 80, gain: 0, q: 0.707 },
  { type: 'lowshelf', freq: 120, gain: 0, q: 0.707 },
  { type: 'peaking', freq: 500, gain: 0, q: 1 },
  { type: 'peaking', freq: 2500, gain: 0, q: 1 },
  { type: 'highshelf', freq: 8000, gain: 0, q: 0.707 },
];

/** BiquadFilterNode를 직렬로 이은 PEQ. input → … → output */
export class Peq {
  readonly filters: BiquadFilterNode[];

  constructor(bands: PeqBand[] = DEFAULT_BANDS) {
    const ctx = getAudioContext();
    this.filters = bands.map(() => ctx.createBiquadFilter());
    this.filters.forEach((f, i) => {
      this.setBand(i, bands[i]);
      if (i > 0) this.filters[i - 1].connect(f);
    });
  }

  get input(): AudioNode {
    return this.filters[0];
  }

  get output(): AudioNode {
    return this.filters[this.filters.length - 1];
  }

  setBand(index: number, band: PeqBand): void {
    const f = this.filters[index];
    const t = getAudioContext().currentTime;
    f.type = band.type;
    // 노브를 돌릴 때 지퍼 노이즈가 나지 않게 짧게 램프한다.
    f.frequency.setTargetAtTime(band.freq, t, 0.01);
    f.gain.setTargetAtTime(band.gain, t, 0.01);
    f.Q.setTargetAtTime(band.q, t, 0.01);
  }

  /** 화면에 그릴 합성 주파수 응답(dB). */
  getResponse(freqs: Float32Array<ArrayBuffer>): Float32Array {
    const total = new Float32Array(freqs.length);
    const mag = new Float32Array(freqs.length);
    const phase = new Float32Array(freqs.length);
    for (const f of this.filters) {
      f.getFrequencyResponse(freqs, mag, phase);
      for (let i = 0; i < freqs.length; i++) total[i] += 20 * Math.log10(mag[i]);
    }
    return total;
  }
}
