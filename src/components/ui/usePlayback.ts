// 위젯·콘솔 공용 재생 훅.
// - AudioContext와 엔진은 첫 재생 클릭 때 만든다(자동재생 정책).
// - 페이지마다 첫 재생 전에 볼륨 안내를 한 번 띄운다(저장하지 않음).
// - 한 페이지에서 한 번에 하나만 재생한다(다른 위젯을 재생하면 앞의 것은 멈춤).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext } from '../../audio/context';
import { MixerEngine } from '../../audio/engine';
import type { MixerStoreApi } from '../../stores/mixer';

let noticeAccepted = false;
let current: { stop: () => void } | null = null;

export type PlayStatus = 'idle' | 'loading' | 'playing' | 'error';

export function usePlayback(store: MixerStoreApi) {
  const engineRef = useRef<MixerEngine | null>(null);
  const creating = useRef<Promise<MixerEngine> | null>(null);
  const [status, setStatus] = useState<PlayStatus>('idle');
  const [needNotice, setNeedNotice] = useState(false);
  const [engine, setEngine] = useState<MixerEngine | null>(null);
  const self = useRef({ stop: () => {} });

  const stop = useCallback(() => {
    engineRef.current?.stop();
    if (current === self.current) current = null;
    setStatus((s) => (s === 'playing' ? 'idle' : s));
  }, []);
  self.current.stop = stop;

  const start = useCallback(async () => {
    try {
      setStatus('loading');
      const ctx = getAudioContext();
      if (!engineRef.current) {
        creating.current ??= MixerEngine.create(ctx, store);
        engineRef.current = await creating.current;
        setEngine(engineRef.current);
        if (import.meta.env.DEV) ((window as unknown as { __engines?: unknown[] }).__engines ??= []).push({ engine: engineRef.current, store });
      }
      if (ctx.state === 'suspended') await ctx.resume();
      if (current && current !== self.current) current.stop();
      current = self.current;
      engineRef.current.play();
      setStatus('playing');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [store]);

  const toggle = useCallback(() => {
    if (status === 'playing') return stop();
    if (!noticeAccepted) {
      setNeedNotice(true);
      return;
    }
    void start();
  }, [status, start, stop]);

  const acceptNotice = useCallback(() => {
    noticeAccepted = true;
    setNeedNotice(false);
    void start();
  }, [start]);

  const cancelNotice = useCallback(() => setNeedNotice(false), []);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      if (current === self.current) current = null;
    },
    [],
  );

  return { engine, status, toggle, stop, needNotice, acceptNotice, cancelNotice };
}
