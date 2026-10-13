# Design: Testing Foundation (DOM test environment)

## Technical Approach

Extend the existing `test` block in `vite.config.ts` to run every test in jsdom, load one global setup file, and collect `.ts`/`.tsx` tests. A `src/test/` folder holds the setup, browser stubs, and a provider-aware render helper that mirrors the provider tree in `src/main.tsx` and the theme logic in `src/App.tsx`. Runtime code is not changed. Sources: research.md (vitest.dev config/environment, setupFiles, globals; Testing Library docs).

## Architecture Decisions

| #   | Topic            | Option / tradeoff                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decision                                                                                                                                                                                                                                                                |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Config placement | Separate `vitest.config.ts` + `mergeConfig`: adds a second file, and it still inherits all plugins unless they are filtered manually. `test` block in `vite.config.ts`: one source of truth. The plugins are needed or harmless: `react()` carries the Emotion `jsxImportSource` and Babel plugin that components require. `VitePWA` resolves `virtual:pwa-register`. `qrcode` only acts on a listening dev server. `basicSsl` is off unless `dev:host` is used. | **Keep the `test` block in `vite.config.ts`.** Change the reference to `/// <reference types="vitest/config" />`.                                                                                                                                                       |
| 2   | Setup cleanup    | Rely on `globals: true` RTL auto-cleanup vs an explicit `afterEach(cleanup)`                                                                                                                                                                                                                                                                                                                                                                                     | **Explicit `cleanup()`, then `localStorage.clear()` and `sessionStorage.clear()`, in `afterEach`.** This does not depend on the globals flag.                                                                                                                           |
| 3   | `matchMedia`     | `vi.stubGlobal` (removed by unstub) vs `Object.defineProperty` with a `vi.fn` in the Jest manual-mock shape                                                                                                                                                                                                                                                                                                                                                      | **`defineProperty`, `writable: true`, defined in the setup file** so it exists before modules that read it at load time (`Sidebar.tsx:737`). `beforeEach` restores the default implementation (`matches: false`). Tests override it with the `mockMatchMedia()` helper. |
| 4   | `ResizeObserver` | Polyfill package vs a minimal class stub                                                                                                                                                                                                                                                                                                                                                                                                                         | **Class stub with `vi.fn` methods, installed only when it is undefined** (needed by @dnd-kit).                                                                                                                                                                          |
| 5   | Theme in helper  | Import a shared builder (requires a runtime refactor) vs rebuild the theme in the test                                                                                                                                                                                                                                                                                                                                                                           | **Rebuild it in the helper** from `Themes[0]` and `createCustomTheme`, using the same Emotion `Theme` shape as `App.tsx`. Duplication is accepted so runtime stays untouched.                                                                                           |
| 6   | Initial user     | Inject `UserContext.Provider` directly vs seed `localStorage["user"]` before the real `UserContextProvider`                                                                                                                                                                                                                                                                                                                                                      | **Seed localStorage** (`{...defaultUser, ...initialUser}`). This exercises the real provider and `useStorageState`.                                                                                                                                                     |
| 7   | Hook helper      | Separate code vs a shared wrapper                                                                                                                                                                                                                                                                                                                                                                                                                                | **Add `renderHookWithProviders`** that reuses the same `createWrapper(options)`.                                                                                                                                                                                        |
| 8   | tsconfig         | Add `@testing-library/jest-dom` to `types` vs rely on the import in setup.ts                                                                                                                                                                                                                                                                                                                                                                                     | **No tsconfig change.** `src/test/setup.ts` is inside `include: ["src"]`, so its `@testing-library/jest-dom/vitest` import brings the matcher types into `tsc`. `vitest/globals` is already listed.                                                                     |
| 9   | Existing tests   | Add the node override preemptively vs only on failure                                                                                                                                                                                                                                                                                                                                                                                                            | **Run them under jsdom first.** They are pure, and `getSystemInfo` stubs `navigator` and guards `matchMedia?.`. Add `// @vitest-environment node` only to a file that fails.                                                                                            |

