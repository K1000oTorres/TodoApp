# test-environment Specification

## Purpose

Defines the DOM-capable Vitest runtime, global setup, browser API stubs, and provider-aware render helper that let hooks, components, and contexts be tested under strict TDD.

## Requirements

### Requirement: DOM environment and collection

The runner MUST collect `src/**/*.test.{ts,tsx}` and execute them in a DOM environment (`window`, `document`) by default, with globals available.

#### Scenario: DOM available by default

- GIVEN a `.test.tsx` file with no environment override
- WHEN it runs
- THEN `document.createElement('div')` works and `.tsx` files are collected

#### Scenario: Per-file node override

- GIVEN a test file declaring a node environment override
- WHEN it runs
- THEN `typeof window` is `'undefined'` in that file only

### Requirement: Existing tests unaffected

The 5 existing tests MUST pass, and `npm run test:typecheck` MUST pass.

#### Scenario: Regression run

- GIVEN the environment is configured
- WHEN the full suite and typecheck run
- THEN all existing tests pass with no new type errors

### Requirement: jest-dom matchers

jest-dom matchers MUST be registered globally without per-file imports, with types resolved by typecheck.

#### Scenario: Matcher usable

- GIVEN a rendered element in a test with no matcher import
- WHEN `expect(el).toBeInTheDocument()` runs
- THEN it passes and typecheck accepts the call

### Requirement: Test isolation

Between tests, rendered DOM MUST be unmounted and `localStorage` and `sessionStorage` MUST be empty.

#### Scenario: Storage does not leak

- GIVEN test A writes a key to `localStorage` and `sessionStorage`
- WHEN test B in the same file runs afterwards
- THEN both storages are empty

#### Scenario: DOM does not leak

- GIVEN test A renders a component
- WHEN test B runs afterwards
- THEN `document.body` contains no nodes from test A

### Requirement: Browser API stubs before module load

`window.matchMedia` and `ResizeObserver` MUST exist before any test module is imported, so import-time callers do not throw.

#### Scenario: Import-time matchMedia

- GIVEN a module calling `matchMedia` at load (e.g. `Sidebar`)
- WHEN a test imports it
- THEN the import succeeds without error

#### Scenario: Stub shape

- GIVEN any test
- WHEN it calls `matchMedia('(min-width: 1px)')` and `new ResizeObserver(cb)`
- THEN `matchMedia` returns an object with a boolean `matches` and listener methods, and `observe`/`unobserve`/`disconnect` are callable

### Requirement: renderWithProviders helper

`src/test/renderWithProviders` MUST render a UI inside router, user, task, and theme (MUI and Emotion) providers, and return Testing Library render results plus a `user-event` instance. It MUST accept a configurable initial route (default `/`) and initial user.

#### Scenario: Provider-dependent component renders

- GIVEN a component that reads router, user, task, and theme context
- WHEN rendered through the helper with defaults
- THEN it renders without a missing-provider error

#### Scenario: Configurable route

- GIVEN the helper called with initial route `/settings`
- WHEN a child reads the current location
- THEN the pathname is `/settings`

#### Scenario: Configurable user

- GIVEN the helper called with a specific initial user
- WHEN a child reads the user context
- THEN it receives that user

#### Scenario: Interaction

- GIVEN a rendered button with a click handler
- WHEN the returned `user` instance clicks it
- THEN the handler is called once

### Requirement: Dependency and repository hygiene

New packages (`jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`) MUST be declared only in `devDependencies`. Lockfiles, `.npmrc`, scripts, husky hooks, and `netlify.toml` MUST NOT change, and `vitest` MUST remain `^3.2.4`.

#### Scenario: Manifest diff

- GIVEN the change is applied
- WHEN `package.json` and the listed files are diffed against base
- THEN only `devDependencies` gained entries, `dependencies` is unchanged, and no other listed file differs

#### Scenario: Build unaffected

- GIVEN the change is applied
- WHEN `npm run build` runs
- THEN it succeeds

> **Known deviation (recorded at archive, 2026-10-12)**: the `vitest` specifier in `package.json` is `^3.1.1`, not the `^3.2.4` stated above. It predates this change and was left unchanged by design (no manifest edits in this change). The installed version resolves to 3.2.7, which satisfies `>=3.2.4`. Follow-up: align the manifest specifier or the requirement text in a future change.
