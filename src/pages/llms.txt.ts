// AI 답변 엔진용 사이트 안내(llmstxt.org 제안 형식). 레슨 목록은 콘텐츠 컬렉션에서 빌드 때 만든다.
import type { APIRoute } from 'astro';
import { CHAPTERS, lessonHref, sortedLessons } from '../lib/lessons';
import { SITE_NAME } from '../lib/release';
import { SITE_DESCRIPTION, SITE_TAGLINE } from '../lib/seo';

export const GET: APIRoute = async ({ site }) => {
  const lessons = await sortedLessons();
  const abs = (path: string) => new URL(path, site).href;

  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_TAGLINE}. ${SITE_DESCRIPTION}`,
    '',
    '대상은 음향을 전공하지 않은 교회 방송실 봉사자다. 레슨은 짧은 카드로 개념 하나씩 설명하고, 2장 레슨에서는 게인·EQ·컴프레서·게이트 위젯을 직접 만져 소리 변화를 듣는다. 실습실의 8채널 쉬운 믹서는 실제 기종을 재현하지 않은 학습용 믹서다. 무료이고 로그인이 없다.',
    '',
  ];
  for (const ch of CHAPTERS) {
    lines.push(`## ${ch.label}`, '', ch.blurb, '');
    for (const l of lessons.filter((x) => x.data.chapter === ch.key)) {
      lines.push(`- [${l.data.title}](${abs(lessonHref(l))}): ${l.data.summary}`);
    }
    lines.push('');
  }
  lines.push(
    '## 실습',
    '',
    `- [실습실(쉬운 믹서)](${abs('/lab/')}): 하울링, 설교 웅웅거림, 게인, 소리 안 나는 채널, 건조한 보컬(리버브 센드), DCA, 솔로로 범인 찾기, 씬 불러오기 미션 8가지`,
    '',
    '## Optional',
    '',
    `- [음원 출처](${abs('/credits/')}): 실습 음원의 출처와 라이선스`,
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
