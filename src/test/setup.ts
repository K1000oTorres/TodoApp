import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { createMatchMedia, ResizeObserverStub } from "./browserMocks";

// Files that opt into `// @vitest-environment node` have no `window`; skip DOM setup there.
const hasDom = typeof window !== "undefined";

const installDefaultMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: createMatchMedia(false),
  });
};

// Stubs are installed at module top level so they exist before any module
// that reads them at load time (for example `Sidebar.tsx`) is imported.
if (hasDom) {
  installDefaultMatchMedia();

  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = ResizeObserverStub;
  }
}

beforeEach(() => {
  if (hasDom) installDefaultMatchMedia();
});

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
