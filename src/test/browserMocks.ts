import { vi } from "vitest";

type MatchesResolver = boolean | ((query: string) => boolean);

/**
 * Creates a `window.matchMedia` implementation in the shape of a Jest manual mock.
 * Listener methods are `vi.fn` spies and `matches` is resolved per query.
 */
export function createMatchMedia(matches: MatchesResolver = false) {
  return vi.fn().mockImplementation((query: string): MediaQueryList => {
    return {
      matches: typeof matches === "function" ? matches(query) : matches,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

/**
 * Overrides `window.matchMedia` for the current test.
 * The default implementation is restored before the next test by the setup file.
 */
export function mockMatchMedia(matches: MatchesResolver): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: createMatchMedia(matches),
  });
}

/**
 * Minimal `ResizeObserver` stub (jsdom does not implement it, @dnd-kit requires it).
 */
export class ResizeObserverStub implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
