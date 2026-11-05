---
status: testing
phase: 01-foundations
source: [01-VERIFICATION.md]
started: 2026-11-05T00:00:00Z
updated: 2026-11-05T00:00:00Z
---

## Current Test

number: 1
name: Push the branch and watch the first CI run on GitHub (Ubuntu)
expected: |
  build-and-audit runs `npm run check:pins` green; placement-test-smoke runs `npm run smoke` green (Playwright webServer + globalSetup on Linux)
awaiting: user response

## Tests

### 1. Push the branch and watch the first CI run on GitHub (Ubuntu)
expected: build-and-audit runs `npm run check:pins` green; placement-test-smoke runs `npm run smoke` green (Playwright webServer + globalSetup on Linux)
result: [pending]

### 2. Before any hand upload of dist/ (Phase 8), rebuild with the production PUBLIC_PLACEMENT_API_URL
expected: dist/ does not contain http://localhost:8787 (review WR-01: the smoke global-setup builds dist/ against localhost)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
