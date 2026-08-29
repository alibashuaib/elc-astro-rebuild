-- Drop test_sessions.recent_levels.
--
-- It held a trailing window of the adaptive engine's level index, used to end a
-- session once the estimate converged. That convergence check was removed when
-- the test became a fixed walk-through (see scoring.ts/isDone), and since then
-- the column has been JSON-parsed and rewritten on every single answer while
-- nothing ever read it: adults place via bands.ts, kids via kids.ts.
ALTER TABLE test_sessions DROP COLUMN recent_levels;
