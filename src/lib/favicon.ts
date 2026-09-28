/**
 * Build-time favicon resolver for external links.
 *
 * Fetches the target site's homepage, reads its <link rel="icon"> tags and picks the best
 * icon plus a dark-mode variant when one is declared. Falls back to Google's favicon
 * service if the site can't be fetched (offline build, bot blocking, etc.).
 */

import { parse } from 'node-html-parser';

export interface Favicon {
	light: string;
	dark?: string;
}

interface IconLink {
	href: string;
	type?: string;
	media?: string;
	sizes?: string;
	baseHref?: string;
}

const cache = new Map<string, Promise<Favicon>>();

export function resolveFavicon(url: string): Promise<Favicon> {
	const origin = new URL(url).origin;
	let result = cache.get(origin);
	if (!result) {
		result = lookup(origin).catch(() => googleFallback(origin));
		cache.set(origin, result);
	}
	return result;
}

function googleFallback(origin: string): Favicon {
	const host = new URL(origin).hostname;
	return { light: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32` };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 5000): Promise<Response> {
	return fetch(url, {
		...init,
		redirect: 'follow',
		headers: { 'User-Agent': 'Mozilla/5.0 (favicon resolver)', ...init.headers },
		signal: AbortSignal.timeout(ms),
	});
}

async function exists(url: string): Promise<boolean> {
	try {
		const res = await fetchWithTimeout(url, { method: 'HEAD' });
		return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
	} catch {
		return false;
	}
}

function parseIconLinks(html: string, pageUrl: string): IconLink[] {
	const doc = parse(html);
	// Relative hrefs resolve against <base href> when the page declares one.
	const baseTag = doc.querySelector('base[href]')?.getAttribute('href');
	const base = baseTag ? new URL(baseTag, pageUrl).href : pageUrl;

	const links: IconLink[] = [];
	for (const el of doc.querySelectorAll('link[rel][href]')) {
		const rel = (el.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
		// Plain "icon" / "shortcut icon" / "alternate icon" — skip mask-icon, fluid-icon, apple-touch-icon.
		if (!rel.includes('icon')) continue;
		const href = el.getAttribute('href');
		if (!href) continue;
		const baseHref = el.getAttribute('data-base-href');
		links.push({
			href: new URL(href, base).href,
			type: el.getAttribute('type')?.toLowerCase(),
			media: el.getAttribute('media')?.toLowerCase(),
			sizes: el.getAttribute('sizes'),
			baseHref: baseHref ? new URL(baseHref, base).href : undefined,
		});
	}
	return links;
}

/** Higher is better: SVG scales cleanly, otherwise prefer the largest raster up to a sane size. */
function score(link: IconLink): number {
	if (link.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(link.href)) return 1000;
	const size = parseInt(link.sizes ?? '', 10);
	if (Number.isFinite(size)) return Math.min(size, 256);
	return 16;
}

const best = (links: IconLink[]) => [...links].sort((a, b) => score(b) - score(a))[0];

async function lookup(origin: string): Promise<Favicon> {
	const res = await fetchWithTimeout(origin + '/');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const pageUrl = res.url || origin + '/';
	const links = parseIconLinks(await res.text(), pageUrl);

	const isDark = (l: IconLink) => !!l.media && /prefers-color-scheme:\s*dark/.test(l.media);
	const isLight = (l: IconLink) => !!l.media && /prefers-color-scheme:\s*light/.test(l.media);
	const neutral = links.filter((l) => !isDark(l) && !isLight(l));

	const lightLink = best(links.filter(isLight)) ?? best(neutral);
	const darkLink = best(links.filter(isDark));

	if (!lightLink) {
		const ico = new URL('/favicon.ico', pageUrl).href;
		if (await exists(ico)) return { light: ico };
		throw new Error('no icon');
	}

	const icon: Favicon = { light: lightLink.href, dark: darkLink?.href };

	// GitHub-style convention: data-base-href="…/favicon" with a sibling "…/favicon-dark.<ext>"
	// that the page swaps in via JS.
	if (!icon.dark && lightLink.baseHref) {
		const ext = lightLink.href.match(/\.(svg|png|ico)(\?|$)/i)?.[1] ?? 'svg';
		const candidate = `${lightLink.baseHref}-dark.${ext}`;
		if (await exists(candidate)) icon.dark = candidate;
	}

	return icon;
}
