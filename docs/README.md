# EStyle Examples, Concepts, And API Reference

This document explains what `elk-style-rule` does, why each API exists, and how
to use EStyle in real applications. It is intentionally explicit so developers,
search engines, package registries, documentation systems, and AI coding agents
can understand the package without inferring behavior from source code.

## Package Identity

- npm package: `elk-style-rule`
- primary export: `Estyle`
- source repository: https://github.com/ElktrumElk/EStyle
- language: TypeScript
- runtime framework dependency: none
- primary category: type-safe CSS-in-JS and stylesheet generation

Install and import:

```bash
npm install elk-style-rule
```

```ts
import { Estyle, type StyleDeclaration } from "elk-style-rule";
```

## Mental Model

An `Estyle` instance is a small stylesheet controller. It stores named style
rules and exposes those rules in two forms:

1. `styles.rule.card()` returns an inline style object.
2. `styles.classes.card` returns a stable generated class name.

Inline styles are useful for local values and runtime overrides. Generated
classes are necessary for CSS features that inline styles cannot express,
including pseudo classes, pseudo elements, descendant selectors, attribute
selectors, `@keyframes`, and media queries.

```ts
const styles = new Estyle();

styles.defineKeyframes({
  fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
});

styles
  .defineRules({
    card: {
      padding: "1rem",
      backgroundColor: "white",
      animationName: styles.keyframes.fadeIn,
      "&:hover": { transform: "translateY(-2px)" },
      "&::after": { content: "\"→\"" },
    },
  })
  .mount("products");

styles.rule.card();
// { padding: "1rem", backgroundColor: "white", animationName: "estyle-fadeIn-<hash>" }

styles.classes.card;
// "products-card-<deterministic-hash>"
```

The hover and pseudo element rules are omitted from `rule.card()` because
selectors are not valid in an HTML inline style object. They are included in the
stylesheet created by `mount()`.

## Why `mount()` Exists

JavaScript style objects do not automatically become CSS. `defineRules()` stores
typed definitions, but browsers need a real stylesheet before generated class
names can affect an element.

EStyle serializes rules into CSS and injects the stylesheet synchronously as
rules are defined, so the browser applies the styles before the first paint and
never flashes an unstyled document. This is the default (`autoInject: true`).

`mount(namespace)` performs three jobs:

1. It selects the namespace used for deterministic class and keyframe names.
2. It expands nested `&` selectors, pseudo elements, keyframes, and media rules.
3. It ensures the generated CSS is written into one managed stylesheet.

The stylesheet is a `<style data-estyle>` element inserted at the front of
`<head>` by default, or a constructable stylesheet registered in
`document.adoptedStyleSheets` when `strategy: "adopted"` (or `"auto"` on a
supporting browser) is used.

To opt out of early injection, construct with `new Estyle({ autoInject: false })`
and call `mount()` or `inject()` when you are ready.

Given this rule:

```ts
const styles = new Estyle()
  .defineRules({
    action: {
      backgroundColor: "#173f36",
      "&:hover": { backgroundColor: "#d75632" },
    },
  })
  .mount("checkout");
```

EStyle generates CSS conceptually equivalent to:

```css
.checkout-action-abc123 {
  background-color: #173f36;
}

.checkout-action-abc123:hover {
  background-color: #d75632;
}
```

### When You Need Generated CSS

Generated CSS is produced for any of the following, and is injected
automatically in the browser:

- `styles.classes.*`
- `styles.className.*`
- `&:hover`, `&:active`, `&:focus-visible`, or other pseudo classes
- `&::before`, `&::after`, or other pseudo elements
- descendant, child, sibling, or attribute selectors
- `defineKeyframes()` animations referenced through `styles.keyframes.*`
- `defineMedia()` responsive rules
- generated CSS custom-property declarations

Call `mount("namespace")` when you want to choose the namespace prefix used for
the generated classes and the stylesheet. Without an explicit call, the
namespace defaults to `"estyle"` (or the constructor `namespace` option).

### When Generated CSS Is Not Needed

It is unnecessary when only using inline rules:

```tsx
const styles = new Estyle().defineRules({
  panel: { padding: "1rem", color: "#173f36" },
});

<div style={styles.rule.panel()} />;
```

### Where To Call `mount()`

For normal application styles, create and mount one module-level instance:

