import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		// Short subtitle shown on the tile by default. Blank frontmatter values parse as null, so accept that too.
		description: z.string().nullish().transform((v) => v ?? ''),
		// Longer blurb shown on the tile in place of description on hover. Omit (or leave blank) to keep description on hover too.
		longDescription: z.string().nullish().transform((v) => v ?? undefined),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		// Path into public/, e.g. /blog/my-post/cover.jpg. Omit for a text-only tile.
		heroImage: z.string().optional(),
		heroImageAlt: z.string().optional(),
		// Useful links shown in the "Links" menu under the table of contents, e.g.
		// links:
		//   - { label: GitHub repo, url: https://github.com/... }
		// Each link shows the site's favicon by default; set `icon` to an image URL/path to override, or `false` to hide it.
		links: z
			.array(
				z.object({
					label: z.string(),
					url: z.string(),
					icon: z.union([z.string(), z.literal(false)]).optional(),
					// Dark-mode variant of the icon (auto-detected for most sites; set this if detection misses).
					iconDark: z.string().optional(),
				}),
			)
			.nullish()
			.transform((v) => v ?? []),
		// Pinned entries always show at the top of the masonry grid (newest pinned first), with a pin badge.
		pinned: z.boolean().default(false),
		draft: z.boolean().default(false),
	}),
});

const labs = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/labs' }),
	schema: z.object({
		title: z.string(),
		// Short subtitle shown on the tile by default. Blank frontmatter values parse as null, so accept that too.
		description: z.string().nullish().transform((v) => v ?? ''),
		// Longer blurb shown on the tile in place of description on hover. Omit (or leave blank) to keep description on hover too.
		longDescription: z.string().nullish().transform((v) => v ?? undefined),
		pubDate: z.coerce.date(),
		tags: z.array(z.string()).default([]),
		// Must match the folder name under src/pages/lab/<slug>/
		slug: z.string(),
		// External URL to link to instead of /lab/<slug>/, for labs that live off-site.
		url: z.string().url().optional(),
		// Optional accent color for the card on the /lab index (each island can pick its own)
		accent: z.string().default('#6366f1'),
		// Path into public/, e.g. /lab/my-lab/cover.svg. Omit for a solid accent-colored tile.
		heroImage: z.string().optional(),
		heroImageAlt: z.string().optional(),
		// Pinned entries always show at the top of the masonry grid (newest pinned first), with a pin badge.
		pinned: z.boolean().default(false),
		draft: z.boolean().default(false),
	}),
});

export const collections = { blog, labs };
