# WebMCP guided-tour layer

A ~600-line, dependency-free drop-in that lets an AI agent give a **guided
tour** of a website — highlighting real controls and teaching what they do —
instead of typing "click A, then B, then C" into a chat box.

It follows the [WebMCP](https://github.com/webmachinelearning/webmcp) shape:
the page calls `navigator.modelContext.registerTool(...)` and whatever agent
the browser wires up on the other end can call those tools. If nothing
provides `navigator.modelContext`, the layer installs a small shim so the
page can still drive the tools itself (see the in-page console on
`/lab/guided-tour/`).

## Tools exposed

| tool | what it does |
| --- | --- |
| `highlight` | Make any DOM element stand out (spotlight + glowing ring + optional caption chip). |
| `highlight_with_context` | ...and pin a short teaching note to it. Chain calls, pass `step`/`totalSteps`/`waitForUser` to pace a tour. |
| `clear_highlights` | Remove the current highlight. |
| `list_landmarks` | Enumerate targetable elements so an agent can plan a tour without guessing selectors. |

## Install

```ts
import { installGuidedTourLayer } from './guided-tour-layer';

installGuidedTourLayer({ accent: '#7c3aed' });
```

or without a bundler:

```html
<script type="module" src="/guided-tour-layer.js"></script>
<script>WebMCPGuidedTour.install()</script>
```

## Pointing at "any element"

Every tool takes a permissive element reference — an agent describes the
target the way a person would:

```jsonc
{ "selector": "#save-config" }
{ "text": "Test connection" }
{ "tourId": "wifi-ssid" }
{ "role": "button", "name": "Flash latest" }
```

Resolution order: `selector` → `tourId` → `role` (+`name`) → `text`. A bare
string is tried as a selector first, then as visible text.

## The `webmcp:reveal` handshake

If the target is hidden (inside an inactive tab, a collapsed accordion, a
closed drawer), the layer dispatches a cancelable `webmcp:reveal`
`CustomEvent` on `document` with `{ element, reference }` before it gives up.
The host app listens and brings the element on screen; the layer then polls
briefly and proceeds:

```ts
document.addEventListener('webmcp:reveal', (e) => {
	const section = e.detail.element?.closest('[data-view]');
	if (section) activateView(section.dataset.view);
});
```

## Observability

The layer also emits `webmcp:highlight` and `webmcp:context` events on
`document` after each action, so the host can log or react.

## Notes

- Overlay lives in a shadow root (`.wmcp-tour-host`) so page CSS can't break
  it and its CSS can't leak out.
- Non-modal by default: the dim is visual only and the page stays usable.
  Pass `modal: true` to block interaction.
- Honours `prefers-reduced-motion`.
