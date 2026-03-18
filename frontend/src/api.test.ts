import { describe, it, expect } from 'vitest'
import {
  getRuntime,
  getStartTimestamp,
  getEndTimestamp,
  isFinished,
  formatDurationMs,
  getStageStatus,
  getLatestTimestamp,
  STALE_THRESHOLD_MS,
} from './api'
import type { RunMetadata } from './api'

function makeMetadata(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    init: null,
    params: null,
    error: null,
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
    ...overrides,
  }
}

const ts = (iso: string) => ({ timestamp: iso })

describe('formatDurationMs', () => {
  it('returns — for negative durations', () => {
    expect(formatDurationMs(-1000)).toBe('—')
  })

  it('formats seconds', () => {
    expect(formatDurationMs(45_000)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDurationMs(125_000)).toBe('2m 5s')
  })

  it('formats hours and minutes', () => {
    expect(formatDurationMs(3_723_000)).toBe('1h 2m')
  })

  it('returns 0s for zero', () => {
    expect(formatDurationMs(0)).toBe('0s')
  })
})

describe('getStartTimestamp', () => {
  it('returns params timestamp when available', () => {
    const m = makeMetadata({ params: ts('2025-01-01T10:00:00Z') })
    expect(getStartTimestamp(m)).toBe(new Date('2025-01-01T10:00:00Z').getTime())
  })

  it('returns null when params has no timestamp', () => {
    const m = makeMetadata({
      params: { foo: 'bar' },
      init: ts('2025-01-01T10:00:00Z'),
    })
    expect(getStartTimestamp(m)).toBeNull()
  })

  it('returns null when params is missing', () => {
    const m = makeMetadata({ init: ts('2025-01-01T10:00:00Z') })
    expect(getStartTimestamp(m)).toBeNull()
  })

  it('returns null when no metadata exists', () => {
    const m = makeMetadata()
    expect(getStartTimestamp(m)).toBeNull()
  })
})

describe('getEndTimestamp', () => {
  it('returns evalInferEnd for completed runs', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
      evalInferEnd: ts('2025-01-01T12:00:00Z'),
    })
    expect(getEndTimestamp(m)).toBe(new Date('2025-01-01T12:00:00Z').getTime())
  })

  it('returns error timestamp for errored runs', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      error: ts('2025-01-01T10:30:00Z'),
    })
    expect(getEndTimestamp(m)).toBe(new Date('2025-01-01T10:30:00Z').getTime())
  })

  it('returns null for running-infer (not finished)', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    expect(getEndTimestamp(m)).toBeNull()
  })

  it('returns null for running-eval (not finished)', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
    })
    expect(getEndTimestamp(m)).toBeNull()
  })
})

describe('isFinished', () => {
  it('returns true for completed', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      evalInferEnd: ts('2025-01-01T12:00:00Z'),
    })
    expect(isFinished(m)).toBe(true)
  })

  it('returns true for error', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      error: ts('2025-01-01T10:30:00Z'),
    })
    expect(isFinished(m)).toBe(true)
  })

  it('returns false for running-infer', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    expect(isFinished(m)).toBe(false)
  })

  it('returns false for pending', () => {
    const m = makeMetadata({ init: ts('2025-01-01T10:00:00Z') })
    expect(isFinished(m)).toBe(false)
  })
})

describe('getRuntime', () => {
  it('returns formatted duration for completed run', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
      evalInferEnd: ts('2025-01-01T12:00:00Z'),
    })
    expect(getRuntime(m)).toBe('2h 0m')
  })

  it('returns formatted duration for errored run', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      error: ts('2025-01-01T10:30:00Z'),
    })
    expect(getRuntime(m)).toBe('30m 0s')
  })

  it('uses current time (now param) for non-finished runs', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    const fakeNow = new Date('2025-01-01T10:20:00Z').getTime()
    expect(getRuntime(m, fakeNow)).toBe('20m 0s')
  })

  it('uses current time for pending runs with params', () => {
    const m = makeMetadata({ params: ts('2025-01-01T10:00:00Z') })
    const fakeNow = new Date('2025-01-01T10:03:00Z').getTime()
    expect(getRuntime(m, fakeNow)).toBe('3m 0s')
  })

  it('uses current time for running-eval', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
    })
    const fakeNow = new Date('2025-01-01T12:30:00Z').getTime()
    expect(getRuntime(m, fakeNow)).toBe('2h 30m')
  })

  it('returns null when no params timestamp exists', () => {
    const m = makeMetadata()
    expect(getRuntime(m)).toBeNull()
  })

  it('returns null when params has no timestamp', () => {
    const m = makeMetadata({ params: { foo: 'bar' } })
    expect(getRuntime(m)).toBeNull()
  })

  it('returns null when only init exists (no params)', () => {
    const m = makeMetadata({ init: ts('2025-01-01T10:00:00Z') })
    expect(getRuntime(m)).toBeNull()
  })
})

