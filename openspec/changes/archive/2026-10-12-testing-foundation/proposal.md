# Proposal: Testing Foundation (DOM test environment)

## Intent

Strict TDD is enabled, but Vitest only collects `src/**/*.test.ts` in a Node environment. Hooks, components, and contexts cannot be tested. This change adds a jsdom-based environment, Testing Library, shared setup, and a provider-aware render helper so later UI/hook work can follow red-green-refactor.

## Scope

### In Scope

- devDependencies in `package.json` only: `jsdom ^29.1.1`, `@testing-library/react ^16.3.3`, `@testing-library/dom ^10.4.2`, `@testing-library/jest-dom ^7.0.1`, `@testing-library/user-event ^14.6.7` (vitest stays `^3.2.4`)
- Vitest config: global `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, include widened to `src/**/*.test.{ts,tsx}`
- `src/test/setup.ts`: jest-dom matchers (`@testing-library/jest-dom/vitest`), `matchMedia` and `ResizeObserver` stubs, per-test storage cleanup
- `src/test/renderWithProviders.tsx`: MemoryRouter + UserContextProvider + TaskProvider + MUI and Emotion theme providers
- 3-4 smoke tests proving the environment, matchers, stubs, and helper work
- `// @vitest-environment node` per-file override only where an existing test needs it

### Out of Scope

- npm to pnpm migration (lockfiles, `.npmrc`, scripts, husky, `netlify.toml`): separate follow-up change
- Node version pinning for Netlify/CI
- Share/QR and P2P sync test coverage (follow-up changes)
- Coverage, CI, E2E, Vitest upgrade

## Capabilities

### New Capabilities

- `test-environment`: DOM test runtime, global setup, browser API stubs, provider render helper, and collection rules for `.ts`/`.tsx` tests

### Modified Capabilities

None

## Approach

Single global jsdom environment (confirmed decision). Config placement is left to `sdd-design`:

- `test` block in `vite.config.ts`: one file, but tests load PWA/qrcode/basicSsl plugins
- `vitest.config.ts` with `mergeConfig`: isolates test-only settings and can trim plugins, at the cost of a second config file (without `mergeConfig` the Vite config is ignored)

The `matchMedia` stub must exist in the setup file, because `Sidebar` calls it when the module loads. Tests are written first, following TDD: each smoke test fails before its infrastructure exists.

## Affected Areas

| Area                                       | Impact       | Description            |
| ------------------------------------------ | ------------ | ---------------------- |
| `package.json`                             | Modified     | devDependencies only   |
| `vite.config.ts` and/or `vitest.config.ts` | Modified/New | test config            |
| `src/test/setup.ts`                        | New          | global setup and stubs |
| `src/test/renderWithProviders.tsx`         | New          | render helper          |
| `src/**/*.test.tsx` (smoke)                | New          | 3-4 smoke tests        |

## Risks

| Risk                                                      | Likelihood | Mitigation                             |
| --------------------------------------------------------- | ---------- | -------------------------------------- |
| Vitest 3.2 + jsdom 29 compatibility is undocumented       | Med        | Smoke test proves it                   |
| Existing 5 tests break under jsdom                        | Med        | Per-file node override                 |
| Netlify Node version unknown (jest-dom 7 needs Node >=22) | Med        | Dev-only deps; follow-up pin           |
| Lockfile drift (npm vs pnpm)                              | Med        | No lockfile edits; follow-up migration |
| React 19 act warnings / Emotion in jsdom (unverified)     | Low        | Observed in smoke tests                |

## Rollback Plan

Revert the change commit(s). This removes the devDependencies, config edits, and the `src/test/` folder. Runtime code is untouched, so the app build is unaffected.

## Dependencies

- Local Node >=22.13 (verified 22.19.0)

## Success Criteria

- [ ] `npx vitest run` passes: 5 existing tests plus the new smoke tests
- [ ] `npm run test:typecheck` passes
- [ ] A `.tsx` test that renders through `renderWithProviders` and uses jest-dom matchers passes
- [ ] `npm run build` still succeeds
- [ ] No lockfile, script, husky, or `netlify.toml` changes
