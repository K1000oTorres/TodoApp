# Tasks: Testing Foundation (DOM test environment)

Strict TDD: every behavior task is RED (test written, run, confirmed failing) then GREEN (minimal implementation, confirmed passing) then REFACTOR (tests still pass).
Verification commands: `npx vitest run [path]`, `npm run test:typecheck`, `npm run lint`, `npm run build`.

## Review Workload Forecast

| Item                               | Estimate (changed lines) |
| ---------------------------------- | ------------------------ |
| `package.json` devDependencies     | ~6                       |
| `vite.config.ts`                   | ~6                       |
| `src/test/setup.ts`                | ~35                      |
| `src/test/browserMocks.ts`         | ~50                      |
| `src/test/renderWithProviders.tsx` | ~110                     |
| 4 test files                       | ~190                     |
| **Total**                          | **~400 (budget 800)**    |

- Chained PRs recommended: **No** (single cohesive PR, about 50% of budget; lockfile is excluded from the count).
- Decision needed before apply: **Yes** (one item): the user must choose and run the dependency install command (package manager is not fixed, lockfiles must not be committed or edited by this change).

## Phase 0: Prerequisite (user action)

- [x] 0.1 Add devDependencies to `package.json` (devDependencies only): `jsdom ^29.1.1`, `@testing-library/react ^16.3.3`, `@testing-library/dom ^10.4.2`, `@testing-library/jest-dom ^7.0.1`, `@testing-library/user-event ^14.6.7`. Leave `vitest` (declared `^3.1.1`, installed 3.2.7) and all scripts unchanged. (Spec: Dependency and repository hygiene)
- [x] 0.2 **USER DECISION REQUIRED:** the user picks the package manager and runs the install command (for example `npm install`, `pnpm install`, or `yarn`). The apply agent MUST NOT edit lockfiles, `.npmrc`, scripts, husky, or `netlify.toml`, and MUST NOT choose the manager. Verify with `npx vitest --version` (3.2.x) and that the five packages resolve. Note: untracked `pnpm-lock.yaml`/`pnpm-workspace.yaml` already exist in the working tree; do not stage them as part of this change. (Spec: Dependency and repository hygiene)
- [x] 0.3 Baseline: run `npx vitest run` (node env, current config) and `npm run test:typecheck`; record that the 5 existing tests pass. (Spec: Existing tests unaffected)

## Phase 1: DOM environment and collection (design steps 2)

- [x] 1.1 RED: create `src/test/__tests__/environment.test.ts` with cases: `document.createElement('div')` works and `typeof window` is `'object'`; a second file-level case that confirms collection of `.ts` under `src/test/__tests__`. Run `npx vitest run src/test/__tests__/environment.test.ts` and confirm failure under the current node environment. (Spec: DOM environment and collection / DOM available by default)
- [x] 1.2 GREEN: in `vite.config.ts` change the reference to `/// <reference types="vitest/config" />` and set `test.environment: "jsdom"` and `test.include: ["src/**/*.test.{ts,tsx}"]`, keeping existing `globals`. Confirm 1.1 passes. (Spec: DOM environment and collection)
- [x] 1.3 RED then GREEN: add a case in a temporary or dedicated file with `// @vitest-environment node` asserting `typeof window === 'undefined'`; confirm it passes in that file only while `environment.test.ts` still sees a DOM. (Spec: Per-file node override)
- [x] 1.4 Regression gate: `npx vitest run` (all 5 existing tests pass under jsdom) and `npm run test:typecheck`. Only if an existing file fails, add `// @vitest-environment node` to that file alone (design decision 9). (Spec: Existing tests unaffected)

## Phase 2: Browser stubs and isolation (design step 3)

