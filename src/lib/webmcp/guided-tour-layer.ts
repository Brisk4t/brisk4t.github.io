/**
 * guided-tour-layer.ts
 * ---------------------------------------------------------------------------
 * A tiny, framework-free WebMCP layer that lets an AI agent give a *guided
 * tour* of any website instead of dictating "do A, then B, then C" in chat.
 *
 * It exposes two MCP tools to whatever agent the browser wires up via
 * `navigator.modelContext`:
 *
 *   - `highlight`               make any DOM element visually stand out
 *   - `highlight_with_context`  ...and pin a short teaching note to it
 *
 * plus two helpers an agent that has never seen the page can use to orient
 * itself: `clear_highlights` and `list_landmarks`.
 *
 * Drop-in usage (any site):
 *
 *   import { installGuidedTourLayer } from './guided-tour-layer';
 *   installGuidedTourLayer();
 *
 * or without a bundler:
 *
 *   <script type="module" src="/guided-tour-layer.js"></script>
 *   <script>WebMCPGuidedTour.install()</script>
 *
 * The element resolver is deliberately permissive so an agent can point at
 * "any DOM element" the way a human would describe it: a CSS selector, the
 * visible text, a `data-tour-id`, or a role + accessible-name pair. If the
 * target is hidden (inside an inactive tab/panel), the layer dispatches a
 * cancelable `webmcp:reveal` event so the host app can bring it on screen
 * before the highlight lands.
 * ---------------------------------------------------------------------------
 */

/* ----------------------------- element refs ------------------------------ */

export interface ElementQuery {
	/** CSS selector, evaluated against `within` or the document. */
	selector?: string;
	/** Visible text of the target. Exact match wins, otherwise "contains". */
	text?: string;
	/** Value of the element's `data-tour-id` attribute. */
	tourId?: string;
	/** ARIA role (explicit or implicit): button, link, heading, textbox, ... */
	role?: string;
	/** Accessible name, paired with `role` (or `text`) to disambiguate. */
	name?: string;
	/** When several elements match, pick this one (0-based, default 0). */
	nth?: number;
	/** Selector to scope the search to. */
	within?: string;
}

export type ElementRef = string | Element | ElementQuery;

/* ------------------------------ public opts ----------------------------- */

export interface HighlightOptions {
	/** Short caption chip rendered on the highlight ring. */
	label?: string;
	/** Dim + block the rest of the page until dismissed. Default false. */
	modal?: boolean;
	/** Scroll the target to the centre of the viewport first. Default true. */
	scrollIntoView?: boolean;
}

export interface TourContext {
	title?: string;
	/** The teaching note: what this control is and why it matters. */
	explanation: string;
	/** Optional "now do this" nudge shown under the explanation. */
	actionHint?: string;
	/** 1-based position in a multi-step tour, shows "Step 2 of 5". */
	step?: number;
	totalSteps?: number;
}

export interface HighlightWithContextOptions extends HighlightOptions {
	/**
	 * `'none'`    — resolve as soon as the callout is on screen (tool calls).
	 * `'dismiss'` — resolve when the user clicks Next / Done / closes it.
	 */
	await?: 'none' | 'dismiss';
}

export interface GuidedTourLayer {
	highlight(ref: ElementRef, opts?: HighlightOptions): Promise<HighlightResult>;
	highlightWithContext(
		ref: ElementRef,
		context: TourContext | string,
		opts?: HighlightWithContextOptions,
	): Promise<HighlightResult>;
	clear(): void;
	dispose(): void;
	/** The `navigator.modelContext` this layer registered its tools on. */
	modelContext: ModelContextLike;
}

export interface HighlightResult {
	ok: boolean;
	message: string;
	/** A best-effort human description of what got highlighted. */
	described?: string;
	dismissedBy?: 'next' | 'done' | 'close' | 'escape' | 'auto';
}

/* -------------------------- navigator.modelContext --------------------------
 * Minimal shim following the WebMCP shape. In a browser that ships WebMCP
 * natively (or via an extension) this object already exists and we just call
 * `registerTool` on it — the agent is on the other end. When nothing provides
 * it we install a shim so the page (and the in-page demo console) can still
 * drive the tools.
 * ------------------------------------------------------------------------- */

