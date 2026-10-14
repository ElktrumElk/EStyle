import type * as CSS from "csstype";

export interface StyleDeclaration extends CSS.Properties<string | number> {
  [selector: `&${string}`]: StyleDeclaration | undefined;
  [customProperty: `--${string}`]: string | number | undefined;
}

type StyleRules = Record<string, StyleDeclaration>;
type ThemeTokens = Record<string, string>;
type KeyframeSteps = Record<string, StyleDeclaration>;
type KeyframeRules = Record<string, KeyframeSteps>;
type RuleAccessor<Rules extends StyleRules> = {
  [Key in keyof Rules]: (overrides?: StyleDeclaration) => CSS.Properties<string | number>;
};
type ClassAccessor<Rules extends StyleRules> = Readonly<{
  [Key in keyof Rules]: string;
}>;
type KeyframeAccessor<Frames extends KeyframeRules> = Readonly<{
  [Key in keyof Frames]: string;
}>;
type MediaRules<Rules extends StyleRules> = Record<
  string,
  Partial<{ [Key in keyof Rules]: StyleDeclaration }>
>;
type Theme<Light extends ThemeTokens, Dark extends ThemeTokens> = {
  light: Light;
  dark?: Dark;
};

/** Controls how the generated stylesheet is attached to the document. */
export type InjectStrategy = "style" | "adopted" | "auto";

/** Configuration for an {@link Estyle} instance. */
export interface EstyleOptions {
  /**
   * Inject the generated stylesheet as soon as rules are defined instead of
   * waiting for `mount()`. Enabled by default so classes are styled on the
   * first paint and the document never flashes an unstyled state.
   */
  autoInject?: boolean;
  /** Namespace used for generated classes, keyframes, and the style element. */
  namespace?: string;
  /** Insert the style element before other `<head>` nodes. Defaults to true. */
  prepend?: boolean;
  /** Content Security Policy nonce applied to the injected style element. */
  nonce?: string;
  /**
   * Injection mechanism. `"style"` uses a `<style>` element (default and the
   * most portable), `"adopted"` uses constructable stylesheets, and `"auto"`
   * prefers adopted stylesheets when the browser supports them.
   */
  strategy?: InjectStrategy;
}

/** Per-call injection overrides accepted by `mount()` and `inject()`. */
export type InjectOptions = Pick<EstyleOptions, "prepend" | "strategy" | "nonce">;

interface ResolvedOptions {
  autoInject: boolean;
  prepend: boolean;
  strategy: InjectStrategy;
  nonce?: string;
}

const unitless = new Set([
  "animationIterationCount", "aspectRatio", "borderImageOutset",
  "borderImageSlice", "borderImageWidth", "columnCount", "flex", "flexGrow",
  "flexShrink", "fontWeight", "gridArea", "gridColumn", "gridColumnEnd",
  "gridColumnStart", "gridRow", "gridRowEnd", "gridRowStart", "lineHeight",
  "opacity", "order", "orphans", "scale", "tabSize", "widows", "zIndex", "zoom",
]);

const cloneStyle = (style: StyleDeclaration): StyleDeclaration => {
  const clone: Record<string, unknown> = {};
  Object.entries(style).forEach(([property, value]) => {
    clone[property] = property.startsWith("&") && value && typeof value === "object"
      ? cloneStyle(value as StyleDeclaration)
      : value;
  });
  return clone as StyleDeclaration;
};

const cloneRules = (rules: StyleRules): StyleRules =>
  Object.fromEntries(Object.entries(rules).map(([name, style]) => [name, cloneStyle(style)]));

const cloneKeyframes = (frames: KeyframeRules): KeyframeRules =>
  Object.fromEntries(Object.entries(frames).map(([name, steps]) => [
    name,
    Object.fromEntries(Object.entries(steps).map(([stop, style]) => [stop, cloneStyle(style)])),
  ]));

const inlineStyle = (style?: StyleDeclaration): CSS.Properties<string | number> =>
  Object.fromEntries(
    Object.entries(style ?? {}).filter(([property, value]) =>
      !property.startsWith("&") && value != null),
  );

