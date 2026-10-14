# EStyle

[![npm version](https://img.shields.io/npm/v/elk-style-rule.svg)](https://www.npmjs.com/package/elk-style-rule)
[![license](https://img.shields.io/npm/l/elk-style-rule.svg)](./LICENSE)
[![repository](https://img.shields.io/badge/GitHub-ElktrumElk%2FEStyle-181717?logo=github)](https://github.com/ElktrumElk/EStyle)

Framework-independent, type-safe CSS-in-JS for TypeScript applications.
EStyle uses one typed definition for inline style objects, stable generated
classes, pseudo classes and elements, descendant and attribute selectors,
`@keyframes`, theme tokens, responsive media queries, and instant, FOUC-free
style injection.

## Why EStyle?

- **Type-safe CSS:** property names and values use `csstype` definitions.
- **Real pseudo classes:** define `:hover`, `:active`, `:focus-visible`, and
  `:disabled` beside base styles.
- **Pseudo elements:** style `&::before`, `&::after`, `&::placeholder`,
  `&::selection`, and other pseudo elements with the same nested syntax.
- **Typed `@keyframes`:** define animations once and reuse the generated,
  collision-free animation names.
- **No flash of unstyled content:** the stylesheet is injected synchronously as
  rules are defined, before the first paint, so the page never shows an
  unstyled state.
- **Responsive styling:** generate normal CSS `@media` rules without resize
  listeners or component rerenders.
- **Framework independent:** works with React, Elk Components, Vue, Svelte, and
  plain DOM applications.
- **SSR safe:** class names are deterministic, `mount()` does not fail when
  `document` is unavailable, and `getStyles()` returns critical CSS for the
  server-rendered `<head>`.
- **Small API:** no provider, compiler plugin, runtime JSX transform, or global
  registry is required.
- **Explicit cleanup:** dynamically-created sheets and media listeners can be
  removed with `destroy()`.

## Installation

```bash
npm install elk-style-rule
```

## Quick Start

```ts
import { Estyle } from "elk-style-rule";

export const styles = new Estyle()
  .defineRules({
    button: {
      padding: ".75rem 1rem",
      color: "white",
      backgroundColor: "#173f36",
      border: 0,
      borderRadius: ".75rem",
      transition: "transform 150ms ease, background 150ms ease",
      "&:hover": { backgroundColor: "#d75632" },
      "&:active": { transform: "scale(.98)" },
      "&:focus-visible": { outline: "3px solid #4668df" },
      "&[data-active=\"true\"]": { backgroundColor: "#4668df" },
      "& .icon": { marginRight: ".5rem" },
      "&::before": { content: "\"★\"" },
    },
  })
  .defineMedia({
    "(max-width: 600px)": {
      button: { width: "100%" },
    },
  })
  .mount("account-screen");
```

Apply the generated class with any renderer:

```tsx
<button className={styles.classes.button}>Continue</button>
```

Use the same rule as an inline style object when selectors are not required:

```tsx
<div style={styles.rule.button({ marginTop: "1rem" })} />
```

Nested selectors are intentionally omitted from inline output because browser
inline styles cannot represent pseudo classes or descendant selectors.

## React And Elk Components

EStyle does not require React, but generated classes and inline rules work
naturally with React and Elk Components:

```tsx
<Container
  padding="1rem"
  className={styles.classes.card}
  child={() => <Text type="h2" text="Featured item" />}
/>
```

For users of `elk-components`, the same API is also available from:

```ts
import { Estyle } from "elk-components/style-rule";
```

## Pseudo And Nested Selectors

Every nested selector starts with `&`, which represents the generated class:

```ts
const navigation = new Estyle()
  .defineRules({
    item: {
      color: "#64748b",
      "&:hover, &:focus-visible": { color: "#2563eb" },
      "&[aria-current=\"page\"]": { fontWeight: 700 },
      "& > .label": { overflow: "hidden", textOverflow: "ellipsis" },
    },
  })
  .mount("navigation");
```

Unsafe selector syntax is rejected rather than injected into the generated
stylesheet.

## Pseudo Elements

Pseudo elements use the same `&` nesting and are serialized into the generated
stylesheet with a double colon:

```ts
const card = new Estyle()
  .defineRules({
    card: {
      position: "relative",
      "&::before": { content: "\"\"", position: "absolute", inset: 0 },
      "&::after": { content: "\"→\"", marginLeft: ".25rem" },
      "&::selection": { backgroundColor: "#d8f36a" },
    },
  })
  .mount("card");

card.classes.card; // "card-card-<hash>"
```

Pseudo elements are omitted from `rule.card()` inline output because browser
inline styles cannot express them.

## Keyframes

Define animations with `defineKeyframes()` and reuse the generated, namespaced
animation names through the `keyframes` accessor. This avoids global name
collisions and keeps animation definitions next to the rules that use them:

```ts
const styles = new Estyle();

styles.defineKeyframes({
  fadeIn: {
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
});

styles
  .defineRules({
    card: {
      animationName: styles.keyframes.fadeIn,
      animationDuration: "300ms",
      animationTimingFunction: "ease",
    },
  })
  .mount("keyframes");
```

Keyframe stops accept `from`, `to`, and percentage keys such as `"50%"`. Invalid
stops are rejected rather than emitted. Keyframe names are generated when
`defineKeyframes()` runs; set a constructor `namespace` if you want the keyframe
prefix to match a later `mount()` namespace.

## Instant Injection And No FOUC

By default styles are injected synchronously as soon as rules are defined, not
only when `mount()` runs. The `<style>` element is inserted at the front of
`<head>` so browsers apply it before the first paint and never render an
unstyled document:

```ts
import { Estyle } from "elk-style-rule";

// Injected immediately in the browser; no unstyled first frame.
export const styles = new Estyle()
  .defineRules({ app: { minHeight: "100vh" } })
  .mount("app");
```

Configure injection through the constructor:

```ts
const styles = new Estyle({
  namespace: "app",   // stable class and keyframe prefix
  prepend: true,       // insert before other <head> nodes (default)
  nonce: "csp-nonce",  // Content Security Policy nonce
  strategy: "auto",    // "style" (default), "adopted", or "auto"
  autoInject: true,    // inject during defineRules (default)
});
```

- `autoInject: false` defers injection until `mount()` or `inject()`.
- `inject()` attaches the generated sheet on demand.
- `strategy: "adopted"` uses constructable stylesheets (`document.adoptedStyleSheets`)
  when the browser supports them; `"auto"` prefers them and falls back to a
  `<style>` element.
- `getStyles()` returns the generated CSS for server rendering so critical CSS
  can be inlined directly into the `<head>`, eliminating the flash entirely.

## Responsive Rules

`defineMedia()` emits declarative media queries:

```ts
const layout = new Estyle()
  .defineRules({
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "1.5rem",
    },
  })
  .defineMedia({
    "(max-width: 900px)": {
      grid: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    },
    "(max-width: 600px)": {
      grid: { gridTemplateColumns: "1fr", gap: "1rem" },
    },
  })
  .mount("catalog");
```

## Themes

Theme tokens are typed and renderer-agnostic:

```ts
const themed = new Estyle()
  .defineRules({ surface: { padding: "1rem" } })
  .setTheme({
    light: { background: "#ffffff", foreground: "#173f36" },
    dark: { background: "#173f36", foreground: "#f4f0e6" },
  });

const dark = themed.dynamicTheme("dark");
const surface = themed.rule.surface({
  backgroundColor: dark.background,
  color: dark.foreground,
});
```

## API Summary

| API | Purpose |
| --- | --- |
| `new Estyle(options)` | Configure namespace, injection, prepend, nonce, and strategy |
| `defineRules(rules)` | Define typed base styles and infer rule names |
| `defineMedia(media)` | Generate declarative responsive CSS |
| `defineKeyframes(frames)` | Define typed `@keyframes` and generate stable names |
| `mount(namespace, options?)` | Mount one managed stylesheet and generate classes |
| `inject(options?)` | Attach the generated stylesheet on demand |
| `getStyles()` / `toString()` | Return generated CSS, e.g. for SSR critical CSS |
| `classes` / `className` | Read stable generated class names |
| `keyframes` | Read generated `@keyframes` animation names |
| `rule` | Create selector-free inline style objects |
| `setTheme(theme)` | Store typed light and dark tokens |
| `dynamicTheme(mode)` | Read the selected token record |
| `mediaQuery(rules)` | Apply imperative `matchMedia` overrides to inline rules |
| `destroy()` | Remove generated CSS and registered listeners |

## Documentation

- [Examples, concepts, and complete API intent](./docs/README.md)
- [Complete usage guide](./docs/USAGE.md)
- [Source code](https://github.com/ElktrumElk/EStyle)
- [Issue tracker](https://github.com/ElktrumElk/EStyle/issues)

## Recommended Usage

EStyle is highly recommended when an application needs typed CSS objects and
real pseudo or responsive states without adopting a framework-specific styling
runtime. Keep related rules in a module-level sheet, use explicit component
props for structural dimensions, and use generated classes for shared visual
rules and interaction states.

## Development

```bash
npm install
npm run check
```

## License

[MIT](./LICENSE)