## Data Flow

    vitest -> vite.config.ts (plugins + test) -> jsdom env
           -> src/test/setup.ts (jest-dom, stubs, afterEach reset)
           -> *.test.tsx -> renderWithProviders
                 MemoryRouter > UserContextProvider > TaskProvider
                   > MuiThemeProvider > EmotionThemeProvider > ui

## File Changes

| File                                              | Action | Description                                                                                                                     |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                    | Modify | devDependencies only (versions below)                                                                                           |
| `vite.config.ts`                                  | Modify | reference `vitest/config`; `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]` |
| `src/test/setup.ts`                               | Create | jest-dom import, stubs, `beforeEach`/`afterEach` reset                                                                          |
| `src/test/browserMocks.ts`                        | Create | `createMatchMedia`, `mockMatchMedia`, `ResizeObserverStub`                                                                      |
| `src/test/renderWithProviders.tsx`                | Create | `createWrapper`, `renderWithProviders`, `renderHookWithProviders`                                                               |
| `src/test/__tests__/environment.test.ts`          | Create | jsdom globals, storage reset across tests, `matchMedia` default and override, `ResizeObserver` present                          |
| `src/test/__tests__/jestDom.test.tsx`             | Create | `toBeInTheDocument` / `toHaveTextContent` on rendered JSX                                                                       |
| `src/test/__tests__/renderWithProviders.test.tsx` | Create | probe component reads user name, location, MUI mode, Emotion theme; clicks through `userEvent`                                  |
| `src/hooks/__tests__/useSystemTheme.test.ts`      | Create | `renderHook` + `mockMatchMedia(true)` returns `"dark"`                                                                          |

DevDependencies: `jsdom ^29.1.1`, `@testing-library/react ^16.3.3`, `@testing-library/dom ^10.4.2`, `@testing-library/jest-dom ^7.0.1`, `@testing-library/user-event ^14.6.7`. The `vitest` specifier is not touched. Lockfiles, scripts, husky, and `netlify.toml` are not touched.

## Interfaces / Contracts

```ts
// browserMocks.ts
export function mockMatchMedia(matches: boolean | ((query: string) => boolean)): void;

// renderWithProviders.tsx
export interface ProviderOptions {
  route?: string; // MemoryRouter initialEntries, default "/"
  initialUser?: Partial<User>; // merged over defaultUser, seeded to localStorage
  themeMode?: "light" | "dark"; // default "dark"
}
export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, "wrapper">,
): RenderResult & { user: UserEvent }; // userEvent.setup()
export function renderHookWithProviders<R, P>(
  hook: (props: P) => R,
  options?: ProviderOptions,
): RenderHookResult<R, P>;
```

The Emotion theme is `{ primary, secondary, darkmode, mui, reduceMotion: "on" }`. `reduceMotion: "on"` keeps animations deterministic.

## Testing Strategy

| Layer       | What to Test                        | Approach                                                                           |
| ----------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Infra smoke | env, matchers, stubs, storage reset | Each test is written first and fails (RED) before its config or setup piece exists |
| Integration | provider helper                     | probe component plus `userEvent`                                                   |
| Hook        | `useSystemTheme`                    | `renderHookWithProviders` plus a `matchMedia` override                             |
| Regression  | 5 existing test files               | full `vitest run` under jsdom; `tsc`; `vite build`                                 |

The TDD sequence has five steps:

1. Add the devDependencies.
2. RED `environment.test.ts` (fails under node), then GREEN with the config change.
3. RED for the stubs and storage, then GREEN with `setup.ts`/`browserMocks.ts`.
4. RED `jestDom.test.tsx`, then GREEN with the jest-dom import.
5. RED for the helper and hook tests, then GREEN with `renderWithProviders.tsx`.

Finish with the full suite, `tsc`, and the build.

## Threat Matrix

N/A: this change has no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration is required. Rollback means reverting the commit.

## Open Questions

- [ ] `package.json` currently declares `vitest ^3.1.1`, not `^3.2.4`. Confirm that the installed version resolves to 3.2.x. The specifier is not edited either way.
