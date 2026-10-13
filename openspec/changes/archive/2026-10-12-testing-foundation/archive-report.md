# Archive Report: testing-foundation

**Change**: testing-foundation
**Project**: TodoApp (engram project key `todoapp`)
**Archived on**: 2026-10-12
**Artifact store**: hybrid (Engram + openspec)
**Close status**: archived, intentional-with-warnings (carried verify warnings and one recorded spec deviation)

## Inputs Read (traceability)

| Artifact       | Source read                    | Observation ID / path                                                                                       |
| -------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| proposal       | Engram                         | #2000 (`sdd/testing-foundation/proposal`)                                                                   |
| spec           | Engram + file                  | #2001 (`sdd/testing-foundation/spec`); `openspec/changes/testing-foundation/specs/test-environment/spec.md` |
| design         | Engram                         | #2002 (`sdd/testing-foundation/design`)                                                                     |
| tasks          | Engram + file (authoritative)  | #2003 (`sdd/testing-foundation/tasks`); `openspec/changes/testing-foundation/tasks.md`                      |
| apply-progress | Engram (intermediate snapshot) | #2004 (`sdd/testing-foundation/apply-progress`)                                                             |
| verify-report  | Engram + file                  | #2005 (`sdd/testing-foundation/verify-report`); `openspec/changes/testing-foundation/verify-report.md`      |

## Task Completion Gate

- `openspec/changes/testing-foundation/tasks.md`: 22 of 22 tasks checked (`- [x]`), 0 unchecked, before and after archive.
- No archive-time checkbox reconciliation was performed.
- Engram #2003 prose says "21 tasks"; this is a stale summary. The persisted tasks.md (22 items, all complete) is authoritative.

## Final State at Close (Final-State Authority)

Ranking: (1) persisted tasks artifact, (2) orchestrator final-state facts, (3) intermediate snapshots (#2004, #2005).

- **Implementation**: complete, 22/22 tasks. Apply attempt 1 settled failed (tasks 5.2 and 5.3 blocked by undeclared `csstype` and `workbox-window` under the pnpm strict layout). The remediation attempt settled passed after the user-approved `pnpm add -D csstype@^3.2.3 workbox-window@^7.4.1`. Confirmed in `package.json` devDependencies.
- **Verification**: PASS WITH WARNINGS per #2005 (verification time), 0 CRITICAL, 14/14 scenarios compliant. Final-state facts from the orchestrator: vitest 11 files / 93 tests pass; tsc, lint, and build green (PWA 63 precache entries). Verify attempt settled passed.
- **CRITICAL issues**: none. Archive is not blocked by verification.

## Specs Synced

| Domain           | Action                   | Details                                                                                                           |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| test-environment | Created (new capability) | Main spec did not exist. Copied mechanically from the change delta, byte-identical. 7 requirements, 14 scenarios. |

### Recorded addition (not a copy)

A known-deviation note was appended to the main spec after the "Build unaffected" scenario of "Dependency and repository hygiene". The normative requirement text was NOT changed. Reason: the requirement says `vitest` MUST remain `^3.2.4`, but `package.json` declares `"vitest": "^3.1.1"` (verified by `rg` at archive time). The specifier predates this change and was left unchanged by design. The installed version is 3.2.7.

## Carried Warnings (from #2005 / verify-report.md, rechecked at close)

1. **TDD Cycle Evidence table missing** from apply-progress (#2004). RED/GREEN per task is recorded in tasks.md. Status at close: unresolved, carried as a warning. RED ordering cannot be independently verified.
2. **Untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`** exist in the working tree. Not staged or committed by this archive (`git diff --cached --name-only` is empty). Must not be staged with this change.
3. **Extra devDependencies** `csstype` (`^3.2.3`) and `workbox-window` (`^7.4.1`), added by user decision. They are devDependencies only. The main spec's hygiene requirement names only the five original packages, so these two are outside the spec's enumerated list.
4. **Vitest specifier mismatch**: see the recorded addition above. Known deviation, not a regression.

## Recorded Discrepancies (not resolved silently)

| Claim                            | Source                        | Written            | Resolution                                                                                    |
| -------------------------------- | ----------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| "21 tasks"                       | Engram #2003 prose            | at tasks time      | Stale. File has 22 tasks, all complete. File is authoritative.                                |
| "13 scenarios"                   | Engram #2001 prose            | at spec time       | Stale. Spec file has 14 scenarios (2+1+1+2+2+4+2). #2005 counts 14/14. File is authoritative. |
| "20/22 done"                     | Engram #2004 (prior revision) | at apply attempt 1 | Superseded by remediation. 22/22 final per tasks.md and orchestrator facts.                   |
| "Verify 4 WARNING, 2 SUGGESTION" | Engram #2005                  | at verify time     | Carried as above. No later commit closed these warnings.                                      |

## Follow-ups (out of scope for this change)

- Migrate npm to pnpm: package-lock.json, Netlify configuration.
- Pin Node version for Netlify.
- Add `@vitest/coverage-v8`.
- Add share/QR and P2P sync test coverage.
- Strengthen the `importTime.test.ts` first assertion.
- Align the `vitest` specifier in `package.json` (`^3.1.1`) with the spec (`^3.2.4`), or vice versa.

## Mechanical Readback (verbatim)

Spec copy (source vs temp, before move to main spec):

```
(empty diff, exit 0)
```

Spec copy (source vs main spec, after copy):

```
(empty diff, exit 0)
```

Change folder move (pre-move snapshot vs archived folder):

```
git mv refused (source untracked; "fatal: source directory is empty"), status 128.
Source confirmed present and unchanged against snapshot, then mv fallback.
(empty diff, exit 0)
```

Post-move check: source `openspec/changes/testing-foundation` absent. Staged files: none.

Post-annotation check (archived delta spec vs main spec), expected additive-only:

```
105a106,107
>
> > **Known deviation (recorded at archive, 2026-10-12)**: ...
```

## Archive Contents

- proposal.md, exploration.md, research.md, design.md, tasks.md, verify-report.md: present
- specs/test-environment/spec.md: present
- archive-report.md: added at archive time (additive, excluded from the snapshot comparison)

Archive location: `openspec/changes/archive/2026-10-12-testing-foundation/`
Main spec: `openspec/specs/test-environment/spec.md`

## SDD Cycle Status

Planned, implemented, verified (PASS WITH WARNINGS), and archived. Not committed. Commit, push, and PR remain a separate decision under ordinary repository policy.
