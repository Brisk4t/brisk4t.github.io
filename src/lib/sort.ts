interface Dated {
	data: { pubDate: Date; pinned?: boolean };
}

/** Pinned entries first, then everything else; newest first within each group. */
export function sortPinnedFirst<T extends Dated>(entries: T[]): T[] {
	return [...entries].sort(
		(a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned) || b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
}