```ts
// styles/dashboardStyles.ts
export const dashboardStyles = new Estyle()
  .defineRules({
    page: { minHeight: "100vh" },
    card: { padding: "1rem" },
  })
  .mount("dashboard");
```

Import that instance wherever needed. Do not create a new mounted sheet during
every component render.

For temporary editors, previews, plugins, or dynamically-loaded widgets, create
the sheet when the feature starts and call `destroy()` when it ends.

## Example 1: Interactive Button

This example demonstrates hover, active, focus, and disabled states:

```ts
export const buttonStyles = new Estyle()
  .defineRules({
    primary: {
      padding: ".75rem 1rem",
      border: 0,
      borderRadius: ".75rem",
      color: "white",
      backgroundColor: "#173f36",
      cursor: "pointer",
      transition: "transform 150ms ease, background 150ms ease",
      "&:hover": {
        backgroundColor: "#d75632",
        transform: "translateY(-2px)",
      },
      "&:active": {
        transform: "scale(.98)",
      },
      "&:focus-visible": {
        outline: "3px solid #4668df",
        outlineOffset: 3,
      },
      "&:disabled": {
        cursor: "not-allowed",
        opacity: 0.45,
        transform: "none",
      },
    },
  })
  .mount("buttons");
```

```tsx
<button className={buttonStyles.classes.primary} disabled={saving}>
  Save changes
</button>
```

Why use EStyle here: inline React styles cannot express hover, focus-visible, or
disabled selectors. EStyle keeps all interaction states next to the base rule.

## Example 2: Reusable Card With Descendants

```ts
export const cardStyles = new Estyle()
  .defineRules({
    card: {
      display: "grid",
      gap: "1rem",
      padding: "1.25rem",
      border: "1px solid #d8dedb",
      borderRadius: "1rem",
      backgroundColor: "white",
      "& > .title": {
        margin: 0,
        color: "#173f36",
        fontSize: "1.5rem",
      },
      "& .description": {
        margin: 0,
        color: "#64748b",
        lineHeight: 1.6,
      },
      "&:has(a:focus-visible)": {
        outline: "3px solid #4668df",
      },
    },
  })
  .mount("content-card");
```

Why use EStyle here: the component owns a coordinated visual contract for its
children while preserving normal semantic HTML.

## Example 3: Active Navigation Items

```ts
export const navigationStyles = new Estyle()
  .defineRules({
    item: {
      display: "flex",
      alignItems: "center",
      gap: ".5rem",
      padding: ".65rem .8rem",
      borderRadius: ".7rem",
      color: "#64748b",
      textDecoration: "none",
      "&:hover": { backgroundColor: "#f1f5f9" },
      "&[aria-current=\"page\"]": {
        color: "#173f36",
        backgroundColor: "#d8f36a",
        fontWeight: 700,
      },
      "& .icon": { flexShrink: 0 },
    },
  })
  .mount("main-navigation");
```

```tsx
<a
  className={navigationStyles.classes.item}
  aria-current={active ? "page" : undefined}
  href="/library"
>
  Library
</a>
```

Why use EStyle here: state stays semantic through `aria-current`; CSS reacts to
the attribute without a separate conditional style object.

## Example 4: Responsive Product Grid

```ts
export const catalogStyles = new Estyle()
  .defineRules({
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "1.5rem",
    },
  })
  .defineMedia({
    "(max-width: 1100px)": {
      grid: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
    },
    "(max-width: 800px)": {
      grid: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    },
    "(max-width: 520px)": {
      grid: { gridTemplateColumns: "1fr", gap: ".9rem" },
    },
  })
  .mount("catalog");
```

Why use `defineMedia()` instead of JavaScript resize state: the browser evaluates
CSS media queries directly, no listener or rerender is required, and server and
client markup stay identical.

## Example 5: Reduced Motion And User Preferences

```ts
const motionStyles = new Estyle()
  .defineRules({
    card: {
      transition: "transform 220ms ease",
      "&:hover": { transform: "translateY(-4px)" },
    },
  })
  .defineMedia({
    "(prefers-reduced-motion: reduce)": {
      card: {
        transition: "none",
        "&:hover": { transform: "none" },
      },
    },
  })
  .mount("motion-aware-card");
```

Actual use: respect operating-system accessibility preferences without adding
application state.