const mergeStyle = (base: StyleDeclaration | undefined, override: StyleDeclaration) => {
  const merged = cloneStyle(base ?? {});
  Object.entries(override).forEach(([property, value]) => {
    if (property.startsWith("&") && value && typeof value === "object") {
      const nested = merged as Record<string, StyleDeclaration | undefined>;
      nested[property] = mergeStyle(nested[property], value as StyleDeclaration);
    } else {
      (merged as Record<string, unknown>)[property] = value;
    }
  });
  return merged;
};

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

const safeName = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "style";

const cssProperty = (property: string) => property.startsWith("--")
  ? property
  : property.replace(/^ms([A-Z])/, "-ms-$1").replace(/([A-Z])/g, "-$1").toLowerCase();

const cssValue = (property: string, value: string | number) =>
  typeof value !== "number" || value === 0 || unitless.has(property) || property.startsWith("--")
    ? String(value)
    : `${value}px`;

const declarations = (style: StyleDeclaration) =>
  Object.entries(style)
    .filter(([property, value]) =>
      !property.startsWith("&") &&
      (typeof value === "string" || typeof value === "number") &&
      (/^--[\w-]+$/.test(property) || /^[a-zA-Z][a-zA-Z0-9]*$/.test(property)))
    .map(([property, value]) => `${cssProperty(property)}:${cssValue(property, value as string | number)};`)
    .join("");

const unsafe = (value: string) =>
  [...value].some((character) => character.charCodeAt(0) < 32 || "{};@<>".includes(character));

const expandSelector = (parent: string, nested: string) => {
  if (unsafe(nested) || nested.split(",").some((part) => !part.trim().startsWith("&"))) {
    return undefined;
  }
  return nested.replaceAll("&", parent);
};

const renderStyle = (selector: string, style: StyleDeclaration): string => {
  const own = declarations(style);
  let css = own ? `${selector}{${own}}` : "";
  Object.entries(style).forEach(([nested, value]) => {
    if (!nested.startsWith("&") || !value || typeof value !== "object") return;
    const expanded = expandSelector(selector, nested);
    if (expanded) css += renderStyle(expanded, value as StyleDeclaration);
  });
  return css;
};

const validMedia = (condition: string) => condition.trim().length > 0 && !unsafe(condition);

const keyframeStop = (stop: string) => {
  const value = stop.trim();
  if (value === "from" || value === "to") return value;
  return /^\d+(\.\d+)?%$/.test(value) ? value : undefined;
};

const isBrowser = () =>
  typeof document !== "undefined" && !!document.head;

const supportsAdopted = () =>
  typeof CSSStyleSheet !== "undefined" &&
  CSSStyleSheet.prototype.replaceSync !== undefined &&
  typeof document !== "undefined" &&
  "adoptedStyleSheets" in document;

/** Framework-independent typed style rules and generated stylesheets. */
export class Estyle<
  Rules extends StyleRules = StyleRules,
  Light extends ThemeTokens = ThemeTokens,
  Dark extends ThemeTokens = ThemeTokens,
  Frames extends KeyframeRules = KeyframeRules,
