// @ts-check

/**
 * Shiki transformer for fenced code blocks with a title, e.g. ```bash title="/etc/inittab".
 * Wraps the <pre> in <figure class="code-block"> with a <figcaption class="code-title">.
 * Blocks without a title are left as a bare <pre>.
 *
 * @returns {import('shiki').ShikiTransformer}
 */
export function shikiCodeTitle() {
	return {
		name: 'code-title',
		root(root) {
			const raw = this.options.meta?.__raw ?? '';
			const title = raw.match(/title=(?:"([^"]*)"|'([^']*)')/)?.slice(1).find((t) => t !== undefined);
			if (!title) return;
			// Astro takes the first child of the returned root as the block's replacement, so wrap everything in one figure.
			return {
				type: 'root',
				children: [
					{
						type: 'element',
						tagName: 'figure',
						properties: { class: 'code-block' },
						children: [
							{
								type: 'element',
								tagName: 'figcaption',
								properties: { class: 'code-title' },
								children: [{ type: 'text', value: title }],
							},
							...root.children,
						],
					},
				],
			};
		},
	};
}
