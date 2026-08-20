import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		// Path into public/, e.g. /blog/my-post/cover.jpg. Omit for a text-only tile.
		heroImage: z.string().optional(),
		heroImageAlt: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

const labs = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/labs' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		tags: z.array(z.string()).default([]),
		// Must match the folder name under src/pages/lab/<slug>/
		slug: z.string(),
		// Optional accent color for the card on the /lab index (each island can pick its own)
		accent: z.string().default('#6366f1'),
		// Path into public/, e.g. /lab/my-lab/cover.svg. Omit for a solid accent-colored tile.
		heroImage: z.string().optional(),
		heroImageAlt: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

export const collections = { blog, labs };
