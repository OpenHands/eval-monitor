import { describe, it, expect } from 'vitest'
import { computeEvalTimeReport, EVAL_TIME_WARNING_MS, EVAL_TIME_CRITICAL_MS } from '../api'
import type { RunMetadata, RunListItemStatus } from '../api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a RunMetadata where every field is null by default. Pass overrides to
 *  set specific stage records, each optionally carrying a timestamp. */
function makeMetadata(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    init: null,
    params: null,
    error: null,
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
    cancelEval: null,
    ...overrides,
  }
}

/** Return an ISO timestamp string that is `offsetMs` milliseconds before `now`. */
function tsAgo(now: number, offsetMs: number): string {
  return new Date(now - offsetMs).toISOString()
}

// A fixed "now" used throughout so elapsed times are deterministic.
const NOW = 1_700_000_000_000

// Convenient elapsed-time constants relative to the thresholds.
const UNDER_WARNING = EVAL_TIME_WARNING_MS - 1          // 1 ms under 10 h
const AT_WARNING    = EVAL_TIME_WARNING_MS              // exactly 10 h
const BETWEEN       = EVAL_TIME_WARNING_MS + 1_000_000  // ~10 h 16 m 40 s
const AT_CRITICAL   = EVAL_TIME_CRITICAL_MS             // exactly 24 h
const OVER_CRITICAL = EVAL_TIME_CRITICAL_MS + 1         // 1 ms over 24 h

// ---------------------------------------------------------------------------
// computeEvalTimeReport
// ---------------------------------------------------------------------------