describe('getStageStatus', () => {
  it('returns error when error exists', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      error: ts('2025-01-01T10:30:00Z'),
    })
    expect(getStageStatus(m)).toBe('error')
  })

  it('returns completed when evalInferEnd exists', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      evalInferEnd: ts('2025-01-01T12:00:00Z'),
    })
    expect(getStageStatus(m)).toBe('completed')
  })

  it('returns running-infer when only runInferStart', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    expect(getStageStatus(m)).toBe('running-infer')
  })

  it('returns running-eval when evalInferStart exists', () => {
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
    })
    expect(getStageStatus(m)).toBe('running-eval')
  })

  it('returns pending when only init', () => {
    const m = makeMetadata({ init: ts('2025-01-01T10:00:00Z') })
    expect(getStageStatus(m)).toBe('pending')
  })

  it('returns building when only params exists (no init yet)', () => {
    const m = makeMetadata({ params: ts('2025-01-01T10:00:00Z') })
    expect(getStageStatus(m)).toBe('building')
  })

  it('returns pending when nothing exists', () => {
    const m = makeMetadata()
    expect(getStageStatus(m)).toBe('pending')
  })
})

describe('STALE_THRESHOLD_MS', () => {
  it('is 5 hours in milliseconds', () => {
    expect(STALE_THRESHOLD_MS).toBe(5 * 60 * 60 * 1000)
  })
})

describe('getLatestTimestamp', () => {
  it('returns null when no metadata has timestamps', () => {
    const m = makeMetadata()
    expect(getLatestTimestamp(m)).toBeNull()
  })

  it('returns the params timestamp when only params exists', () => {
    const m = makeMetadata({ params: ts('2025-01-01T10:00:00Z') })
    expect(getLatestTimestamp(m)).toBe(new Date('2025-01-01T10:00:00Z').getTime())
  })

  it('returns the most recent timestamp (evalInferEnd)', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      init: ts('2025-01-01T10:05:00Z'),
      runInferStart: ts('2025-01-01T10:06:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
      evalInferEnd: ts('2025-01-01T12:00:00Z'),
    })
    expect(getLatestTimestamp(m)).toBe(new Date('2025-01-01T12:00:00Z').getTime())
  })

  it('returns runInferStart when it is the latest', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      init: ts('2025-01-01T10:05:00Z'),
      runInferStart: ts('2025-01-01T10:06:00Z'),
    })
    expect(getLatestTimestamp(m)).toBe(new Date('2025-01-01T10:06:00Z').getTime())
  })

  it('ignores metadata entries without timestamps', () => {
    const m = makeMetadata({
      params: { no_timestamp: true },
      init: ts('2025-01-01T10:05:00Z'),
    })
    expect(getLatestTimestamp(m)).toBe(new Date('2025-01-01T10:05:00Z').getTime())
  })

  it('returns null when all metadata entries lack timestamps', () => {
    const m = makeMetadata({
      params: { no_timestamp: true },
      init: { no_timestamp: true },
    })
    expect(getLatestTimestamp(m)).toBeNull()
  })
})

