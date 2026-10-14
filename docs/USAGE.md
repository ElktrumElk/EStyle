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
class remains stable for the same namespace and rule name. In the browser, the
stylesheet is injected as soon as rules are defined (see
[Instant Style Injection](#instant-style-injection)), so `mount()` only needs to
be called when you want to set or change the namespace.

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

## Pseudo Elements

Pseudo elements use the same nested `&` syntax with a double colon:

```ts
const card = new Estyle()
  .defineRules({
    card: {
      position: "relative",
      "&::before": {
        content: "\"\"",
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        backgroundColor: "rgba(70, 104, 223, 0.08)",
      },
      "&::after": {
        content: "\"→\"",
        marginLeft: ".25rem",
        color: "#4668df",
      },
      "&::selection": {
        backgroundColor: "#d8f36a",
      },
    },
  })
  .mount("card");
```

Pseudo elements are omitted from `styles.rule.card()` inline output because
browser inline styles cannot express them. Use the generated class instead.

## Keyframes

Declare animations with `defineKeyframes()`. Each animation receives a
namespace-safe generated name, available through the `keyframes` accessor, so
multiple sheets can define the same animation name without colliding:

```ts
const styles = new Estyle();

styles.defineKeyframes({
  fadeIn: {
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  pulse: {
    "0%": { boxShadow: "0 0 0 0 rgba(215, 86, 50, 0.55)" },
    "70%": { boxShadow: "0 0 0 14px rgba(215, 86, 50, 0)" },
    "100%": { boxShadow: "0 0 0 0 rgba(215, 86, 50, 0)" },
  },
});

styles
  .defineRules({
    card: {
      animationName: styles.keyframes.fadeIn,
      animationDuration: "300ms",
      animationFillMode: "both",
    },
    badge: {
      animationName: styles.keyframes.pulse,
      animationIterationCount: "infinite",
      animationDuration: "1.8s",
    },
  })
  .mount("animations");
```

Keyframe stops may be `from`, `to`, or a percentage such as `"50%"`. Any other
stop is rejected instead of being written to the stylesheet. Keyframe names are
generated when `defineKeyframes()` runs. If you want the keyframe prefix to
match a namespace passed later to `mount()`, set the namespace on the
constructor: `new Estyle({ namespace: "animations" })`.

## Instant Style Injection

EStyle injects the generated stylesheet synchronously as rules are defined. The
`<style>` element is inserted at the front of `<head>`, so the browser applies
the styles before the first paint and never renders an unstyled document:

```ts
import { Estyle } from "elk-style-rule";

// Styles are already in the document after this statement in a browser.
export const styles = new Estyle()
  .defineRules({ app: { minHeight: "100vh" } })
  .mount("app");
```

Constructor options control injection:

```ts
const styles = new Estyle({
  namespace: "app",
  prepend: true,
  nonce: "csp-nonce",
  strategy: "auto",
  autoInject: true,
});
```

| Option | Default | Purpose |
| --- | --- | --- |
| `autoInject` | `true` | Inject while rules are defined instead of waiting for `mount()` |
| `namespace` | `"estyle"` | Prefix for generated classes, keyframes, and the style element |
| `prepend` | `true` | Insert the style element before other `<head>` nodes |
| `nonce` | none | Content Security Policy nonce for the style element |
| `strategy` | `"style"` | `"style"`, `"adopted"` (`document.adoptedStyleSheets`), or `"auto"` |

Call `inject()` to attach the sheet on demand when `autoInject` is disabled.
For production server rendering, emit `styles.getStyles()` inside the
server-rendered `<head>`. That sends the critical CSS with the first HTML
response and removes any chance of a flash of unstyled content.

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

For applications that need critical CSS extraction, call `styles.getStyles()` on
the server and inline the result in the document `<head>`. Then mount the same
module-level sheet in the browser. Class names remain deterministic for the
namespace and rule keys, and the inline critical CSS prevents a flash of
unstyled content before the client bundle runs.

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
