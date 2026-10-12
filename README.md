# EStyle

[![npm version](https://img.shields.io/npm/v/elk-style-rule.svg)](https://www.npmjs.com/package/elk-style-rule)
[![license](https://img.shields.io/npm/l/elk-style-rule.svg)](./LICENSE)
[![repository](https://img.shields.io/badge/GitHub-ElktrumElk%2FEStyle-181717?logo=github)](https://github.com/ElktrumElk/EStyle)

Framework-independent, type-safe CSS-in-JS for TypeScript applications.
EStyle uses one typed definition for inline style objects, stable generated
classes, pseudo classes, descendant and attribute selectors, theme tokens, and
responsive media queries.

## Why EStyle?

- **Type-safe CSS:** property names and values use `csstype` definitions.
- **Real pseudo classes:** define `:hover`, `:active`, `:focus-visible`, and
  `:disabled` beside base styles.
- **Responsive styling:** generate normal CSS `@media` rules without resize
  listeners or component rerenders.
- **Framework independent:** works with React, Elk Components, Vue, Svelte, and
  plain DOM applications.
- **SSR safe:** class names are deterministic and `mount()` does not fail when
  `document` is unavailable.
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
| `defineRules(rules)` | Define typed base styles and infer rule names |
| `defineMedia(media)` | Generate declarative responsive CSS |
| `mount(namespace)` | Mount one managed stylesheet and generate classes |
| `classes` / `className` | Read stable generated class names |
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