describe('getStageStatus with dead detection', () => {
  it('returns dead for a running-infer run that is stale', () => {
    const startTime = new Date('2025-01-01T10:00:00Z').getTime()
    const m = makeMetadata({
      params: ts('2025-01-01T09:55:00Z'),
      init: ts('2025-01-01T09:58:00Z'),
      runInferStart: ts('2025-01-01T10:00:00Z'),
    })
    const now = startTime + STALE_THRESHOLD_MS + 1
    expect(getStageStatus(m, now)).toBe('dead')
  })

  it('returns running-infer for a recent run with now provided', () => {
    const startTime = new Date('2025-01-01T10:00:00Z').getTime()
    const m = makeMetadata({
      params: ts('2025-01-01T09:55:00Z'),
      init: ts('2025-01-01T09:58:00Z'),
      runInferStart: ts('2025-01-01T10:00:00Z'),
    })
    const now = startTime + STALE_THRESHOLD_MS - 1000 // just under threshold
    expect(getStageStatus(m, now)).toBe('running-infer')
  })

  it('returns dead for a running-eval run that is stale', () => {
    const latestTime = new Date('2025-01-01T11:05:00Z').getTime()
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      init: ts('2025-01-01T10:05:00Z'),
      runInferStart: ts('2025-01-01T10:06:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
    })
    const now = latestTime + STALE_THRESHOLD_MS + 1
    expect(getStageStatus(m, now)).toBe('dead')
  })

  it('returns dead for a building run that is stale', () => {
    const paramTime = new Date('2025-01-01T10:00:00Z').getTime()
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
    })
    const now = paramTime + STALE_THRESHOLD_MS + 1
    expect(getStageStatus(m, now)).toBe('dead')
  })

  it('returns dead for a pending run (init only) that is stale', () => {
    const initTime = new Date('2025-01-01T10:00:00Z').getTime()
    const m = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
    })
    const now = initTime + STALE_THRESHOLD_MS + 1
    expect(getStageStatus(m, now)).toBe('dead')
  })

  it('does not return dead for completed runs regardless of age', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      init: ts('2025-01-01T10:05:00Z'),
      evalInferEnd: ts('2025-01-01T12:00:00Z'),
    })
    const veryLateNow = new Date('2025-06-01T00:00:00Z').getTime()
    expect(getStageStatus(m, veryLateNow)).toBe('completed')
  })

  it('does not return dead for error runs regardless of age', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      error: ts('2025-01-01T10:30:00Z'),
    })
    const veryLateNow = new Date('2025-06-01T00:00:00Z').getTime()
    expect(getStageStatus(m, veryLateNow)).toBe('error')
  })

  it('does not return dead when now is not provided even for old timestamps', () => {
    const m = makeMetadata({
      params: ts('2020-01-01T10:00:00Z'),
      init: ts('2020-01-01T10:05:00Z'),
      runInferStart: ts('2020-01-01T10:06:00Z'),
    })
    // Without now parameter, staleness detection is not active
    expect(getStageStatus(m)).toBe('running-infer')
  })

  it('does not return dead for empty metadata even with now', () => {
    const m = makeMetadata()
    const now = Date.now()
    expect(getStageStatus(m, now)).toBe('pending')
  })
})

describe('isFinished with dead detection', () => {
  it('returns true for dead runs', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    const now = new Date('2025-01-01T10:05:00Z').getTime() + STALE_THRESHOLD_MS + 1
    expect(isFinished(m, now)).toBe(true)
  })

  it('returns false for active runs that are not stale', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    const now = new Date('2025-01-01T10:10:00Z').getTime()
    expect(isFinished(m, now)).toBe(false)
  })
})

describe('getEndTimestamp with dead detection', () => {
  it('returns latest timestamp for dead runs', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      init: ts('2025-01-01T10:05:00Z'),
      runInferStart: ts('2025-01-01T10:06:00Z'),
    })
    const now = new Date('2025-01-01T10:06:00Z').getTime() + STALE_THRESHOLD_MS + 1
    expect(getEndTimestamp(m, now)).toBe(new Date('2025-01-01T10:06:00Z').getTime())
  })

  it('returns null for active non-stale runs', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    const now = new Date('2025-01-01T10:10:00Z').getTime()
    expect(getEndTimestamp(m, now)).toBeNull()
  })
})

describe('getRuntime with dead detection', () => {
  it('returns fixed runtime for dead runs', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      init: ts('2025-01-01T10:05:00Z'),
      runInferStart: ts('2025-01-01T10:06:00Z'),
    })
    // now is well past stale threshold
    const now = new Date('2025-01-01T10:06:00Z').getTime() + STALE_THRESHOLD_MS + 60000
    const runtime = getRuntime(m, now)
    // Runtime should be from params to runInferStart (latest), not to "now"
    expect(runtime).toBe('6m 0s') // 10:00 -> 10:06
  })

  it('returns live runtime for active non-stale runs', () => {
    const m = makeMetadata({
      params: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    const now = new Date('2025-01-01T10:20:00Z').getTime()
    expect(getRuntime(m, now)).toBe('20m 0s')
  })
})
