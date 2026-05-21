# Mashu — redesigned visuals

This drop-in replaces the original Cloudflare-derivative styling with a custom "Paper" design system:
warm cream + ink, single saffron accent, Inter Tight / JetBrains Mono / Fraunces.

## What changed

All CSS files have been rewritten. The DOM construction in three TypeScript files was also
updated to render the new structure — every behavioral file (`app.ts`, `filesystem.ts`,
`features.ts`, `viewer.ts`, `modals.ts`, `pretext.ts`, `utils/*`, `state.ts`) is unchanged.

### Files updated
- `src/css/app.css` — root tokens, app-shell grid (top bar / side / main / stats / bottom bar)
- `src/css/components.css` — brand, top bar, dropzone, tree controls, bottom bar, buttons, notifications
- `src/css/tree.css` — Paper-styled rows with custom checkboxes + injected size-share bars
- `src/css/viewer.css` — light file viewer chrome
- `src/css/modals.css` — modal restyle
- `src/css/report.css` — text-report panel + the SVG vector tree connectors
- `src/css/stats.css` — hero stat grid + composition strip + type table
- `src/css/dropoverlay.css` — full-page drop overlay restyle
- `src/css/extensions.css` — extension chips + filter pills
- `src/ts/ui/layout.ts` — emits the new DOM (top bar / bottom bar / sidebar reflow) while keeping **every original element ID** so `populateElements` still wires up
- `src/ts/ui/tree.ts` — adds a `.sizebar` element to each row (`createSizeBar()`); everything else preserved
- `src/ts/ui/stats.ts` — populates the hero grid, composition bar/legend, scope pill, side selection counter, and bottom-bar info; falls back to the original report generator

### Files **not** touched
`app.ts`, `features.ts`, `filesystem.ts`, `global.d.ts`, `state.ts`, `types/index.ts`,
`ui/index.ts`, `ui/modals.ts` (the sidebar resizer logic),
`ui/pretext.ts`, `ui/viewer.ts`, `utils/crossbrowser_fs.ts`, `utils/fs_utils.ts`,
`utils/result.ts`.

## How to use

Drop this folder over your existing `mashu/` project. The CSS files replace yours;
`layout.ts` / `tree.ts` / `stats.ts` are the only TS files that change.

`index.html` is included as a reference — if yours already has `<div id="appContainer"></div>`
and loads `/src/ts/app.ts`, you don't need to swap it in. If your existing `index.html` had
explicit `<div id="leftSidebar">`, `<div id="mainView">`, etc. inside `#appContainer`,
those get safely replaced at runtime since the new `layout.ts` rewrites `appContainer.innerHTML`.

## Tokens

All colour, font, and spacing tokens live in `src/css/app.css` under `:root`. Adjust there
to tweak the whole palette in one place.

```css
--ink:      oklch(0.22 0.013 70);
--ink-2:    oklch(0.34 0.013 70);
--ink-3:    oklch(0.50 0.013 70);
--ink-4:    oklch(0.65 0.013 70);
--accent:   oklch(0.62 0.16 50);   /* terracotta — the only chromatic accent */
--bg:       oklch(0.97 0.005 80);
```
