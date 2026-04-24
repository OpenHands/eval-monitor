import { describe, it, expect } from 'vitest'
import { computeEvalTimeReport, EVAL_TIME_WARNING_MS, EVAL_TIME_CRITICAL_MS } from '../api'
import type { RunListItem, RunListItemStatus } from '../api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return an ISO timestamp string that is `offsetMs` milliseconds before `now`. */
function tsAgo(now: number, offsetMs: number): string {
  return new Date(now - offsetMs).toISOString()
}

/** Build a minimal RunListItem, overriding whatever fields the test needs. */
function makeRun(overrides: Partial<RunListItem> & { slug?: string } = {}): RunListItem {
  return {
    slug: 'bench/model/1',
    ...overrides,
  }
}

// A fixed "now" used throughout so elapsed times are deterministic.
const NOW = 1_700_000_000_000

// Convenient elapsed-time constants relative to the thresholds.
const UNDER_WARNING = EVAL_TIME_WARNING_MS - 1
const AT_WARNING    = EVAL_TIME_WARNING_MS
const BETWEEN       = EVAL_TIME_WARNING_MS + 1_000_000
const AT_CRITICAL   = EVAL_TIME_CRITICAL_MS
const OVER_CRITICAL = EVAL_TIME_CRITICAL_MS + 1

// ---------------------------------------------------------------------------
// computeEvalTimeReport
// ---------------------------------------------------------------------------