export interface McpToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export interface McpToolResult {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
}

export interface ModelContextLike {
	registerTool(tool: McpToolDefinition): () => void;
	provideContext(ctx: { tools: McpToolDefinition[] }): void;
	listTools(): Array<Omit<McpToolDefinition, 'execute'>>;
	callTool(name: string, args?: Record<string, unknown>): Promise<McpToolResult>;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
	__isGuidedTourShim?: boolean;
}

function ensureModelContext(): ModelContextLike {
	const nav = navigator as unknown as { modelContext?: ModelContextLike };
	if (nav.modelContext) return nav.modelContext;

	const tools = new Map<string, McpToolDefinition>();
	const bus = new EventTarget();
	const emit = () => bus.dispatchEvent(new Event('toolschanged'));

	const shim: ModelContextLike = {
		registerTool(tool) {
			tools.set(tool.name, tool);
			emit();
			return () => {
				tools.delete(tool.name);
				emit();
			};
		},
		provideContext(ctx) {
			for (const t of ctx.tools ?? []) this.registerTool(t);
		},
		listTools() {
			return [...tools.values()].map(({ execute: _execute, ...meta }) => meta);
		},
		async callTool(name, args) {
			const tool = tools.get(name);
			if (!tool) {
				return {
					content: [{ type: 'text', text: `No tool named "${name}" is registered.` }],
					isError: true,
				};
			}
			return tool.execute(args ?? {});
		},
		addEventListener: bus.addEventListener.bind(bus),
		removeEventListener: bus.removeEventListener.bind(bus),
		__isGuidedTourShim: true,
	};

	nav.modelContext = shim;
	return shim;
}

/* --------------------------- element resolution --------------------------- */

const IMPLICIT_ROLE: Record<string, string> = {
	button: 'button,[type="button"],[type="submit"],[role="button"]',
	link: 'a[href],[role="link"]',
	heading: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
	textbox: 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,[role="textbox"]',
	checkbox: 'input[type="checkbox"],[role="checkbox"]',
	combobox: 'select,[role="combobox"]',
	list: 'ul,ol,[role="list"]',
	tab: '[role="tab"]',
	region: 'section,[role="region"]',
};

function accessibleName(el: Element): string {
	return (
		el.getAttribute('aria-label') ||
		el.getAttribute('title') ||
		(el as HTMLElement).innerText ||
		el.textContent ||
		''
	)
		.replace(/\s+/g, ' ')
		.trim();
}

function domDepth(el: Element): number {
	let d = 0;
	let n: Element | null = el;
	while ((n = n.parentElement)) d++;
	return d;
}

function byText(text: string, scope: ParentNode): Element | null {
	const needle = text.replace(/\s+/g, ' ').trim().toLowerCase();
	if (!needle) return null;
	const all = Array.from(scope.querySelectorAll<HTMLElement>('*'));
	const exact: Element[] = [];
	const partial: Element[] = [];
	for (const el of all) {
		if (el.closest('.wmcp-tour-host')) continue;
		const own = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
		if (!own) continue;
		if (own === needle) exact.push(el);
		else if (own.includes(needle) && own.length < needle.length + 80) partial.push(el);
	}
	const pick = (exact.length ? exact : partial).sort((a, b) => domDepth(b) - domDepth(a));
	return pick[0] ?? null;
}

export function resolveElement(ref: ElementRef): Element | null {
	if (ref instanceof Element) return ref;

	if (typeof ref === 'string') {
		try {
			const hit = document.querySelector(ref);
			if (hit) return hit;
		} catch {
			/* not a valid selector — fall through to text */
		}
		return byText(ref, document);
	}

	const q = ref as ElementQuery;
	const nth = q.nth ?? 0;
	const scope: ParentNode = q.within ? document.querySelector(q.within) ?? document : document;

	if (q.selector) {
		const list = Array.from(scope.querySelectorAll(q.selector));
		if (list.length) return list[Math.min(nth, list.length - 1)] ?? null;
	}

	if (q.tourId) {
		const list = Array.from(scope.querySelectorAll(`[data-tour-id="${CSS.escape(q.tourId)}"]`));
		if (list.length) return list[Math.min(nth, list.length - 1)] ?? null;
	}

	if (q.role) {
		const sel = IMPLICIT_ROLE[q.role] ?? `[role="${CSS.escape(q.role)}"]`;
		let list = Array.from(scope.querySelectorAll(sel));
		if (q.name) {
			const needle = q.name.toLowerCase();
			list = list.filter((el) => accessibleName(el).toLowerCase().includes(needle));
		}
		if (list.length) return list[Math.min(nth, list.length - 1)] ?? null;
	}

	if (q.text) return byText(q.text, scope);
	if (q.name) return byText(q.name, scope);

	return null;
}