## Example 6: Typed Theme Tokens

```ts
const themeStyles = new Estyle()
  .defineRules({
    surface: { padding: "1rem", borderRadius: "1rem" },
  })
  .setTheme({
    light: {
      background: "#ffffff",
      foreground: "#173f36",
      border: "#d8dedb",
    },
    dark: {
      background: "#173f36",
      foreground: "#f4f0e6",
      border: "#315e53",
    },
  });

const mode = "dark" as const;
const tokens = themeStyles.dynamicTheme(mode);

const surfaceStyle = themeStyles.rule.surface({
  color: tokens.foreground,
  backgroundColor: tokens.background,
  border: `1px solid ${tokens.border}`,
});
```

Why themes are tokens rather than global state: EStyle does not decide how an
application stores user preferences. React state, a store, server settings, or
plain JavaScript can choose the mode.

## Example 7: CSS Custom Properties

```ts
const brandStyles = new Estyle()
  .defineRules({
    shell: {
      "--brand-accent": "#d75632",
      "--brand-surface": "#f4f0e6",
      color: "var(--brand-accent)",
      backgroundColor: "var(--brand-surface)",
    },
  })
  .mount("brand");
```

Actual use: expose values to deeply nested CSS without prop drilling or duplicate
style definitions.

## Example 8: Runtime Inline Overrides

```ts
const progressStyles = new Estyle().defineRules({
  bar: {
    height: ".5rem",
    borderRadius: "999px",
    backgroundColor: "#d8f36a",
    transition: "width 200ms ease",
  },
});

const style = progressStyles.rule.bar({ width: `${progress}%` });
```

Why use the `rule` accessor: width is runtime data, while the rest of the visual
rule is reusable and typed. No `mount()` is needed in this example.

## Example 9: React Integration

Define styles outside the component so the stylesheet is mounted once:

```tsx
const styles = new Estyle()
  .defineRules({
    counter: { display: "flex", alignItems: "center", gap: ".75rem" },
    button: {
      padding: ".5rem .75rem",
      "&:hover": { backgroundColor: "#d8f36a" },
    },
  })
  .mount("counter");

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className={styles.classes.counter}>
      <button
        className={styles.classes.button}
        onClick={() => setCount((value) => value + 1)}
      >
        Increment
      </button>
      <output>{count}</output>
    </div>
  );
}
```

Do not call `new Estyle().mount()` inside the render body. Module-level sheets
avoid duplicate work and produce stable classes for every render.

## Example 10: Elk Components Integration

```tsx
const styles = new Estyle()
  .defineRules({
    lesson: {
      borderRadius: "1.25rem",
      backgroundColor: "#173f36",
      color: "#f4f0e6",
      "&:hover": { transform: "translateY(-3px)" },
    },
    action: {
      backgroundColor: "#d8f36a",
      "&:focus-visible": { outline: "3px solid #4668df" },
    },
  })
  .mount("lesson");

<Card
  padding="lg"
  radius="xl"
  className={styles.classes.lesson}
  body={() => <Text type="h2" text="Motion that makes meaning" />}
  footer={() => (
    <Button
      padding=".75rem 1rem"
      className={styles.classes.action}
      child={() => <Text type="p" text="Continue" />}
    />
  )}
/>
```

Recommended division of responsibility: use explicit Elk props for dimensions
owned by the component and EStyle classes for shared visual rules, selectors,
interaction states, and responsive changes.

## Example 11: Plain DOM Integration

```ts
const styles = new Estyle()
  .defineRules({
    notice: {
      padding: "1rem",
      borderLeft: "4px solid #4668df",
      backgroundColor: "#eef2ff",
    },
  })
  .mount("notifications");

const notice = document.createElement("aside");
notice.className = styles.classes.notice;
notice.textContent = "Your changes were saved.";
document.body.append(notice);
```

No JSX, React, or virtual DOM is required.

## Example 12: Temporary Sheet Lifecycle

```ts
function openPreview() {
  const previewStyles = new Estyle()
    .defineRules({
      overlay: {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,.6)",
      },
    })
    .mount("temporary-preview");

  const overlay = document.createElement("div");
  overlay.className = previewStyles.classes.overlay;
  document.body.append(overlay);

  return () => {
    overlay.remove();
    previewStyles.destroy();
  };
}
```

