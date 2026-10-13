import { mockMatchMedia } from "../browserMocks";

describe("DOM test environment", () => {
  it("provides a working document", () => {
    const div = document.createElement("div");
    div.textContent = "hello";
    document.body.appendChild(div);

    expect(document.body.textContent).toBe("hello");
    div.remove();
  });

  it("exposes window as an object", () => {
    expect(typeof window).toBe("object");
    expect(window.location.href).toContain("http://localhost");
  });
});

describe("matchMedia stub", () => {
  it("returns a non-matching media query list by default", () => {
    const mql = window.matchMedia("(min-width: 1px)");

    expect(mql.matches).toBe(false);
    expect(mql.media).toBe("(min-width: 1px)");
    expect(() => {
      mql.addEventListener("change", () => {});
      mql.removeEventListener("change", () => {});
    }).not.toThrow();
  });

  it("can be overridden with a boolean", () => {
    mockMatchMedia(true);

    expect(window.matchMedia("(prefers-color-scheme: dark)").matches).toBe(true);
  });

  it("restores the default after an override", () => {
    expect(window.matchMedia("(prefers-color-scheme: dark)").matches).toBe(false);
  });

  it("can be overridden with a query predicate", () => {
    mockMatchMedia((query) => query.includes("dark"));

    expect(window.matchMedia("(prefers-color-scheme: dark)").matches).toBe(true);
    expect(window.matchMedia("(prefers-color-scheme: light)").matches).toBe(false);
  });
});

describe("ResizeObserver stub", () => {
  it("exposes callable observe, unobserve and disconnect", () => {
    const observer = new ResizeObserver(() => {});
    const target = document.createElement("div");

    observer.observe(target);
    observer.unobserve(target);
    observer.disconnect();

    expect(vi.isMockFunction(observer.observe)).toBe(true);
    expect(observer.observe).toHaveBeenCalledWith(target);
    expect(observer.unobserve).toHaveBeenCalledWith(target);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("storage isolation", () => {
  it("writes to localStorage and sessionStorage", () => {
    localStorage.setItem("leak", "local");
    sessionStorage.setItem("leak", "session");

    expect(localStorage.getItem("leak")).toBe("local");
    expect(sessionStorage.getItem("leak")).toBe("session");
  });

  it("starts the next test with empty storage", () => {
    expect(localStorage.getItem("leak")).toBeNull();
    expect(sessionStorage.getItem("leak")).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