function describe(el: Element): string {
	const tag = el.tagName.toLowerCase();
	const id = el.id ? `#${el.id}` : '';
	const tourId = el.getAttribute('data-tour-id');
	const name = accessibleName(el).slice(0, 60);
	const cls =
		typeof el.className === 'string' && el.className
			? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
			: '';
	return [
		`<${tag}${id}${cls}>`,
		tourId ? `data-tour-id="${tourId}"` : '',
		name ? `"${name}"` : '',
	]
		.filter(Boolean)
		.join(' ');
}

function isRenderable(el: Element): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.width < 1 && rect.height < 1) return false;
	const cs = getComputedStyle(el);
	return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
}

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ------------------------------ the overlay ------------------------------ */

const CSS_TEXT = `
:host { all: initial; }
.layer {
	position: fixed; inset: 0; z-index: 2147483000;
	pointer-events: none;
	font: 14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
.layer.modal { pointer-events: auto; }
.spot {
	position: fixed; border-radius: 10px;
	box-shadow: 0 0 0 100vmax rgba(2, 6, 23, 0.55);
	transition: all .28s cubic-bezier(.4, 0, .2, 1);
	pointer-events: none;
}
.ring {
	position: fixed; border-radius: 12px;
	box-shadow: 0 0 0 3px var(--accent, #7c3aed),
		0 0 0 6px color-mix(in srgb, var(--accent, #7c3aed) 35%, transparent),
		0 0 26px 6px color-mix(in srgb, var(--accent, #7c3aed) 55%, transparent);
	transition: all .28s cubic-bezier(.4, 0, .2, 1);
	pointer-events: none;
	animation: wmcp-pulse 2.1s ease-in-out infinite;
}
@keyframes wmcp-pulse {
	0%, 100% { box-shadow: 0 0 0 3px var(--accent, #7c3aed),
		0 0 0 6px color-mix(in srgb, var(--accent, #7c3aed) 30%, transparent),
		0 0 20px 4px color-mix(in srgb, var(--accent, #7c3aed) 45%, transparent); }
	50% { box-shadow: 0 0 0 3px var(--accent, #7c3aed),
		0 0 0 9px color-mix(in srgb, var(--accent, #7c3aed) 22%, transparent),
		0 0 34px 10px color-mix(in srgb, var(--accent, #7c3aed) 60%, transparent); }
}
.chip {
	position: fixed; transform: translateY(-100%);
	background: var(--accent, #7c3aed); color: #fff;
	padding: 3px 9px; border-radius: 7px 7px 7px 0;
	font-size: 12px; font-weight: 600; letter-spacing: .01em;
	white-space: nowrap; pointer-events: none;
	box-shadow: 0 4px 14px rgba(0, 0, 0, .3);
}
.callout {
	position: fixed; max-width: min(340px, calc(100vw - 24px));
	background: Canvas; color: CanvasText;
	border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
	border-radius: 12px; padding: 14px 15px 12px;
	box-shadow: 0 12px 40px rgba(2, 6, 23, .35);
	pointer-events: auto;
	transition: top .2s ease, left .2s ease;
}
.callout h3 {
	margin: 0 0 5px; font-size: 14px; font-weight: 700;
	padding-right: 18px;
}
.callout p { margin: 0 0 8px; }
.callout .hint {
	margin: 8px 0 0; padding: 7px 9px; border-radius: 8px;
	background: color-mix(in srgb, var(--accent, #7c3aed) 12%, transparent);
	border-left: 2px solid var(--accent, #7c3aed);
	font-size: 13px;
}
.callout .foot {
	display: flex; align-items: center; gap: 8px; margin-top: 11px;
}
.callout .count { font-size: 12px; opacity: .6; margin-right: auto; }
.callout button {
	font: inherit; font-size: 13px; font-weight: 600;
	border-radius: 8px; padding: 5px 12px; cursor: pointer;
	border: 1px solid color-mix(in srgb, CanvasText 22%, transparent);
	background: transparent; color: inherit;
}
.callout button.primary {
	background: var(--accent, #7c3aed); border-color: transparent; color: #fff;
}
.callout .x {
	position: absolute; top: 8px; right: 9px;
	border: 0; background: transparent; font-size: 16px; line-height: 1;
	padding: 2px; opacity: .55;
}
@media (prefers-reduced-motion: reduce) {
	.spot, .ring, .callout { transition: none; }
	.ring { animation: none; }
}
`;

