// 이펙트 설정(리버브·딜레이·코러스). FX 리턴과 채널 인서트가 같이 쓴다.
import { beatMs } from '../audio/dsp/reverb';
import { Slider, Tabs } from '../components/ui/controls';
import type { FxState, FxType } from '../stores/mixer-model';
import type { Range } from '../stores/profile';
import { FX_COLOR } from './ctx';

const FX_TYPES: { id: FxType; label: string }[] = [
  { id: 'reverb', label: '리버브' },
  { id: 'delay', label: '딜레이' },
  { id: 'chorus', label: '코러스' },
];

const BEATS = [
  { q: 1, label: '4분' },
  { q: 0.75, label: '점8분' },
  { q: 0.5, label: '8분' },
];

export function FxControls({
  fx,
  ranges,
  bpm,
  onChange,
  disabled,
}: {
  fx: FxState;
  ranges: Record<string, Range>;
  bpm: number;
  onChange: (p: Partial<FxState>) => void;
  disabled?: boolean;
}) {
  const s = (label: string, key: keyof FxState, range: string, hint?: string) => (
    <Slider
      label={label}
      hint={hint}
      value={fx[key] as number}
      range={ranges[range]}
      onChange={(v) => onChange({ [key]: v } as Partial<FxState>)}
      color={FX_COLOR}
      disabled={disabled}
    />
  );
  return (
    <div className="mx-fx">
      <Tabs label="이펙트 종류" items={FX_TYPES} value={fx.type} onChange={(type) => onChange({ type })} />
      {fx.type === 'reverb' && (
        <>
          {s('잔향 길이', 'decayS', 'fxDecay', '소리가 60 dB 작아지기까지. 예배당이면 1.5~2초')}
          {s('프리딜레이', 'preDelayMs', 'fxPreDelay', '원음과 잔향 사이 틈. 늘리면 가사가 또렷하다')}
        </>
      )}
      {fx.type === 'delay' && (
        <>
          {s('시간', 'timeMs', 'fxTime', '메아리가 돌아오는 간격')}
          <div className="mx-beats">
            <span className="sim-stat">{bpm} BPM에 맞추기</span>
            {BEATS.map((b) => (
              <button key={b.q} type="button" className="sim-btn is-small" disabled={disabled} onClick={() => onChange({ timeMs: Math.round(beatMs(bpm, b.q)) })}>
                {b.label}
              </button>
            ))}
          </div>
          {s('피드백', 'feedbackPct', 'fxFeedback', '메아리가 몇 번 되풀이될지')}
        </>
      )}
      {fx.type === 'chorus' && (
        <>
          {s('속도', 'rateHz', 'fxRate', '음이 흔들리는 빠르기')}
          {s('깊이', 'depthPct', 'fxDepth', '얼마나 크게 흔들릴지')}
        </>
      )}
      {s('하이컷', 'hiCutHz', 'fxHiCut', '이펙트 소리의 고음을 깎아 덜 쏘게')}
      {s('로우컷', 'loCutHz', 'fxLoCut', '이펙트 소리의 저음을 깎아 덜 웅웅하게')}
    </div>
  );
}
