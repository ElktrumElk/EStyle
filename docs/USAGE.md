# Estyle Usage Guide

## Installation

```bash
npm install elk-style-rule
```

Import the class wherever a stylesheet is defined:

```ts
import { Estyle } from "elk-style-rule";
```

`elk-style-rule` has no framework runtime dependency. Its generated class names
can be used with React, Vue, Svelte, plain DOM code, or any renderer that accepts
CSS classes and inline style objects.

## Defining Rules

Create one `Estyle` instance for a related group of styles:

```ts
const styles = new Estyle().defineRules({
  card: {
    padding: "1.25rem",
    borderRadius: "1rem",
    color: "#173f36",
    backgroundColor: "#f4f0e6",
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    lineHeight: 1.1,
  },
});
```

Rule names are inferred by TypeScript. `styles.classes.card` is valid, while an
unknown key such as `styles.classes.missing` is a type error.

## Generated Classes

Call `mount()` to generate one style element and obtain stable class names:

```ts
const styles = new Estyle()
  .defineRules({
    card: { padding: "1rem", backgroundColor: "white" },
  })
  .mount("product-screen");

const card = document.createElement("article");
card.className = styles.classes.card;
```

The namespace keeps independently-created sheets readable and isolated. A rule
class remains stable for the same namespace and rule name.

In React or Elk components:

```tsx
<Container
  padding="1rem"
  className={styles.classes.card}
  child={() => <Text type="h2" text="Featured item" />}
/>
```

## Inline Styles

The `rule` accessor returns an inline-compatible object:

```tsx
<Container
  style={styles.rule.card({ maxWidth: "40rem" })}
  child={Content}
/>
```

Overrides are merged after the base rule. Nested selectors are omitted because
browser inline styles cannot represent pseudo classes or descendant selectors.

## Pseudo Classes

Nested selector keys must begin with `&`. The ampersand represents the generated
class selector:

```ts
const controls = new Estyle()
  .defineRules({
    button: {
      color: "white",
      backgroundColor: "#173f36",
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
        opacity: 0.5,
      },
    },
  })
  .mount("controls");
```

## Attributes And Descendants

Attribute, compound, and descendant selectors use the same nested syntax:

```ts
const navigation = new Estyle()
  .defineRules({
    item: {
      color: "#64748b",
      "&[data-active=\"true\"]": {
        color: "#2563eb",
        fontWeight: 700,
      },
      "& .icon": {
        marginRight: ".5rem",
      },
      "& > .label": {
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
    },
  })
  .mount("navigation");
```

Multiple selectors can be grouped when every selector begins with `&`:

```ts
{
  "&:hover, &:focus-visible": {
    color: "#2563eb",
  },
}
```

## Responsive Rules

Use `defineMedia()` for CSS media queries. These are emitted into the generated
stylesheet and do not require JavaScript resize listeners:

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
    "(prefers-reduced-motion: reduce)": {
      grid: { "& *": { transitionDuration: "0.01ms" } },
    },
  })
  .mount("catalog");
```

`mediaQuery()` remains available when the inline rule itself must change based
on `matchMedia`. Prefer `defineMedia()` for normal responsive design because it
works without rerendering application code.

## Theme Tokens

Themes store typed token records without forcing a rendering framework:

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

Theme tokens are ordinary typed values. Your application controls how the
selected mode is stored and when components rerender.

## CSS Custom Properties

Custom properties can be placed directly in a rule:

```ts
const styles = new Estyle()
  .defineRules({
    shell: {
      "--accent": "#d75632",
      color: "var(--accent)",
    },
  })
  .mount("shell");
```

## Server Rendering

Calling `mount()` without a browser document is safe. Class names are still
available during server rendering:

```ts
const styles = new Estyle()
  .defineRules({ page: { minHeight: "100vh" } })
  .mount("page");

styles.classes.page;
```

For applications that need critical CSS extraction, mount the same module-level
sheet in the browser. Class names remain deterministic for the namespace and
rule keys.

## Cleanup

Module-level stylesheets normally remain mounted for the application lifetime.
Destroy dynamically-created sheets when their owner is disposed:

```ts
const temporary = new Estyle()
  .defineRules({ preview: { opacity: 0.8 } })
  .mount("preview");

temporary.destroy();
```

`destroy()` removes the generated style element and any listeners registered by
imperative `mediaQuery()` calls.

## Recommended Organization

Keep related rules in one module and export the mounted instance:

```ts
// styles/accountStyles.ts
export const accountStyles = new Estyle()
  .defineRules({
    page: { minHeight: "100vh" },
    actions: { display: "flex", gap: ".75rem" },
  })
  .defineMedia({
    "(max-width: 600px)": {
      actions: { flexDirection: "column" },
    },
  })
  .mount("account");
```

Use explicit component props for structural values owned by a component, such
as `padding`, `width`, and `height`. Use Estyle classes for shared appearance,
pseudo states, descendant styling, and responsive overrides.