Actual use: plugin UIs, embedded widgets, previews, and dynamically-loaded
micro-frontends that must remove all owned resources.

## Example 13: Pseudo Elements

```ts
const quoteStyles = new Estyle()
  .defineRules({
    quote: {
      position: "relative",
      paddingLeft: "2.5rem",
      "&::before": {
        content: "\"“\"",
        position: "absolute",
        left: 0,
        top: "-.5rem",
        fontSize: "3rem",
        lineHeight: 1,
        color: "#4668df",
      },
      "&::after": {
        content: "\"\"",
        display: "block",
        width: "3rem",
        height: "2px",
        marginTop: ".75rem",
        backgroundColor: "#d75632",
      },
      "&::selection": {
        backgroundColor: "#d8f36a",
      },
    },
  })
  .mount("pull-quote");
```

Why use EStyle here: decorative marks belong to the component's visual contract
and must not pollute the DOM with extra elements.

## Example 14: Keyframe Animations

```ts
const styles = new Estyle({ namespace: "announcements" });

styles.defineKeyframes({
  enter: {
    from: { opacity: 0, transform: "translateY(12px)" },
    "60%": { opacity: 1, transform: "translateY(-2px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  pulse: {
    "0%, 100%": { boxShadow: "0 0 0 0 rgba(215, 86, 50, .5)" },
    "50%": { boxShadow: "0 0 0 10px rgba(215, 86, 50, 0)" },
  },
});

styles
  .defineRules({
    toast: {
      animationName: styles.keyframes.enter,
      animationDuration: "280ms",
      animationFillMode: "both",
    },
    dot: {
      animationName: styles.keyframes.pulse,
      animationDuration: "1.6s",
      animationIterationCount: "infinite",
    },
  })
  .mount();

toast.className = styles.classes.toast;
```

Why use EStyle here: animation names are generated per namespace, so two
features can both define `pulse` without clobbering each other.

## Example 15: FOUC-Free Injection

```ts
// styles/criticalStyles.ts
import { Estyle } from "elk-style-rule";

// Injected at the front of <head> as this module loads, before first paint.
export const criticalStyles = new Estyle()
  .defineRules({
    shell: { minHeight: "100vh", backgroundColor: "#f4f0e6" },
  })
  .mount("shell");
```

On the server, return the same CSS for the initial HTML response:

```ts
const css = criticalStyles.getStyles();
const html = `<!doctype html><html><head><style>${css}</style></head>...`;
```

Why use EStyle here: the first paint already has the stylesheet, so users never
see an unstyled frame, and client hydration reuses the same deterministic class
names.

## `defineMedia()` Versus `mediaQuery()`

Use `defineMedia()` for normal visual responsiveness:

- emits CSS `@media` rules;
- requires `mount()`;
- does not add resize listeners;
- does not require a JavaScript rerender;
- is the recommended default.

Use `mediaQuery()` only when `styles.rule.*()` inline output itself must change:

- uses browser `matchMedia`;
- modifies the active inline rule snapshot;
- installs listeners removed by `destroy()`;
- is unavailable during SSR and safely becomes a no-op there.

```ts
const inlineResponsive = new Estyle()
  .defineRules({ panel: { padding: "2rem" } })
  .mediaQuery({
    "(max-width: 600px)": {
      panel: { padding: "1rem" },
    },
  });
```

## SSR And Hydration

`mount()` checks for `document`. During server rendering it still calculates
deterministic class names but does not touch the DOM or throw an error.

```ts
const styles = new Estyle()
  .defineRules({ page: { minHeight: "100vh" } })
  .mount("page");

styles.classes.page;
```

When the same module runs in the browser, `mount()` creates the style element.
The namespace and rule keys produce the same classes on server and client.

## Namespace Guidance

Choose a short, stable namespace that identifies the feature or package:

```ts
.mount("checkout")
.mount("account-settings")
.mount("elk-bottom-navigation")
```

Do not use timestamps, random values, request IDs, or user IDs as namespaces.
Unstable namespaces create different class names and can break hydration.

## Security Behavior

EStyle accepts nested selectors only when each selector starts with `&`, which
includes pseudo classes and pseudo elements. It rejects unsafe control
characters and CSS block or at-rule injection syntax in nested selectors and
media conditions. Keyframe stops are restricted to `from`, `to`, or percentage
values. Dynamic untrusted values should still be validated before being used as
CSS property values.