describe('computeEvalTimeReport', () => {

  // -------------------------------------------------------------------------
  // Empty / trivial input
  // -------------------------------------------------------------------------

  describe('empty metadataMap', () => {
    it('returns healthy state with zero entries and zero totalActive', () => {
      const report = computeEvalTimeReport({}, {}, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Finished runs are skipped entirely
  // -------------------------------------------------------------------------

  describe('finished runs', () => {
    it('skips completed runs', () => {
      const metadata = makeMetadata({ evalInferEnd: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })

    it('skips error runs', () => {
      const metadata = makeMetadata({ error: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })

    it('skips cancelled runs', () => {
      const metadata = makeMetadata({ cancelEval: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })

    it('skips all three finished statuses and reports zero totalActive', () => {
      const completed = makeMetadata({ evalInferEnd: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const errored   = makeMetadata({ error: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const cancelled = makeMetadata({ cancelEval: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'a/b/1': completed, 'a/b/2': errored, 'a/b/3': cancelled },
        {},
        NOW,
      )
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Active run under the warning threshold → healthy
  // -------------------------------------------------------------------------

  describe('active run under warning threshold', () => {
    it('counts the run in totalActive but emits no entries and stays healthy', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, UNDER_WARNING) } })
      // getStageStatus will return 'building' (params present, nothing else)
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Threshold boundary: warning
  // -------------------------------------------------------------------------

  describe('warning threshold boundary', () => {
    it('triggers warning when elapsed equals EVAL_TIME_WARNING_MS exactly', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_WARNING) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('warning')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(AT_WARNING)
      expect(report.totalActive).toBe(1)
    })

    it('emits an entry for a run between warning and critical thresholds', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, BETWEEN) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('warning')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(BETWEEN)
    })
  })

  // -------------------------------------------------------------------------
  // Threshold boundary: critical
  // -------------------------------------------------------------------------

  describe('critical threshold boundary', () => {
    it('triggers critical when elapsed equals EVAL_TIME_CRITICAL_MS exactly', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_CRITICAL) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('critical')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(AT_CRITICAL)
    })

    it('triggers critical when elapsed exceeds EVAL_TIME_CRITICAL_MS', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('critical')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(OVER_CRITICAL)
    })
  })

  // -------------------------------------------------------------------------
  // Mixed warning + critical → overall state is critical
  // -------------------------------------------------------------------------

  describe('mix of warning and critical entries', () => {
    it('reports critical when any entry reaches EVAL_TIME_CRITICAL_MS', () => {
      const warnRun     = makeMetadata({ params: { timestamp: tsAgo(NOW, BETWEEN) } })
      const criticalRun = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'slug/warn/1': warnRun, 'slug/crit/1': criticalRun },
        {},
        NOW,
      )
      expect(report.state).toBe('critical')
      expect(report.entries).toHaveLength(2)
      expect(report.totalActive).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // Sorting: longest-running first
  // -------------------------------------------------------------------------

  describe('sorting', () => {
    it('returns entries sorted longest elapsed time first', () => {
      const slow     = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_CRITICAL) } })
      const moderate = makeMetadata({ params: { timestamp: tsAgo(NOW, BETWEEN) } })
      const fastest  = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_WARNING) } })
      const report = computeEvalTimeReport(
        { 'slug/fast/1': fastest, 'slug/slow/1': slow, 'slug/mod/1': moderate },
        {},
        NOW,
      )
      expect(report.entries[0].elapsedMs).toBeGreaterThanOrEqual(report.entries[1].elapsedMs)
      expect(report.entries[1].elapsedMs).toBeGreaterThanOrEqual(report.entries[2].elapsedMs)
      // The absolute values must match too
      expect(report.entries[0].elapsedMs).toBe(AT_CRITICAL)
      expect(report.entries[1].elapsedMs).toBe(BETWEEN)
      expect(report.entries[2].elapsedMs).toBe(AT_WARNING)
    })
  })

  // -------------------------------------------------------------------------
  // Stage labels
  // -------------------------------------------------------------------------

  describe('stageLabel per status', () => {
    it('produces "Building" for building status', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_WARNING) } })
      // getStageStatus → 'building' (params present, no other signals)
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.entries[0].stageLabel).toBe('Building')
      expect(report.entries[0].status).toBe('building')
    })

    it('produces "Inference" for running-infer status', () => {
      const metadata = makeMetadata({
        params: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
        init: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
        runInferStart: { timestamp: tsAgo(NOW, AT_WARNING) },
      })
      // getStageStatus → 'running-infer' (runInferStart present, no runInferEnd)
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.entries[0].stageLabel).toBe('Inference')
      expect(report.entries[0].status).toBe('running-infer')
    })

    it('produces "Evaluation" for running-eval status via evalInferStart', () => {
      const metadata = makeMetadata({
        params: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
        runInferStart: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
        runInferEnd: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
        evalInferStart: { timestamp: tsAgo(NOW, AT_WARNING) },
      })
      // getStageStatus → 'running-eval' (evalInferStart present, no evalInferEnd)
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.entries[0].stageLabel).toBe('Evaluation')
      expect(report.entries[0].status).toBe('running-eval')
    })

    it('produces "Pending" for pending status', () => {
      const metadata = makeMetadata({ init: { timestamp: tsAgo(NOW, AT_WARNING) } })
      // getStageStatus → 'pending' (init present, no params)
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.entries[0].stageLabel).toBe('Pending')
      expect(report.entries[0].status).toBe('pending')
    })
  })

  // -------------------------------------------------------------------------
  // Stage start timestamp selection
  // -------------------------------------------------------------------------

  describe('stageStartMs timestamp selection', () => {
    describe('building stage uses params.timestamp', () => {
      it('uses params.timestamp as the start time for building runs', () => {
        const startMs = AT_WARNING + 5000
        const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, startMs) } })
        const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
        expect(report.entries[0].elapsedMs).toBe(startMs)
      })
    })

    describe('running-infer stage uses runInferStart.timestamp', () => {
      it('uses runInferStart.timestamp as the start time', () => {
        const startMs = AT_WARNING + 7000
        const metadata = makeMetadata({
          params: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          init: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          runInferStart: { timestamp: tsAgo(NOW, startMs) },
        })
        const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
        expect(report.entries[0].status).toBe('running-infer')
        expect(report.entries[0].elapsedMs).toBe(startMs)
      })
    })

    describe('running-eval stage uses evalInferStart.timestamp with runInferEnd fallback', () => {
      it('uses evalInferStart.timestamp when present', () => {
        const startMs = AT_WARNING + 3000
        const metadata = makeMetadata({
          params: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          runInferStart: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          runInferEnd: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          evalInferStart: { timestamp: tsAgo(NOW, startMs) },
        })
        const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
        expect(report.entries[0].status).toBe('running-eval')
        expect(report.entries[0].elapsedMs).toBe(startMs)
      })

      it('falls back to runInferEnd.timestamp when evalInferStart is absent', () => {
        const startMs = AT_WARNING + 9000
        const metadata = makeMetadata({
          params: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          runInferStart: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
          runInferEnd: { timestamp: tsAgo(NOW, startMs) },
          // evalInferStart is null — getStageStatus will still return 'running-eval'
          // because runInferEnd is set
        })
        const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
        expect(report.entries[0].status).toBe('running-eval')
        expect(report.entries[0].elapsedMs).toBe(startMs)
      })
    })

    describe('pending stage uses init.timestamp with params fallback', () => {
      it('uses init.timestamp as the start time when present', () => {
        const startMs = AT_WARNING + 2000
        const metadata = makeMetadata({ init: { timestamp: tsAgo(NOW, startMs) } })
        const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
        expect(report.entries[0].status).toBe('pending')
        expect(report.entries[0].elapsedMs).toBe(startMs)
      })

      it('falls back to params.timestamp when init has no timestamp', () => {
        const startMs = AT_WARNING + 4000
        const metadata = makeMetadata({
          init: { some_other_field: 'value' },        // no timestamp
          params: { timestamp: tsAgo(NOW, startMs) },
        })
        // getStageStatus: init present → 'pending'; stageStartMs: init ts null → falls back to params ts
        const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
        expect(report.entries[0].status).toBe('pending')
        expect(report.entries[0].elapsedMs).toBe(startMs)
      })
    })
  })

  // -------------------------------------------------------------------------
  // preStatuses override
  // -------------------------------------------------------------------------

  describe('preStatuses override', () => {
    it('uses the preStatus instead of deriving status from metadata', () => {
      // Metadata alone would indicate 'building' (only params present, no infer data).
      // We override to 'running-infer', so stageStartMs will look at runInferStart.
      const startMs = AT_WARNING + 1000
      const metadata = makeMetadata({
        params: { timestamp: tsAgo(NOW, OVER_CRITICAL) },
        runInferStart: { timestamp: tsAgo(NOW, startMs) },
      })
      const report = computeEvalTimeReport(
        { 'slug/a/1': metadata },
        { 'slug/a/1': 'running-infer' },
        NOW,
      )
      expect(report.entries[0].status).toBe('running-infer')
      expect(report.entries[0].elapsedMs).toBe(startMs)
    })

    it('treats a run as finished when preStatus is completed, skipping it', () => {
      // Metadata alone would derive 'building'; preStatus overrides to 'completed'.
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'slug/a/1': metadata },
        { 'slug/a/1': 'completed' },
        NOW,
      )
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })

    it('treats a run as finished when preStatus is error, skipping it', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'slug/a/1': metadata },
        { 'slug/a/1': 'error' },
        NOW,
      )
      expect(report.totalActive).toBe(0)
    })

    it('treats a run as finished when preStatus is cancelled, skipping it', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'slug/a/1': metadata },
        { 'slug/a/1': 'cancelled' },
        NOW,
      )
      expect(report.totalActive).toBe(0)
    })

    it('only applies preStatus override to the matching slug', () => {
      const slow    = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_CRITICAL) } })
      const overridden = makeMetadata({ params: { timestamp: tsAgo(NOW, OVER_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'slug/slow/1': slow, 'slug/done/1': overridden },
        { 'slug/done/1': 'completed' },
        NOW,
      )
      // Only 'slug/slow/1' should remain active
      expect(report.totalActive).toBe(1)
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].slug).toBe('slug/slow/1')
    })
  })

  // -------------------------------------------------------------------------
  // Missing timestamp → counted in totalActive but not in entries
  // -------------------------------------------------------------------------

  describe('run with no timestamp in stage metadata', () => {
    it('counts the run in totalActive but excludes it from entries', () => {
      // Status will be 'building' (params present), but params has no timestamp.
      const metadata = makeMetadata({ params: { model_id: 'gpt-4' } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(1)
    })

    it('still counts correctly when mixed with slow runs that do have timestamps', () => {
      const noTs = makeMetadata({ params: { model_id: 'gpt-4' } })
      const slow = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_CRITICAL) } })
      const report = computeEvalTimeReport(
        { 'slug/no-ts/1': noTs, 'slug/slow/1': slow },
        {},
        NOW,
      )
      expect(report.totalActive).toBe(2)
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].slug).toBe('slug/slow/1')
    })

    it('treats an invalid (non-parseable) timestamp as missing', () => {
      const metadata = makeMetadata({ params: { timestamp: 'not-a-date' } })
      const report = computeEvalTimeReport({ 'slug/a/1': metadata }, {}, NOW)
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Entry fields are correct
  // -------------------------------------------------------------------------

  describe('entry shape', () => {
    it('populates all entry fields correctly', () => {
      const metadata = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_WARNING) } })
      const report = computeEvalTimeReport({ 'bench/model/42': metadata }, {}, NOW)
      const entry = report.entries[0]
      expect(entry.slug).toBe('bench/model/42')
      expect(entry.status).toBe('building')
      expect(entry.stageLabel).toBe('Building')
      expect(entry.elapsedMs).toBe(AT_WARNING)
    })
  })

  // -------------------------------------------------------------------------
  // totalActive counts all non-finished runs regardless of threshold
  // -------------------------------------------------------------------------

  describe('totalActive count', () => {
    it('includes active runs that are below the warning threshold in totalActive', () => {
      const active1 = makeMetadata({ params: { timestamp: tsAgo(NOW, UNDER_WARNING) } })
      const active2 = makeMetadata({ params: { timestamp: tsAgo(NOW, AT_WARNING) } })
      const report = computeEvalTimeReport(
        { 'slug/a/1': active1, 'slug/b/1': active2 },
        {},
        NOW,
      )
      expect(report.totalActive).toBe(2)
      // Only the run at the threshold shows in entries
      expect(report.entries).toHaveLength(1)
    })
  })
})