describe('computeEvalTimeReport', () => {

  describe('empty input', () => {
    it('returns healthy state with zero entries and zero totalActive', () => {
      const report = computeEvalTimeReport([], NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })
  })

  describe('runs without a status', () => {
    it('ignores runs that have no status at all', () => {
      const run = makeRun({ slug: 'a/b/1', initTimestamp: tsAgo(NOW, AT_CRITICAL) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('healthy')
      expect(report.totalActive).toBe(0)
      expect(report.entries).toEqual([])
    })
  })

  describe('finished runs', () => {
    const finishedStatuses: RunListItemStatus[] = ['completed', 'error', 'cancelled']

    for (const status of finishedStatuses) {
      it(`skips ${status} runs entirely`, () => {
        const run = makeRun({ status, initTimestamp: tsAgo(NOW, OVER_CRITICAL) })
        const report = computeEvalTimeReport([run], NOW)
        expect(report.state).toBe('healthy')
        expect(report.entries).toEqual([])
        expect(report.totalActive).toBe(0)
      })
    }

    it('skips all three finished statuses together', () => {
      const runs: RunListItem[] = [
        { slug: 'a/b/1', status: 'completed', initTimestamp: tsAgo(NOW, OVER_CRITICAL) },
        { slug: 'a/b/2', status: 'error',     initTimestamp: tsAgo(NOW, OVER_CRITICAL) },
        { slug: 'a/b/3', status: 'cancelled', initTimestamp: tsAgo(NOW, OVER_CRITICAL) },
      ]
      const report = computeEvalTimeReport(runs, NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(0)
    })
  })

  describe('active run under warning threshold', () => {
    it('counts the run in totalActive but emits no entries and stays healthy', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, UNDER_WARNING) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(1)
    })
  })

  describe('warning threshold boundary', () => {
    it('triggers warning when elapsed equals EVAL_TIME_WARNING_MS exactly', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, AT_WARNING) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('warning')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(AT_WARNING)
      expect(report.totalActive).toBe(1)
    })

    it('emits an entry for a run between warning and critical thresholds', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, BETWEEN) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('warning')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(BETWEEN)
    })
  })

  describe('critical threshold boundary', () => {
    it('triggers critical when elapsed equals EVAL_TIME_CRITICAL_MS exactly', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, AT_CRITICAL) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('critical')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(AT_CRITICAL)
    })

    it('triggers critical when elapsed exceeds EVAL_TIME_CRITICAL_MS', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, OVER_CRITICAL) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('critical')
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].elapsedMs).toBe(OVER_CRITICAL)
    })
  })

  describe('mix of warning and critical entries', () => {
    it('reports critical when any entry reaches EVAL_TIME_CRITICAL_MS', () => {
      const runs: RunListItem[] = [
        { slug: 'a/warn/1', status: 'building', initTimestamp: tsAgo(NOW, BETWEEN) },
        { slug: 'a/crit/1', status: 'building', initTimestamp: tsAgo(NOW, AT_CRITICAL) },
      ]
      const report = computeEvalTimeReport(runs, NOW)
      expect(report.state).toBe('critical')
      expect(report.entries).toHaveLength(2)
      expect(report.totalActive).toBe(2)
    })
  })

  describe('sorting', () => {
    it('returns entries sorted longest elapsed time first', () => {
      const runs: RunListItem[] = [
        { slug: 'fast',  status: 'building', initTimestamp: tsAgo(NOW, AT_WARNING) },
        { slug: 'slow',  status: 'building', initTimestamp: tsAgo(NOW, AT_CRITICAL) },
        { slug: 'mod',   status: 'building', initTimestamp: tsAgo(NOW, BETWEEN) },
      ]
      const report = computeEvalTimeReport(runs, NOW)
      expect(report.entries[0].elapsedMs).toBe(AT_CRITICAL)
      expect(report.entries[1].elapsedMs).toBe(BETWEEN)
      expect(report.entries[2].elapsedMs).toBe(AT_WARNING)
    })
  })

  describe('stageLabel per status', () => {
    it('produces "Building" for building status', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, AT_WARNING) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].stageLabel).toBe('Building')
      expect(report.entries[0].status).toBe('building')
    })

    it('produces "Inference" for running-infer status', () => {
      const run = makeRun({
        status: 'running-infer',
        initTimestamp: tsAgo(NOW, OVER_CRITICAL),
        inferStartTimestamp: tsAgo(NOW, AT_WARNING),
      })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].stageLabel).toBe('Inference')
      expect(report.entries[0].status).toBe('running-infer')
    })

    it('produces "Evaluation" for running-eval status', () => {
      const run = makeRun({
        status: 'running-eval',
        initTimestamp: tsAgo(NOW, OVER_CRITICAL),
        inferStartTimestamp: tsAgo(NOW, OVER_CRITICAL),
        evalStartTimestamp: tsAgo(NOW, AT_WARNING),
      })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].stageLabel).toBe('Evaluation')
      expect(report.entries[0].status).toBe('running-eval')
    })

    it('produces "Pending" for pending status', () => {
      const run = makeRun({ status: 'pending', initTimestamp: tsAgo(NOW, AT_WARNING) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].stageLabel).toBe('Pending')
      expect(report.entries[0].status).toBe('pending')
    })
  })

  describe('stage start timestamp selection', () => {
    it('building stage uses initTimestamp as the start time', () => {
      const startMs = AT_WARNING + 5000
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, startMs) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].elapsedMs).toBe(startMs)
    })

    it('pending stage uses initTimestamp as the start time', () => {
      const startMs = AT_WARNING + 2000
      const run = makeRun({ status: 'pending', initTimestamp: tsAgo(NOW, startMs) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].elapsedMs).toBe(startMs)
    })

    it('running-infer stage uses inferStartTimestamp as the start time', () => {
      const startMs = AT_WARNING + 7000
      const run = makeRun({
        status: 'running-infer',
        initTimestamp: tsAgo(NOW, OVER_CRITICAL),
        inferStartTimestamp: tsAgo(NOW, startMs),
      })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].elapsedMs).toBe(startMs)
    })

    it('running-eval stage uses evalStartTimestamp when present', () => {
      const startMs = AT_WARNING + 3000
      const run = makeRun({
        status: 'running-eval',
        initTimestamp: tsAgo(NOW, OVER_CRITICAL),
        inferStartTimestamp: tsAgo(NOW, OVER_CRITICAL),
        evalStartTimestamp: tsAgo(NOW, startMs),
      })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].elapsedMs).toBe(startMs)
    })

    it('running-eval falls back to inferStartTimestamp when evalStartTimestamp is absent', () => {
      const startMs = AT_WARNING + 9000
      const run = makeRun({
        status: 'running-eval',
        initTimestamp: tsAgo(NOW, OVER_CRITICAL),
        inferStartTimestamp: tsAgo(NOW, startMs),
      })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].elapsedMs).toBe(startMs)
    })
  })

  describe('missing / invalid timestamp', () => {
    it('counts the run in totalActive but excludes it from entries when timestamp is absent', () => {
      const run = makeRun({ status: 'building' })  // no initTimestamp
      const report = computeEvalTimeReport([run], NOW)
      expect(report.state).toBe('healthy')
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(1)
    })

    it('treats an unparseable timestamp as missing', () => {
      const run = makeRun({ status: 'building', initTimestamp: 'not-a-date' })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries).toEqual([])
      expect(report.totalActive).toBe(1)
    })

    it('still counts correctly when mixed with slow runs that do have timestamps', () => {
      const runs: RunListItem[] = [
        { slug: 'no-ts', status: 'building' },
        { slug: 'slow',  status: 'building', initTimestamp: tsAgo(NOW, AT_CRITICAL) },
      ]
      const report = computeEvalTimeReport(runs, NOW)
      expect(report.totalActive).toBe(2)
      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].slug).toBe('slow')
    })
  })

  describe('entry shape', () => {
    it('populates all entry fields correctly', () => {
      const run: RunListItem = {
        slug: 'bench/model/42',
        status: 'building',
        initTimestamp: tsAgo(NOW, AT_WARNING),
        triggeredBy: 'alice',
      }
      const report = computeEvalTimeReport([run], NOW)
      const entry = report.entries[0]
      expect(entry.slug).toBe('bench/model/42')
      expect(entry.status).toBe('building')
      expect(entry.stageLabel).toBe('Building')
      expect(entry.elapsedMs).toBe(AT_WARNING)
      expect(entry.triggeredBy).toBe('alice')
    })
  })

  describe('triggeredBy', () => {
    it('uses the RunListItem.triggeredBy value directly', () => {
      const run = makeRun({
        status: 'building',
        initTimestamp: tsAgo(NOW, AT_WARNING),
        triggeredBy: 'juanmichelini',
      })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].triggeredBy).toBe('juanmichelini')
    })

    it('returns "—" when triggeredBy is not set', () => {
      const run = makeRun({ status: 'building', initTimestamp: tsAgo(NOW, AT_WARNING) })
      const report = computeEvalTimeReport([run], NOW)
      expect(report.entries[0].triggeredBy).toBe('—')
    })
  })

  describe('totalActive count', () => {
    it('includes active runs that are below the warning threshold', () => {
      const runs: RunListItem[] = [
        { slug: 'a', status: 'building', initTimestamp: tsAgo(NOW, UNDER_WARNING) },
        { slug: 'b', status: 'building', initTimestamp: tsAgo(NOW, AT_WARNING) },
      ]
      const report = computeEvalTimeReport(runs, NOW)
      expect(report.totalActive).toBe(2)
      expect(report.entries).toHaveLength(1)  // only the one at/over threshold
    })
  })
})