> {
  private rules: StyleRules = {};
  private baseRules: StyleRules = {};
  private mediaRules: Record<string, StyleRules> = {};
  private baseKeyframes: KeyframeRules = {};
  private theme: { light: ThemeTokens; dark: ThemeTokens } = { light: {}, dark: {} };
  private namespace = "estyle";
  private classNames: Readonly<Record<string, string>> = Object.freeze({});
  private keyframeNames: Readonly<Record<string, string>> = Object.freeze({});
  private styleElement?: HTMLStyleElement;
  private sheet?: CSSStyleSheet;
  private adopted = false;
  private mounted = false;
  private options: ResolvedOptions;
  private activeMedia: Array<{ media: MediaQueryList; overrides: StyleRules }> = [];
  private cleanups: Array<() => void> = [];

  constructor(options: EstyleOptions = {}) {
    if (options.namespace) this.namespace = safeName(options.namespace);
    this.options = {
      autoInject: options.autoInject ?? true,
      prepend: options.prepend ?? true,
      strategy: options.strategy ?? "style",
      nonce: options.nonce,
    };
  }

  defineRules<Next extends StyleRules>(rules: Next): Estyle<Next, Light, Dark, Frames> {
    this.baseRules = cloneRules(rules);
    this.applyMedia();
    this.buildClassNames();
    this.sync();
    return this as unknown as Estyle<Next, Light, Dark, Frames>;
  }

  defineMedia(media: MediaRules<Rules>): this {
    this.mediaRules = Object.fromEntries(
      Object.entries(media).map(([condition, rules]) => [condition, cloneRules(rules as StyleRules)]),
    );
    this.sync();
    return this;
  }

  defineKeyframes<NextFrames extends KeyframeRules>(
    frames: NextFrames,
  ): Estyle<Rules, Light, Dark, NextFrames> {
    this.baseKeyframes = cloneKeyframes(frames as KeyframeRules);
    this.buildKeyframeNames();
    this.sync();
    return this as unknown as Estyle<Rules, Light, Dark, NextFrames>;
  }

  setTheme<NextLight extends ThemeTokens, NextDark extends ThemeTokens = Record<string, never>>(
    theme: Theme<NextLight, NextDark>,
  ): Estyle<Rules, NextLight, NextDark, Frames> {
    this.theme = { light: { ...theme.light }, dark: { ...theme.dark } };
    return this as unknown as Estyle<Rules, NextLight, NextDark, Frames>;
  }

  get rule(): RuleAccessor<Rules> {
    return new Proxy({} as RuleAccessor<Rules>, {
      get: (_target, key) => typeof key === "string"
        ? (overrides: StyleDeclaration = {}) => ({
            ...inlineStyle(this.rules[key]),
            ...inlineStyle(overrides),
          })
        : undefined,
    });
  }

  get classes(): ClassAccessor<Rules> {
    return this.classNames as ClassAccessor<Rules>;
  }

  get className(): ClassAccessor<Rules> {
    return this.classes;
  }

  get keyframes(): KeyframeAccessor<Frames> {
    return this.keyframeNames as KeyframeAccessor<Frames>;
  }

  get defineTheme(): { light: Light; dark: Dark } {
    return this.theme as { light: Light; dark: Dark };
  }

  dynamicTheme(mode: "light" | "dark" = "light") {
    return this.theme[mode];
  }

  /** Generated CSS for the current rules, keyframes, and media queries. */
  getStyles(): string {
    return this.renderSheet();
  }

  toString(): string {
    return this.renderSheet();
  }

  mount(namespace?: string, options?: InjectOptions): this;
  mount(options: InjectOptions): this;
  mount(namespaceOrOptions: string | InjectOptions = {}, maybeOptions: InjectOptions = {}): this {
    const options = typeof namespaceOrOptions === "object" ? namespaceOrOptions : maybeOptions;
    if (typeof namespaceOrOptions === "string") this.namespace = safeName(namespaceOrOptions);
    Object.assign(this.options, options);
    this.mounted = true;
    this.buildClassNames();
    this.ensureInjection();
    this.updateSheet();
    return this;
  }

  /** Attach the generated stylesheet immediately, without needing `mount()`. */
  inject(options: InjectOptions = {}): this {
    Object.assign(this.options, options);
    this.ensureInjection();
    this.updateSheet();
    return this;
  }

  mediaQuery(query: Record<string, StyleRules>): this {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return this;
    Object.entries(query).forEach(([condition, overrides]) => {
      const media = window.matchMedia(condition);
      const apply = () => {
        this.applyMedia();
        this.sync();
      };
      this.activeMedia.push({ media, overrides: cloneRules(overrides) });
      media.addEventListener("change", apply);
      this.cleanups.push(() => media.removeEventListener("change", apply));
    });
    this.applyMedia();
    this.sync();
    return this;
  }

  destroy() {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.activeMedia = [];
    this.styleElement?.remove();
    this.styleElement = undefined;
    if (this.sheet && isBrowser() && "adoptedStyleSheets" in document) {
      const current = document.adoptedStyleSheets ?? [];
      document.adoptedStyleSheets = current.filter((candidate) => candidate !== this.sheet);
    }
    this.sheet = undefined;
    this.adopted = false;
    this.mounted = false;
  }

  private applyMedia() {
    this.rules = cloneRules(this.baseRules);
    this.activeMedia.forEach(({ media, overrides }) => {
      if (!media.matches) return;
      Object.entries(overrides).forEach(([key, style]) => {
        this.rules[key] = mergeStyle(this.rules[key], style);
      });
    });
  }

  private buildClassNames() {
    this.classNames = Object.freeze(Object.fromEntries(
      Object.keys(this.baseRules).map((key) => [
        key,
        `${this.namespace}-${safeName(key)}-${hash(`${this.namespace}:${key}`)}`,
      ]),
    ));
  }

  /**
   * Keyframe names are generated once, when keyframes are defined, so the name
   * captured in a rule definition stays valid after `mount()` changes the class
   * namespace. Set `{ namespace }` on the constructor to align both prefixes.
   */
  private buildKeyframeNames() {
    this.keyframeNames = Object.freeze(Object.fromEntries(
      Object.keys(this.baseKeyframes).map((key) => [
        key,
        `${this.namespace}-${safeName(key)}-${hash(`@keyframes:${this.namespace}:${key}`)}`,
      ]),
    ));
  }

  private renderKeyframes() {
    return Object.entries(this.baseKeyframes)
      .map(([key, steps]) => {
        const name = this.keyframeNames[key];
        if (!name) return "";
        const body = Object.entries(steps)
          .map(([stop, style]) => {
            const valid = keyframeStop(stop);
            return valid ? `${valid}{${declarations(style)}}` : "";
          })
          .join("");
        return body ? `@keyframes ${name}{${body}}` : "";
      })
      .join("");
  }

  private renderSheet() {
    let css = this.renderKeyframes();
    css += Object.entries(this.baseRules)
      .map(([key, style]) => renderStyle(`.${this.classNames[key]}`, style))
      .join("");
    Object.entries(this.mediaRules).forEach(([condition, rules]) => {
      if (!validMedia(condition)) return;
      const body = Object.entries(rules)
        .map(([key, style]) => this.classNames[key]
          ? renderStyle(`.${this.classNames[key]}`, style)
          : "")
        .join("");
      if (body) css += `@media ${condition}{${body}}`;
    });
    return css;
  }

  private useAdopted() {
    if (this.options.strategy === "adopted") return true;
    return this.options.strategy === "auto" && supportsAdopted();
  }

  private ensureInjection() {
    if (!isBrowser()) return;
    if (this.useAdopted()) {
      if (this.styleElement) {
        this.styleElement.remove();
        this.styleElement = undefined;
      }
      if (!this.sheet) this.sheet = new CSSStyleSheet();
      const current = document.adoptedStyleSheets ?? [];
      if (!current.includes(this.sheet)) {
        document.adoptedStyleSheets = [...current, this.sheet];
      }
      this.adopted = true;
      return;
    }
    if (this.adopted && this.sheet) {
      const current = document.adoptedStyleSheets ?? [];
      document.adoptedStyleSheets = current.filter((candidate) => candidate !== this.sheet);
      this.sheet = undefined;
      this.adopted = false;
    }
    if (!this.styleElement) {
      const style = document.createElement("style");
      style.setAttribute("data-estyle", this.namespace);
      this.styleElement = style;
      if (this.options.prepend) {
        document.head.insertBefore(style, document.head.firstChild);
      } else {
        document.head.append(style);
      }
    }
    this.styleElement.setAttribute("data-estyle", this.namespace);
    if (this.options.nonce) this.styleElement.setAttribute("nonce", this.options.nonce);
  }

  private updateSheet() {
    if (!isBrowser()) return;
    const css = this.renderSheet();
    if (this.adopted && this.sheet) {
      this.sheet.replaceSync(css);
      return;
    }
    if (this.styleElement) this.styleElement.textContent = css;
  }

  private sync() {
    if (this.mounted || this.options.autoInject) this.ensureInjection();
    this.updateSheet();
  }
}
