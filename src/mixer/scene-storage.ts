// 쉬운 믹서의 씬을 곡마다 브라우저(localStorage)에 남긴다. 저장소를 쓸 수 없으면(사생활 보호 모드 등) 조용히 넘어간다.
import type { SceneState } from '../stores/mixer-model';

const key = (songId: string) => `mx-scenes:${songId}`;

export function loadScenes(songId: string): SceneState[] | null {
  try {
    const raw = localStorage.getItem(key(songId));
    if (!raw) return null;
    const v = JSON.parse(raw, (_, x) => (x === '-Infinity' ? -Infinity : x));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveScenes(songId: string, scenes: SceneState[]): void {
  try {
    // JSON에는 −∞가 없으므로 글자로 바꿔 둔다.
    localStorage.setItem(key(songId), JSON.stringify(scenes, (_, x) => (x === -Infinity ? '-Infinity' : x)));
  } catch {
    // 저장하지 못해도 이번 방문 동안은 씬이 남아 있다.
  }
}

const VIEW_KEY = 'mx-view';

export function loadView(): 'basic' | 'full' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'full' ? 'full' : 'basic';
  } catch {
    return 'basic';
  }
}

export function saveView(v: 'basic' | 'full'): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // 무시
  }
}
