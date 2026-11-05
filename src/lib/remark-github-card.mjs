// @ts-check

/**
 * Remark plugin that turns a `github` leaf directive (needs remark-directive before it), e.g.
 *
 *   ::github{repo="Brisk4t/ToothPaste"}
 *
 * into a GitHub-style repository card (name, description, language, stars, forks).
 * Repo details are fetched from the GitHub API at build time; set GITHUB_TOKEN to avoid
 * the unauthenticated rate limit. If the fetch fails the card renders with placeholder counts.
 * Star/fork counts are refreshed in the browser by a script in BaseLayout.astro.
 *
 * Any other directive is turned back into the text it was written as, so prose like
 * "ratio a:b" isn't swallowed by remark-directive.
 */

const REPO = /^([\w.-]+)\/([\w.-]+)$/;

// Octicons (MIT) — mark-github-16, repo-16, star-16, repo-forked-16
const ICONS = {
	github: 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.25-.6-.86-1.23-.85-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z',
	repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
	star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z',
	fork: 'M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z',
};

// GitHub's linguist colors for languages likely to show up here; anything else gets a neutral dot.
const LANGUAGE_COLORS = {
	C: '#555555',
	'C++': '#f34b7d',
	Rust: '#dea584',
	Python: '#3572A5',
	JavaScript: '#f1e05a',
	TypeScript: '#3178c6',
	Astro: '#ff5a03',
	Go: '#00ADD8',
	Shell: '#89e051',
	HTML: '#e34c26',
	CSS: '#663399',
	Assembly: '#6E4C13',
};

/** @type {Map<string, Promise<any>>} */
const cache = new Map();

/** @param {string} repo */
function fetchRepo(repo) {
	if (!cache.has(repo)) {
		const headers = { Accept: 'application/vnd.github+json' };
		if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		cache.set(
			repo,
			fetch(`https://api.github.com/repos/${repo}`, { headers })
				.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
				.catch((err) => {
					console.warn(`[github-card] Could not fetch ${repo}: ${err.message}`);
					return null;
				}),
		);
	}
	return cache.get(repo);
}

/** @param {string} s */
const escape = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * @param {string} path
 * @param {number} [size]
 */
const icon = (path, size = 16) =>
	`<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;

/** @param {number} n */
const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n);

/**
 * @param {string} url
 * @param {string} owner
 * @param {string} name
 * @param {any} data
 */
function renderCard(url, owner, name, data) {
	const meta = [];
	if (data?.language) {
		const color = LANGUAGE_COLORS[data.language] ?? '#8b949e';
		meta.push(`<span><span class="gh-card-lang" style="background:${color}"></span>${escape(data.language)}</span>`);
	}
	// Always emit the count slots (with a placeholder if the build-time fetch failed) so the
	// client script still has somewhere to put live numbers.
	meta.push(`<span>${icon(ICONS.star)}<span data-gh-stars>${data ? compact(data.stargazers_count) : '–'}</span></span>`);
	meta.push(`<span>${icon(ICONS.fork)}<span data-gh-forks>${data ? compact(data.forks_count) : '–'}</span></span>`);
	// data-gh-repo lets the client script in BaseLayout.astro refresh the counts on page load,
	// since the build-time numbers go stale until the next deploy.
	return (
		`<a class="gh-card" href="${escape(url)}" data-gh-repo="${escape(`${owner}/${name}`)}">` +
		`<span class="gh-card-title">${icon(ICONS.repo)}<span>${escape(owner)}/<strong>${escape(name)}</strong></span><span class="gh-card-logo">${icon(ICONS.github, 24)}</span></span>` +
		(data?.description ? `<span class="gh-card-desc">${escape(data.description)}</span>` : '') +
		`<span class="gh-card-meta">${meta.join('')}</span>` +
		`</a>`
	);
}

const DIRECTIVE_PREFIX = { textDirective: ':', leafDirective: '::', containerDirective: ':::' };

/**
 * @param {any} node
 * @param {any} file
 */
function githubCard(node, file) {
	const match = node.attributes?.repo?.match(REPO);
	if (!match) {
		file.fail('::github needs a repo attribute like ::github{repo="owner/name"}', node);
	}
	const [, owner, name] = match;
	return fetchRepo(`${owner}/${name}`).then((data) => ({
		type: 'html',
		value: renderCard(`https://github.com/${owner}/${name}`, owner, name, data),
	}));
}

/**
 * Labels are kept, attributes are dropped.
 * @param {any} node
 */
function restoreDirective(node) {
	const text = { type: 'text', value: DIRECTIVE_PREFIX[node.type] + node.name };
	if (node.type === 'containerDirective') return [{ type: 'paragraph', children: [text] }, ...node.children];
	const label = node.children.length ? [{ type: 'text', value: '[' }, ...node.children, { type: 'text', value: ']' }] : [];
	if (node.type === 'textDirective') return [text, ...label];
	return [{ type: 'paragraph', children: [text, ...label] }];
}

/** @param {any} node */
const isDirective = (node) => node.type in DIRECTIVE_PREFIX;

export function remarkGithubCard() {
	/**
	 * @param {any} tree
	 * @param {any} file
	 */
	return async (tree, file) => {
		const jobs = [];
		/** @param {any} parent */
		const walk = (parent) => {
			if (!parent.children) return;
			parent.children = parent.children.flatMap((node) => {
				if (node.type === 'leafDirective' && node.name === 'github') {
					// Swap the card in place once fetched; indices may shift as siblings are restored.
					const slot = { type: 'html', value: '' };
					jobs.push(githubCard(node, file).then((card) => Object.assign(slot, card)));
					return [slot];
				}
				const restored = isDirective(node) ? restoreDirective(node) : [node];
				restored.forEach(walk);
				return restored;
			});
		};
		walk(tree);
		await Promise.all(jobs);
	};
}