class Overlay {
	private host: HTMLDivElement;
	private root: ShadowRoot;
	private layer: HTMLDivElement;
	private spot: HTMLDivElement;
	private ring: HTMLDivElement;
	private chip: HTMLDivElement;
	private callout: HTMLDivElement | null = null;
	private target: Element | null = null;
	private tracking = false;
	private lastRect = '';
	private onKey: (e: KeyboardEvent) => void;
	private accent: string;

	constructor(accent: string) {
		this.accent = accent;
		this.host = document.createElement('div');
		this.host.className = 'wmcp-tour-host';
		this.host.setAttribute('data-webmcp', 'guided-tour');
		this.root = this.host.attachShadow({ mode: 'open' });

		const style = document.createElement('style');
		style.textContent = CSS_TEXT;
		this.root.appendChild(style);

		this.layer = el('div', 'layer');
		this.layer.style.setProperty('--accent', accent);
		this.spot = el('div', 'spot');
		this.ring = el('div', 'ring');
		this.chip = el('div', 'chip');
		this.spot.hidden = this.ring.hidden = this.chip.hidden = true;
		this.layer.append(this.spot, this.ring, this.chip);
		this.root.appendChild(this.layer);
		document.body.appendChild(this.host);

		this.onKey = (e) => {
			if (e.key === 'Escape') this.hide('escape');
		};
	}

	private track = () => {
		if (!this.tracking || !this.target) return;
		if (!this.target.isConnected) {
			this.hide('auto');
			return;
		}
		const r = this.target.getBoundingClientRect();
		const key = `${r.top}|${r.left}|${r.width}|${r.height}`;
		if (key !== this.lastRect) {
			this.lastRect = key;
			this.place(r);
		}
		requestAnimationFrame(this.track);
	};

	private place(r: DOMRect) {
		const pad = 6;
		for (const box of [this.spot, this.ring]) {
			box.style.top = `${r.top - pad}px`;
			box.style.left = `${r.left - pad}px`;
			box.style.width = `${r.width + pad * 2}px`;
			box.style.height = `${r.height + pad * 2}px`;
		}
		this.chip.style.top = `${r.top - pad - 4}px`;
		this.chip.style.left = `${r.left - pad}px`;
		if (this.callout) this.placeCallout(r);
	}

	private placeCallout(r: DOMRect) {
		const c = this.callout!;
		const gap = 14;
		const cw = c.offsetWidth || 320;
		const ch = c.offsetHeight || 160;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let top: number;
		let left: number;
		if (vh - r.bottom > ch + gap) top = r.bottom + gap;
		else if (r.top > ch + gap) top = r.top - ch - gap;
		else top = Math.max(gap, Math.min(vh - ch - gap, r.top));

		left = r.left + r.width / 2 - cw / 2;
		left = Math.max(gap, Math.min(vw - cw - gap, left));
		c.style.top = `${Math.round(top)}px`;
		c.style.left = `${Math.round(left)}px`;
	}

