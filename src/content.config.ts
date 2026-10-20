import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 강의 원고. 폴더 = 장(chapter), 파일명 앞 번호 = 순서.
const lessons = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    chapter: z.enum(['basics', 'processing', 'consoles']),
    order: z.number(),
    summary: z.string(),
    /** 홈 레슨 카드에 보이는 핵심 키워드, 두 개까지(기획서 S01) */
    topics: z.array(z.string()).max(2).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { lessons };
