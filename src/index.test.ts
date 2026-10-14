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

  it("emits pseudo element rules and omits them from inline output", () => {
    const styles = new Estyle()
      .defineRules({
        notice: {
          position: "relative",
          "&::before": { content: "\"!\"", color: "red" },
          "&::after": { content: "\"\"", display: "block" },
          "&::placeholder": { color: "#999" },
        },
      })
      .mount("pseudo");

    const name = styles.classes.notice;
    const css = styles.getStyles();
    expect(css).toContain(`.${name}::before{content:"!";color:red;}`);
    expect(css).toContain(`.${name}::after{content:"";display:block;}`);
    expect(css).toContain(`.${name}::placeholder{color:#999;}`);
    expect(styles.rule.notice()).toEqual({ position: "relative" });
  });

  it("generates @keyframes and exposes stable names", () => {
    const styles = new Estyle();
    styles.defineKeyframes({
      fadeIn: {
        from: { opacity: 0, transform: "translateY(8px)" },
        to: { opacity: 1, transform: "translateY(0)" },
        "50%": { opacity: 0.5 },
      },
    });
    const animation = styles.keyframes.fadeIn;
    styles
      .defineRules({ card: { animationName: animation, animationDuration: "300ms" } })
      .mount("keyframes");

    const name = styles.keyframes.fadeIn;
    expect(name).toBe(animation);
    const css = styles.getStyles();
    expect(css).toContain(`@keyframes ${name}{`);
    expect(css).toContain("from{opacity:0;transform:translateY(8px);}");
    expect(css).toContain("50%{opacity:0.5;}");
    expect(css).toContain("to{opacity:1;transform:translateY(0);}");
    expect(css).toContain(`.${styles.classes.card}{animation-name:${name};animation-duration:300ms;}`);
  });

  it("drops unsafe keyframe stops", () => {
    const styles = new Estyle().defineKeyframes({
      spin: { from: { opacity: 0 }, "bad stop": { opacity: 1 } },
    });
    const css = styles.getStyles();
    expect(css).toContain("from{opacity:0;}");
    expect(css).not.toContain("bad stop");
  });

  it("injects styles immediately to avoid an unstyled first paint", () => {
    const styles = new Estyle().defineRules({ card: { color: "red" } });

    const style = document.head.firstElementChild as HTMLStyleElement;
    expect(style.tagName).toBe("STYLE");
    expect(style.getAttribute("data-estyle")).toBe("estyle");
    expect(style.textContent).toContain(`.${styles.classes.card}{color:red;}`);
  });

  it("can defer injection and run it explicitly", () => {
    const styles = new Estyle({ autoInject: false }).defineRules({ card: { color: "red" } });
    expect(document.querySelector("style[data-estyle]")).toBeNull();

    styles.inject();
    expect(document.querySelector("style[data-estyle]")).not.toBeNull();
  });

  it("supports a namespace, prepend option, and CSP nonce", () => {
    const styles = new Estyle({ namespace: "app", prepend: false, nonce: "abc123" })
      .defineRules({ card: { color: "red" } })
      .mount();

    const style = document.querySelector("style[data-estyle=\"app\"]");
    expect(style).not.toBeNull();
    expect(style?.getAttribute("nonce")).toBe("abc123");
    expect(styles.classes.card.startsWith("app-card-")).toBe(true);
  });

  it("exposes generated CSS for server rendering without a document", () => {
    const styles = new Estyle()
      .defineRules({ page: { minHeight: "100vh" } })
      .defineMedia({ "(max-width: 600px)": { page: { minHeight: "auto" } } });

    const css = styles.getStyles();
    expect(typeof css).toBe("string");
    expect(css).toContain("min-height:100vh;");
    expect(css).toBe(`${styles}`);
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
