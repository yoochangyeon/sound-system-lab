// 레슨 원고(MDX) 표기 검사. GFM이 글자를 지우거나 별표를 그대로 내보내는 표기를 막는다(QA 2026-10-20 F-05).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'src/content/lessons');
const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.mdx'));

/** 본문 글줄만 고른다. 머리말, 주석, JSX 태그·속성 줄은 마크다운으로 읽히지 않는다. */
function proseLines(src: string): { no: number; text: string }[] {
  const out: { no: number; text: string }[] = [];
  let front = 0;
  src.split('\n').forEach((line, i) => {
    if (line.trim() === '---' && front < 2) {
      front++;
      return;
    }
    if (front < 2) return;
    const t = line.trim();
    if (!t || /^(import |export |<|\{|\}|\/\/|\]|\)|['"`]|[A-Za-z]+[=:])/.test(t) || /^\s/.test(line)) return;
    out.push({ no: i + 1, text: t });
  });
  return out;
}

describe('레슨 원고 표기', () => {
  it('레슨 파일을 찾았다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    const lines = proseLines(readFileSync(join(root, f), 'utf8'));

    it(`${f}: 한 줄에 물결표 범위(1~4)가 둘 이상이면 \\~로 쓴다(취소선이 된다)`, () => {
      const bad = lines.filter((l) => (l.text.match(/(?<!\\)~/g) ?? []).length >= 2).map((l) => `${l.no}: ${l.text}`);
      expect(bad).toEqual([]);
    });

    it(`${f}: 닫는 **가 문장부호 뒤·글자 앞에 붙지 않는다(굵게 안 되고 별표가 보인다)`, () => {
      const bad = lines
        .filter((l) => /\*\*[^*\s][^*]*[\p{P}\p{S}]\*\*[\p{L}\p{N}]/u.test(l.text))
        .map((l) => `${l.no}: ${l.text}`);
      expect(bad).toEqual([]);
    });
  }
});
