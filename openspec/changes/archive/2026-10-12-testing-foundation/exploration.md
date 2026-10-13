# Exploration: testing-foundation

Mirrored from Engram `sdd/testing-foundation/explore` (#1997).

## Current State

- `vite.config.ts` has `test: { globals: true, include: ["src/**/*.test.ts"] }` and no environment or setupFiles.
- Installed: vitest 3.2.7. Not installed: jsdom, happy-dom, @testing-library/*.
- tsconfig `types`: `vite-plugin-pwa/client`, `vitest/globals`. Include is `src`.
- Existing tests (5, pure/node): `src/utils/__tests__/{colorUtils,getRandomGreeting,getSystemInfo,timeUtils}.test.ts`, `src/styles/reduceMotion.test.ts`. They use `vi.stubGlobal("navigator")`, `vi.resetModules`, and dynamic import.

## Package Manager

- `node_modules` has the pnpm layout. Tracked: `package-lock.json`, `.npmrc` (legacy-peer-deps), `netlify.toml` (npm), husky/lint-staged (npm). Untracked: `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
- Decision: stay PM-agnostic. The migration is a separate change.

## Browser APIs (jsdom)

- Need stubs: `matchMedia` (Sidebar calls it at module load), `ResizeObserver` (@dnd-kit/core).
- Mock in future tests: `peerjs`, `@yudiel/react-qr-scanner`, `virtual:pwa-register` (keep `main.tsx` out of tests).
- Absent but naturally handled: `window.LanguageModel`, `navigator.share`/`vibrate`/`setAppBadge`, `speechSynthesis`. user-event stubs `navigator.clipboard`.
- Available in jsdom: localStorage/sessionStorage (clear between tests), `navigator.onLine`.

## Providers

- `main.tsx` order: BrowserRouter > UserContextProvider > TaskProvider > App.
- `App.tsx` provides MUI + Emotion theme providers (`createCustomTheme`/`Themes`).
- The helper needs MemoryRouter + UserContextProvider + TaskProvider + MUI/Emotion theme. Do not render `<App/>`.

## Recommendation

jsdom, a global setup file, a render helper, include `src/**/*.test.{ts,tsx}`, and a smoke-test-only scope.
