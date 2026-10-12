import type * as CSS from "csstype";

export interface StyleDeclaration extends CSS.Properties<string | number> {
  [selector: `&${string}`]: StyleDeclaration | undefined;
  [customProperty: `--${string}`]: string | number | undefined;
}

type StyleRules = Record<string, StyleDeclaration>;
type ThemeTokens = Record<string, string>;
type RuleAccessor<Rules extends StyleRules> = {
  [Key in keyof Rules]: (overrides?: StyleDeclaration) => CSS.Properties<string | number>;
};
type ClassAccessor<Rules extends StyleRules> = Readonly<{
  [Key in keyof Rules]: string;
}>;
type MediaRules<Rules extends StyleRules> = Record<
  string,
  Partial<{ [Key in keyof Rules]: StyleDeclaration }>
>;
type Theme<Light extends ThemeTokens, Dark extends ThemeTokens> = {
  light: Light;
  dark?: Dark;
};

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

/** Framework-independent typed style rules and generated stylesheets. */
export class Estyle<
  Rules extends StyleRules = StyleRules,
  Light extends ThemeTokens = ThemeTokens,
  Dark extends ThemeTokens = ThemeTokens,
> {
  private rules: StyleRules = {};
  private baseRules: StyleRules = {};
  private mediaRules: Record<string, StyleRules> = {};
  private theme: { light: ThemeTokens; dark: ThemeTokens } = { light: {}, dark: {} };
  private namespace = "estyle";
  private classNames: Readonly<Record<string, string>> = Object.freeze({});
  private styleElement?: HTMLStyleElement;
  private activeMedia: Array<{ media: MediaQueryList; overrides: StyleRules }> = [];
  private cleanups: Array<() => void> = [];

  defineRules<Next extends StyleRules>(rules: Next): Estyle<Next, Light, Dark> {
    this.baseRules = cloneRules(rules);
    this.applyMedia();
    this.buildClasses();
    this.updateStyleElement();
    return this as unknown as Estyle<Next, Light, Dark>;
  }

  defineMedia(media: MediaRules<Rules>): this {
    this.mediaRules = Object.fromEntries(
      Object.entries(media).map(([condition, rules]) => [condition, cloneRules(rules as StyleRules)]),
    );
    this.updateStyleElement();
    return this;
  }

  setTheme<NextLight extends ThemeTokens, NextDark extends ThemeTokens = Record<string, never>>(
    theme: Theme<NextLight, NextDark>,
  ): Estyle<Rules, NextLight, NextDark> {
    this.theme = { light: { ...theme.light }, dark: { ...(theme.dark ?? {}) } };
    return this as unknown as Estyle<Rules, NextLight, NextDark>;
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

  get defineTheme(): { light: Light; dark: Dark } {
    return this.theme as { light: Light; dark: Dark };
  }

  dynamicTheme(mode: "light" | "dark" = "light") {
    return this.theme[mode];
  }

  mount(namespace = "estyle"): this {
    this.namespace = safeName(namespace);
    this.buildClasses();
    if (typeof document === "undefined" || !document.head) return this;
    if (!this.styleElement) {
      this.styleElement = document.createElement("style");
      document.head.append(this.styleElement);
    }
    this.styleElement.setAttribute("data-estyle", this.namespace);
    this.updateStyleElement();
    return this;
  }

  mediaQuery(query: Record<string, StyleRules>): this {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return this;
    Object.entries(query).forEach(([condition, overrides]) => {
      const media = window.matchMedia(condition);
      const apply = () => this.applyMedia();
      this.activeMedia.push({ media, overrides: cloneRules(overrides) });
      media.addEventListener("change", apply);
      this.cleanups.push(() => media.removeEventListener("change", apply));
    });
    this.applyMedia();
    return this;
  }

  destroy() {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.activeMedia = [];
    this.styleElement?.remove();
    this.styleElement = undefined;
  }

  private applyMedia() {
    this.rules = cloneRules(this.baseRules);
    this.activeMedia.forEach(({ media, overrides }) => {
      if (!media.matches) return;
      Object.entries(overrides).forEach(([key, style]) => {
        this.rules[key] = mergeStyle(this.rules[key], style);
      });
    });
    this.updateStyleElement();
  }

  private buildClasses() {
    this.classNames = Object.freeze(Object.fromEntries(
      Object.keys(this.baseRules).map((key) => [
        key,
        `${this.namespace}-${safeName(key)}-${hash(`${this.namespace}:${key}`)}`,
      ]),
    ));
  }

  private renderSheet() {
    let css = Object.entries(this.baseRules)
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

  private updateStyleElement() {
    if (this.styleElement) this.styleElement.textContent = this.renderSheet();
  }
}
