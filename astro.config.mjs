// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkAlert } from 'remark-github-blockquote-alert';

// https://astro.build/config
export default defineConfig({
	site: 'https://brisk4t.github.io',
	markdown: {
		processor: unified({ remarkPlugins: [remarkAlert] }),
	},
	image: {
		// Let Astro fetch and optimize remote Markdown images (resize + WebP, width/height, lazy loading)
		// instead of hotlinking the full-resolution originals.
		remotePatterns: [{ protocol: 'https' }],
		// Generate a srcset so small screens download smaller variants.
		layout: 'constrained',
	},
});