	async show(target: Element, opts: HighlightOptions) {
		this.detachCallout();
		this.target = target;
		this.layer.classList.toggle('modal', !!opts.modal);
		this.spot.style.boxShadow = opts.modal
			? '0 0 0 100vmax rgba(2, 6, 23, 0.66)'
			: '0 0 0 100vmax rgba(2, 6, 23, 0.42)';

		if (opts.scrollIntoView !== false) {
			const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
			target.scrollIntoView({
				behavior: reduce ? 'auto' : 'smooth',
				block: 'center',
				inline: 'center',
			});
			await sleep(reduce ? 0 : 320);
		}

		this.spot.hidden = false;
		this.ring.hidden = false;
		if (opts.label) {
			this.chip.textContent = opts.label;
			this.chip.hidden = false;
		} else {
			this.chip.hidden = true;
		}

		this.lastRect = '';
		this.place(target.getBoundingClientRect());
		if (!this.tracking) {
			this.tracking = true;
			addEventListener('scroll', this.track, { passive: true, capture: true });
			addEventListener('resize', this.track, { passive: true });
			addEventListener('keydown', this.onKey);
			requestAnimationFrame(this.track);
		}
	}

	private hideResolve: ((by: HighlightResult['dismissedBy']) => void) | null = null;

	attachCallout(ctx: TourContext, mode: 'none' | 'dismiss'): Promise<HighlightResult['dismissedBy']> {
		this.detachCallout();
		const c = el('div', 'callout') as HTMLDivElement;
		c.setAttribute('role', 'dialog');
		c.setAttribute('aria-live', 'polite');
		c.style.setProperty('--accent', this.accent);

		const close = el('button', 'x') as HTMLButtonElement;
		close.setAttribute('aria-label', 'Close');
		close.textContent = '×';
		c.appendChild(close);

		if (ctx.title) {
			const h = document.createElement('h3');
			h.textContent = ctx.title;
			c.appendChild(h);
		}
		const p = document.createElement('p');
		p.textContent = ctx.explanation;
		c.appendChild(p);

		if (ctx.actionHint) {
			const hint = el('div', 'hint');
			hint.textContent = ctx.actionHint;
			c.appendChild(hint);
		}

		const foot = el('div', 'foot');
		if (ctx.step && ctx.totalSteps) {
			const count = el('span', 'count');
			count.textContent = `Step ${ctx.step} of ${ctx.totalSteps}`;
			foot.appendChild(count);
		}
		const done = el('button', 'primary') as HTMLButtonElement;
		const isLast = !ctx.step || !ctx.totalSteps || ctx.step >= ctx.totalSteps;
		done.textContent = mode === 'dismiss' ? (isLast ? 'Done' : 'Next') : 'Got it';
		foot.appendChild(done);
		c.appendChild(foot);

		this.callout = c;
		this.layer.appendChild(c);
		this.placeCallout(this.target!.getBoundingClientRect());

		return new Promise<HighlightResult['dismissedBy']>((resolve) => {
			const finish = (by: HighlightResult['dismissedBy']) => {
				this.hideResolve = null;
				resolve(by);
			};
			this.hideResolve = finish;
			close.addEventListener('click', () => this.hide('close'));
			done.addEventListener('click', () =>
				this.hide(mode === 'dismiss' ? (isLast ? 'done' : 'next') : 'done'),
			);
			if (mode === 'none') {
				// Resolve immediately; the callout stays on screen for the user.
				requestAnimationFrame(() => finish('auto'));
			}
		});
	}

	private detachCallout() {
		this.callout?.remove();
		this.callout = null;
	}

	hide(by: HighlightResult['dismissedBy'] = 'auto') {
		this.tracking = false;
		removeEventListener('scroll', this.track, { capture: true } as EventListenerOptions);
		removeEventListener('resize', this.track);
		removeEventListener('keydown', this.onKey);
		this.spot.hidden = this.ring.hidden = this.chip.hidden = true;
		this.layer.classList.remove('modal');
		this.detachCallout();
		this.target = null;
		this.hideResolve?.(by);
	}

	destroy() {
		this.hide();
		this.host.remove();
	}
}

function el(tag: string, className: string): HTMLElement {
	const node = document.createElement(tag);
	node.className = className;
	return node;
}

/* ---------------------------- reveal handshake ---------------------------- */

