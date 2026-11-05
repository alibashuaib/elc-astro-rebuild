---
status: complete
phase: 01-foundations
source: [01-VERIFICATION.md]
started: 2026-11-05T00:00:00Z
updated: 2026-11-05T15:02:18.934Z
---

## Current Test

[testing complete]

## Tests

### 1. Push the branch and watch the first CI run on GitHub (Ubuntu)
expected: build-and-audit runs `npm run check:pins` green; placement-test-smoke runs `npm run smoke` green (Playwright webServer + globalSetup on Linux)
result: pass — PR #37 run 42047460636 (2026-11-05): build-and-audit, placement-test-smoke, placement-test-worker all green. First run 42046482665 failed only Lighthouse a11y (inactive course tab contrast 4.39:1); fixed in be154ed.

### 2. Before any hand upload of dist/ (Phase 8), rebuild with the production PUBLIC_PLACEMENT_API_URL
expected: dist/ does not contain http://localhost:8787 (review WR-01: the smoke global-setup builds dist/ against localhost)
result: deferred — check at Phase 8 upload time. Rebuild dist/ with the production PUBLIC_PLACEMENT_API_URL before any hand upload; grep dist/ for localhost:8787 first. Tracks WR-01 in 01-REVIEW-DISPOSITION.md.

## Summary

total: 2
passed: 1
issues: 0
pending: 0
deferred: 1
skipped: 0
blocked: 0

## Gaps