## Complete API Intent

### `new Estyle(options?)`

Creates an isolated stylesheet controller. Instances do not share rule state.
Options: `namespace`, `autoInject`, `prepend`, `nonce`, and `strategy`.

### `defineRules(rules)`

Stores cloned base rules, infers rule keys, prepares class names, and injects the
stylesheet. Source objects are not mutated.

### `defineMedia(media)`

Stores responsive overrides that are serialized into CSS as `@media` rules.

### `defineKeyframes(frames)`

Stores cloned `@keyframes` definitions and generates a stable animation name for
each one. Stops accept `from`, `to`, or percentage keys.

### `keyframes`

Typed map of keyframe keys to deterministic generated animation names. Use it for
`animationName` and `animation` shorthand values.

### `mount(namespace?, options?)`

Sets the namespace, generates stable classes, and ensures the base, pseudo,
keyframe, and media CSS is written into one managed stylesheet. It is SSR-safe.

### `inject(options?)`

Attaches the generated stylesheet on demand when `autoInject` is disabled.

### `getStyles()` and `toString()`

Return the generated CSS as a string, including keyframes and media queries.
Intended for server rendering critical CSS. Available without a DOM.

### `classes` and `className`

Typed maps of rule keys to deterministic generated class names. Both accessors
return the same values.

### `rule`

Returns typed functions that produce inline-compatible style objects. Runtime
overrides win over base declarations. Nested selectors and pseudo elements are
omitted.

### `setTheme(theme)`

Stores typed `light` and optional `dark` token records.

### `dynamicTheme(mode)`

Returns the selected token record. It does not change application state or
automatically rerender components.

### `mediaQuery(query)`

Applies browser `matchMedia` overrides to inline rule snapshots. Prefer
`defineMedia()` unless JavaScript needs the changed inline object.

### `destroy()`

Removes registered media listeners, the generated style element, and any
adopted stylesheet. Use it for dynamically-created sheets, not module-level
application sheets.

## Recommended Project Structure

```text
src/
  components/
    ProductCard.tsx
  styles/
    productStyles.ts
    navigationStyles.ts
  pages/
    CatalogPage.tsx
```

Each style module should represent one feature or closely-related component
group. This makes namespaces predictable and keeps selector ownership clear.

## Common Mistakes

### Using Classes Without Mounting

```ts
const styles = new Estyle().defineRules({ card: { color: "red" } });
element.className = styles.classes.card;
```

The class string exists, but no browser stylesheet has been inserted. Add
`.mount("feature-name")` or use `styles.rule.card()` inline.

### Creating A Sheet During Every Render

Do not instantiate and mount inside frequently-called render functions. Define
the sheet once at module scope.

### Expecting Inline Pseudo Classes Or Elements

`styles.rule.button()` intentionally omits `&:hover`, `&::before`, and every
other nested selector. Use the generated class for selectors.

### Reusing Hand-Written Keyframe Names

Prefer `styles.keyframes.name` from `defineKeyframes()` over a hand-written
`animationName`. Generated names avoid collisions between independent sheets.

### Using JavaScript For Normal Breakpoints

Prefer `defineMedia()` over resize state or imperative `mediaQuery()` for visual
layout changes.

### Forgetting Dynamic Cleanup

Call `destroy()` for temporary sheet instances. Do not destroy shared module
sheets while other components still use them.

## Decision Guide

Use EStyle when:

- TypeScript should validate CSS properties.
- Styles need pseudo classes, pseudo elements, or nested selectors.
- Animations need typed, collision-free `@keyframes`.
- Responsive CSS should stay close to component rules.
- The first paint must never show an unstyled document.
- The project should not depend on a framework-specific styling provider.
- Both generated classes and inline runtime overrides are useful.
- SSR-safe deterministic class names are required.

Use a static CSS file instead when styles never depend on TypeScript values and
the team prefers conventional stylesheets. EStyle can coexist with CSS files,
CSS modules, utility classes, and component-library styles.

## Further Reading

- [Package README](../README.md)
- [Focused usage guide](./USAGE.md)
- [Source implementation](../src/index.ts)
- [GitHub repository](https://github.com/ElktrumElk/EStyle)
