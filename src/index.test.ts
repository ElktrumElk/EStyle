import { afterEach, describe, expect, it, vi } from "vitest";
import { Estyle } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll("style[data-estyle]").forEach((style) => style.remove());
});

describe("Estyle", () => {
  it("keeps selectors out of inline styles", () => {
    const source = {
      button: {
        color: "white",
        paddingTop: 8,
        "&:hover": { color: "black" },
      },
    };
    const styles = new Estyle().defineRules(source);

    expect(styles.rule.button({ marginTop: 4 })).toEqual({
      color: "white",
      paddingTop: 8,
      marginTop: 4,
    });
    expect(source.button["&:hover"].color).toBe("black");
  });

  it("emits pseudo, descendant, attribute, and media rules", () => {
    const styles = new Estyle()
      .defineRules({
        button: {
          backgroundColor: "red",
          "&:hover": { backgroundColor: "blue" },
          "&[data-active=\"true\"]": { fontWeight: 700 },
          "& .icon": { marginRight: 6 },
        },
      })
      .defineMedia({
        "(max-width: 600px)": { button: { width: "100%" } },
      })
      .mount("controls");

    const name = styles.classes.button;
    const css = document.querySelector("style[data-estyle]")?.textContent;
    expect(css).toContain(`.${name}:hover{background-color:blue;}`);
    expect(css).toContain(`.${name}[data-active="true"]{font-weight:700;}`);
    expect(css).toContain(`.${name} .icon{margin-right:6px;}`);
    expect(css).toContain(`@media (max-width: 600px){.${name}{width:100%;}}`);
  });

  it("is SSR-safe and cleans up mounted styles", () => {
    const styles = new Estyle().defineRules({ button: { color: "red" } }).mount("cleanup");
    const element = document.querySelector("style[data-estyle=\"cleanup\"]");
    expect(element).not.toBeNull();
    styles.destroy();
    expect(element?.isConnected).toBe(false);

    vi.stubGlobal("document", undefined);
    expect(() => new Estyle().defineRules({ button: { color: "red" } }).mount()).not.toThrow();
  });
});
