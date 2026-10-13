# Research: testing-foundation

Mirrored from Engram `sdd/testing-foundation/research` (#1999). Status: done. Checked 2026-10-12 against official docs and the npm registry.

## Vitest

- Keep `vitest ^3.2.4`. The latest is 5.x, but the upgrade is out of scope.
- jsdom is an optional peer with range `*`, so no documented compatibility exists. A smoke test is required.
- Config options:
  - `test` block in `vite.config.ts` with `/// <reference types="vitest/config" />`, or
  - `vitest.config.ts` using `mergeConfig`. Without `mergeConfig`, `vite.config.ts` is ignored.
- Settings: `environment: 'jsdom'`, `globals: true` (RTL auto-cleanup), `setupFiles: ['./src/test/setup.ts']`. Per-file override: `// @vitest-environment node`.
- Sources: https://vitest.dev/config/environment, https://vitest.dev/config/, https://vitest.dev/config/globals, https://vitest.dev/config/setupfiles

## Testing Library

- `@testing-library/react ^16.3.3`: supports React 19 since 16.1.0. Requires `@testing-library/dom ^10` as an explicit peer. Exports `renderHook`.
- `@testing-library/jest-dom ^7.0.1`: import `@testing-library/jest-dom/vitest`.
- `@testing-library/user-event ^14.6.7`: `setup()` stubs `navigator.clipboard`.

## jsdom Gaps

- `matchMedia`: define it via `Object.defineProperty(window, 'matchMedia', ...)` with `vi.fn`. It must be defined before modules that call it at load.
- `ResizeObserver`: used by @dnd-kit/core, so it needs a stub.
- MUI testing guidance: query by role/text and avoid snapshots.

## Node Constraint

- Local Node is v22.19.0, and no Node version is pinned in the repo.
- jsdom 30 requires `^22.22.2`, so it is incompatible. jsdom 29.1.1 requires `^20.19 || ^22.13 || >=24`, so it is compatible.
- jest-dom 7 requires Node >=22. Netlify's Node version is unknown.

## Unverified

- React 19 act warnings and Emotion behavior in jsdom.
