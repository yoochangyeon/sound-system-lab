import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, courseJsonLd, courseId, jsonLdGraph, lessonJsonLd } from './seo';

const site = new URL('https://example.test');

describe('jsonLdGraph', () => {
  it('묶은 노드를 schema.org 그래프로 내고 다시 파싱된다', () => {
    const out = jsonLdGraph([breadcrumbJsonLd([{ name: '홈', url: 'https://example.test/' }])]);
    const parsed = JSON.parse(out);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@graph'][0].itemListElement[0]).toMatchObject({ position: 1, name: '홈' });
  });

  it('본문에 </script>가 있어도 태그가 끊기지 않는다', () => {
    const out = jsonLdGraph([{ name: '</script><b>' }]);
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out)['@graph'][0].name).toBe('</script><b>');
  });
});

describe('레슨과 코스 연결', () => {
  it('레슨은 코스의 @id를 isPartOf로 가리킨다', () => {
    const lesson = lessonJsonLd(site, { title: 'EQ 기초', summary: '요약', url: 'https://example.test/lessons/a/', topics: ['EQ'] });
    const course = courseJsonLd(site, [{ title: 'EQ 기초', url: 'https://example.test/lessons/a/' }]);
    expect(lesson.isPartOf).toEqual({ '@id': courseId(site) });
    expect(course['@id']).toBe(courseId(site));
    expect(course.isAccessibleForFree).toBe(true);
  });

  it('키워드가 없으면 keywords를 넣지 않는다', () => {
    const lesson = lessonJsonLd(site, { title: 't', summary: 's', url: 'https://example.test/x/', topics: [] });
    expect(lesson).not.toHaveProperty('keywords');
  });
});