async function revealIfHidden(el: Element | null, ref: ElementRef): Promise<Element | null> {
	const dispatch = (element: Element | null) =>
		document.dispatchEvent(
			new CustomEvent('webmcp:reveal', {
				bubbles: true,
				cancelable: true,
				detail: { element, reference: ref },
			}),
		);

	if (el && isRenderable(el)) return el;

	// Either not found at all, or found but not on screen. Ask the host to
	// bring it forward (switch tab / expand accordion / open drawer), then
	// poll briefly for it to settle.
	dispatch(el);
	for (let i = 0; i < 24; i++) {
		await raf();
		const found = el && el.isConnected ? el : resolveElement(ref);
		if (found && isRenderable(found)) return found;
	}
	return el && el.isConnected ? el : resolveElement(ref);
}

/* ------------------------------- the layer ------------------------------- */

let singleton: GuidedTourLayer | null = null;

export interface InstallOptions {
	/** Accent colour for the ring / chip / callout. Default #7c3aed. */
	accent?: string;
	/** Register the MCP tools with a prefix, e.g. `acme.highlight`. */
	toolPrefix?: string;
}

export function installGuidedTourLayer(opts: InstallOptions = {}): GuidedTourLayer {
	if (singleton) return singleton;
	const accent = opts.accent ?? '#7c3aed';
	const prefix = opts.toolPrefix ? `${opts.toolPrefix}.` : '';
	const mcp = ensureModelContext();
	const overlay = new Overlay(accent);
	const unregisters: Array<() => void> = [];

	const announce = (name: string, detail: unknown) =>
		document.dispatchEvent(new CustomEvent(`webmcp:${name}`, { bubbles: true, detail }));

	async function highlight(ref: ElementRef, o: HighlightOptions = {}): Promise<HighlightResult> {
		const initial = resolveElement(ref);
		const target = await revealIfHidden(initial, ref);
		if (!target) {
			return { ok: false, message: `Could not find an element for ${JSON.stringify(ref)}.` };
		}
		await overlay.show(target, o);
		const described = describe(target);
		announce('highlight', { ref, described });
		return { ok: true, message: `Highlighted ${described}.`, described };
	}

	async function highlightWithContext(
		ref: ElementRef,
		context: TourContext | string,
		o: HighlightWithContextOptions = {},
	): Promise<HighlightResult> {
		const ctx: TourContext = typeof context === 'string' ? { explanation: context } : context;
		const base = await highlight(ref, o);
		if (!base.ok) return base;
		const mode = o.await ?? 'none';
		const dismissedBy = await overlay.attachCallout(ctx, mode);
		announce('context', { ref, context: ctx, described: base.described });
		return {
			ok: true,
			message:
				mode === 'dismiss'
					? `User acknowledged the note on ${base.described} (${dismissedBy}).`
					: `Highlighted ${base.described} with a teaching note.`,
			described: base.described,
			dismissedBy,
		};
	}

	/* ----- MCP tool wrappers ----- */

	const commonProps = {
		selector: { type: 'string', description: 'CSS selector for the target element.' },
		text: {
			type: 'string',
			description: 'Visible text of the target, used when no selector is given.',
		},
		tourId: { type: 'string', description: "Value of the element's data-tour-id attribute." },
		role: {
			type: 'string',
			description: 'ARIA role of the target: button, link, heading, textbox, checkbox, tab, ...',
		},
		name: { type: 'string', description: 'Accessible name, pairs with role to disambiguate.' },
		modal: {
			type: 'boolean',
			description: 'Dim and block the rest of the page until dismissed. Default false.',
		},
	};

	const toQuery = (a: Record<string, unknown>): ElementRef => ({
		selector: a.selector as string | undefined,
		text: a.text as string | undefined,
		tourId: a.tourId as string | undefined,
		role: a.role as string | undefined,
		name: a.name as string | undefined,
	});

	const result = (r: HighlightResult): McpToolResult => ({
		content: [{ type: 'text', text: r.message }],
		isError: !r.ok,
	});

	unregisters.push(
		mcp.registerTool({
			name: `${prefix}highlight`,
			description:
				'Visually highlight any element on the current page so the user can see exactly what you are talking about. Point at it with a CSS selector, its visible text, a data-tour-id, or a role + name. Use this instead of describing where something is.',
			inputSchema: {
				type: 'object',
				properties: {
					...commonProps,
					label: { type: 'string', description: 'Short caption chip to show on the highlight.' },
				},
			},
			async execute(a) {
				return result(await highlight(toQuery(a), { label: a.label as string, modal: !!a.modal }));
			},
		}),
	);

	unregisters.push(
		mcp.registerTool({
			name: `${prefix}highlight_with_context`,
			description:
				'Highlight any element AND pin a short teaching note to it explaining what it does and why it matters. Prefer this over a plain chat instruction: the user sees the real control and learns the concept instead of blindly following steps. Chain several calls to build a guided tour.',
			inputSchema: {
				type: 'object',
				required: ['explanation'],
				properties: {
					...commonProps,
					explanation: {
						type: 'string',
						description: 'What this element is and why it matters, in one or two sentences.',
					},
					title: { type: 'string', description: 'Optional bold heading for the note.' },
					actionHint: {
						type: 'string',
						description: 'Optional "now do this" nudge shown under the explanation.',
					},
					step: { type: 'number', description: '1-based step number in a multi-step tour.' },
					totalSteps: { type: 'number', description: 'Total number of steps in the tour.' },
					waitForUser: {
						type: 'boolean',
						description:
							'If true, the call resolves only once the user clicks Next/Done. Use it to pace a guided tour. Default false.',
					},
				},
			},
			async execute(a) {
				return result(
					await highlightWithContext(
						toQuery(a),
						{
							explanation: String(a.explanation ?? ''),
							title: a.title as string | undefined,
							actionHint: a.actionHint as string | undefined,
							step: a.step as number | undefined,
							totalSteps: a.totalSteps as number | undefined,
						},
						{ modal: !!a.modal, await: a.waitForUser ? 'dismiss' : 'none' },
					),
				);
			},
		}),
	);

	unregisters.push(
		mcp.registerTool({
			name: `${prefix}clear_highlights`,
			description: 'Remove any highlight and teaching note currently on the page.',
			inputSchema: { type: 'object', properties: {} },
			async execute() {
				overlay.hide('auto');
				return { content: [{ type: 'text', text: 'Cleared.' }] };
			},
		}),
	);

	unregisters.push(
		mcp.registerTool({
			name: `${prefix}list_landmarks`,
			description:
				'List the notable, targetable elements on the current page (anything with a data-tour-id, plus headings and buttons) so you can plan a tour without guessing selectors.',
			inputSchema: { type: 'object', properties: {} },
			async execute() {
				const seen = new Set<Element>();
				const rows: string[] = [];
				const push = (el: Element, kind: string) => {
					if (seen.has(el) || el.closest('.wmcp-tour-host')) return;
					seen.add(el);
					const tourId = el.getAttribute('data-tour-id');
					const ref = tourId
						? `tourId="${tourId}"`
						: el.id
							? `selector="#${el.id}"`
							: `text=${JSON.stringify(accessibleName(el).slice(0, 40))}`;
					rows.push(`- [${kind}] ${accessibleName(el).slice(0, 60) || '(no text)'} → ${ref}`);
				};
				document.querySelectorAll('[data-tour-id]').forEach((el) => push(el, 'landmark'));
				document.querySelectorAll('h1,h2,h3').forEach((el) => push(el, 'heading'));
				document
					.querySelectorAll('button,[role="button"],a[href]')
					.forEach((el) => push(el, 'control'));
				return {
					content: [
						{
							type: 'text',
							text: rows.length
								? `${rows.length} targetable elements:\n${rows.join('\n')}`
								: 'No obvious landmarks found on this page.',
						},
					],
				};
			},
		}),
	);

	singleton = {
		highlight,
		highlightWithContext,
		clear: () => overlay.hide('auto'),
		dispose: () => {
			unregisters.forEach((u) => u());
			overlay.destroy();
			singleton = null;
		},
		modelContext: mcp,
	};
	return singleton;
}

/* ---- UMD-ish global for no-bundler use ---- */
declare global {
	interface Window {
		WebMCPGuidedTour?: {
			install: typeof installGuidedTourLayer;
			resolveElement: typeof resolveElement;
		};
	}
}
if (typeof window !== 'undefined') {
	window.WebMCPGuidedTour = { install: installGuidedTourLayer, resolveElement };
}
