// 검색·공유용 메타데이터와 구조화 데이터(JSON-LD). 값만 만들고, <head>에 넣는 일은 BaseLayout이 한다.
import { SITE_NAME } from './release';

/** 이름에 '음향'이 없어서 홈 제목과 공유 문구에 붙이는 검색어 */
export const SITE_TAGLINE = '교회 방송실 음향 기초';
export const SITE_DESCRIPTION =
  '교회 방송실 봉사자를 위한 무료 음향 학습 사이트. 게인, EQ, 컴프레서, 게이트를 브라우저에서 직접 만지고 소리가 바뀌는 것을 들으며 배운다.';
export const DEFAULT_OG_IMAGE = '/og/default.png';
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;

type JsonLd = Record<string, unknown>;

/** 사이트 루트 주소(끝 슬래시 없음). JSON-LD의 @id를 만들 때 쓴다. */
function origin(site: URL): string {
  return site.origin;
}

export function courseId(site: URL): string {
  return `${origin(site)}/#course`;
}

export function websiteJsonLd(site: URL): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': `${origin(site)}/#website`,
    url: `${origin(site)}/`,
    name: SITE_NAME,
    alternateName: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    inLanguage: 'ko-KR',
  };
}

export interface CourseLesson {
  title: string;
  url: string;
}

export function courseJsonLd(site: URL, lessons: CourseLesson[]): JsonLd {
  return {
    '@type': 'Course',
    '@id': courseId(site),
    name: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: `${origin(site)}/`,
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    educationalLevel: '입문',
    audience: { '@type': 'Audience', audienceType: '교회 방송실 봉사자' },
    provider: { '@type': 'Organization', name: SITE_NAME, url: `${origin(site)}/` },
    hasPart: lessons.map((l) => ({ '@type': 'LearningResource', name: l.title, url: l.url })),
  };
}

export interface LessonMeta {
  title: string;
  summary: string;
  url: string;
  topics: string[];
}

export function lessonJsonLd(site: URL, lesson: LessonMeta): JsonLd {
  return {
    '@type': 'LearningResource',
    '@id': `${lesson.url}#lesson`,
    name: lesson.title,
    description: lesson.summary,
    url: lesson.url,
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    learningResourceType: '레슨',
    educationalLevel: '입문',
    ...(lesson.topics.length > 0 && { keywords: lesson.topics.join(', ') }),
    isPartOf: { '@id': courseId(site) },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** 여러 노드를 하나의 <script type="application/ld+json">으로 묶는다. */
export function jsonLdGraph(nodes: JsonLd[]): string {
  // </script>가 본문에 섞여도 태그가 끊기지 않게 '<'를 이스케이프한다.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
