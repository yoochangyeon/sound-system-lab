// 워클릿 모듈을 컨텍스트마다 한 번만 올린다.
import dynamicsUrl from './dynamics.worklet.ts?worker&url';

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

export function ensureWorklets(ctx: BaseAudioContext): Promise<void> {
  let p = loaded.get(ctx);
  if (!p) {
    p = ctx.audioWorklet.addModule(dynamicsUrl);
    loaded.set(ctx, p);
  }
  return p;
}