- [x] 2.1 RED: extend `src/test/__tests__/environment.test.ts` with: `matchMedia('(min-width: 1px)')` returns an object with boolean `matches` and listener methods; `new ResizeObserver(cb)` exposes callable `observe`/`unobserve`/`disconnect`; test A writes keys to `localStorage` and `sessionStorage`, test B (next, same file) sees both empty; `mockMatchMedia(true)` override then default restored (`matches: false`) in the following test. Confirm each fails. (Spec: Browser API stubs, Test isolation)
- [x] 2.2 GREEN: create `src/test/browserMocks.ts` exporting `createMatchMedia`, `mockMatchMedia(matches: boolean | ((query: string) => boolean))`, and `ResizeObserverStub` (class with `vi.fn` methods). (Spec: Stub shape)
- [x] 2.3 GREEN: create `src/test/setup.ts`: define `window.matchMedia` via `Object.defineProperty` (`writable: true`) and install `ResizeObserver` only when undefined, both at module top level; `beforeEach` restores default matchMedia; `afterEach` runs `cleanup()`, `localStorage.clear()`, `sessionStorage.clear()`. Add `setupFiles: ["./src/test/setup.ts"]` to `vite.config.ts`. Confirm 2.1 passes. (Spec: Browser API stubs before module load, Test isolation)
- [x] 2.4 RED then GREEN: add a case that imports a module calling `matchMedia` at load time (for example `src/components/Sidebar`, `Sidebar.tsx:737`) and asserts the dynamic import resolves; confirm it passes only with the setup-file stub (temporarily disable the stub line to see RED if the import is not already failing). (Spec: Import-time matchMedia)
- [x] 2.5 Hook test RED then GREEN: create `src/hooks/__tests__/useSystemTheme.test.ts` using `renderHook` from `@testing-library/react` plus `mockMatchMedia(true)`, expecting `"dark"`. Run `npx vitest run src/hooks/__tests__/useSystemTheme.test.ts`. (Design: Testing Strategy, Hook)

## Phase 3: jest-dom matchers (design step 4)

- [x] 3.1 RED: create `src/test/__tests__/jestDom.test.tsx` rendering JSX with `render` and asserting `toBeInTheDocument()` and `toHaveTextContent()` with no matcher import; confirm failure ("Invalid Chai property"/missing matcher). (Spec: jest-dom matchers)
- [x] 3.2 GREEN: add `import "@testing-library/jest-dom/vitest";` to `src/test/setup.ts`. Confirm 3.1 passes and `npm run test:typecheck` accepts the matcher types (no tsconfig change; setup.ts is within `include: ["src"]`). (Spec: jest-dom matchers)
- [x] 3.3 Isolation check: add a DOM-leak case (test A renders a component, test B asserts `document.body` has none of its nodes) in `environment.test.ts` or `jestDom.test.tsx`; confirm green via the explicit `cleanup()`. (Spec: DOM does not leak)

## Phase 4: renderWithProviders (design step 5)

- [x] 4.1 RED: create `src/test/__tests__/renderWithProviders.test.tsx` with a probe component reading user name, `useLocation().pathname`, MUI theme mode, and Emotion theme. Cases: default render with no missing-provider error; route `/settings` yields pathname `/settings` and default is `/`; `initialUser` is received from user context; a button click through the returned `user` instance calls the handler once. Confirm failure (module missing). (Spec: renderWithProviders helper, all four scenarios)
- [x] 4.2 GREEN: create `src/test/renderWithProviders.tsx` exporting `ProviderOptions`, `createWrapper(options)`, `renderWithProviders` (returns RTL result plus `userEvent.setup()`), and `renderHookWithProviders`. Tree: `MemoryRouter > UserContextProvider > TaskProvider > MuiThemeProvider > EmotionThemeProvider`; theme rebuilt from `Themes[0]` and `createCustomTheme` with `reduceMotion: "on"`; initial user seeded via `localStorage["user"]` as `{...defaultUser, ...initialUser}`; defaults `route "/"`, `themeMode "dark"`. Mirror `src/main.tsx` and `src/App.tsx` without touching runtime code. Confirm 4.1 passes. (Spec: renderWithProviders helper)
- [x] 4.3 REFACTOR: confirm `useSystemTheme.test.ts` (2.5) optionally uses `renderHookWithProviders`; remove duplication inside the helper only; rerun `npx vitest run src/test src/hooks`.

## Phase 5: Final verification

- [x] 5.1 `npx vitest run` (full suite: 5 existing + new smoke tests all pass, none skipped). (Spec: Existing tests unaffected)
- [x] 5.2 `npm run test:typecheck` and `npm run lint` clean. (Spec: Existing tests unaffected, jest-dom matchers)
- [x] 5.3 `npm run build` succeeds. (Spec: Build unaffected)
- [x] 5.4 `git diff` on `package.json` shows only `devDependencies` additions; no diff in `.npmrc`, scripts, husky hooks, `netlify.toml`; no lockfile staged; `vitest` specifier unchanged. (Spec: Manifest diff)

## Dependencies

Sequential: 0.1 -> 0.2 -> 0.3 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 (each phase's GREEN edits `vite.config.ts` or `setup.ts` incrementally).
Parallel-safe: within Phase 2, 2.2 and 2.3 touch different files after 2.1; 2.5 is independent of Phase 3 once 2.3 is done. 5.2 and 5.3 can run in parallel.
