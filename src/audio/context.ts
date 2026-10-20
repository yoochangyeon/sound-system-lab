// 페이지 하나에 AudioContext 하나. 브라우저 자동재생 정책 때문에
// 사용자 클릭 이후에 getAudioContext()를 처음 불러야 한다.
// 엔진 구성 요소는 컨텍스트를 인자로 받는다. getAudioContext()는 앱 진입점(위젯·콘솔)에서만 부른다.
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const bufferCache = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer>>>();

/** public/audio/ 아래 샘플을 불러와 디코딩한다. 컨텍스트마다 캐시한다. */
export function loadSample(context: BaseAudioContext, path: string): Promise<AudioBuffer> {
  let cache = bufferCache.get(context);
  if (!cache) {
    cache = new Map();
    bufferCache.set(context, cache);
  }
  let p = cache.get(path);
  if (!p) {
    p = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`샘플 로드 실패: ${path} (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => context.decodeAudioData(buf));
    p.catch(() => cache!.delete(path));
    cache.set(path, p);
  }
  return p;
}
