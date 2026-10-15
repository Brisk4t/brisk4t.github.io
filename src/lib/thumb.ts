import type { ImageMetadata } from 'astro';
import { getImage, inferRemoteSize } from 'astro:assets';

export interface ThumbAttrs {
	src: string;
	srcset?: string;
	sizes?: string;
	width?: number | string;
	height?: number | string;
}

/**
 * Resize a heroImage into a small WebP thumbnail with a srcset.
 * Accepts a local image (from the content schema's image()) or a remote URL;
 * public/ paths (e.g. /lab/x/cover.svg) are returned untouched.
 */
export async function thumb(src: string | ImageMetadata, width: number, sizes: string): Promise<ThumbAttrs> {
	if (typeof src === 'string' && !/^https?:\/\//.test(src)) return { src };
	// Don't combine inferSize with width: Astro would keep the original height and stretch the image.
	const original = typeof src === 'string' ? await inferRemoteSize(src) : src;
	const w = Math.min(width, original.width);
	const h = Math.round((w * original.height) / original.width);
	const img = await getImage({ src, width: w, height: h, sizes, layout: 'constrained' });
	return { src: img.src, srcset: img.srcSet.attribute || undefined, sizes, width: w, height: h };
}
