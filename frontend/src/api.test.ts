import { describe, it, expect } from 'vitest'
import { formatRuntime, computeRuntime } from './api'
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

function ts(isoString: string): Record<string, unknown> {
  return { timestamp: isoString }
}

describe('formatRuntime', () => {
  it('returns dash for negative diff', () => {
    expect(formatRuntime(-1000)).toBe('—')
  })

  it('returns 0m for zero diff', () => {
    expect(formatRuntime(0)).toBe('0m')
  })

  it('returns minutes only when less than an hour', () => {
    expect(formatRuntime(30 * 60_000)).toBe('30m')
  })

  it('returns hours and minutes for longer durations', () => {
    expect(formatRuntime(90 * 60_000)).toBe('1h 30m')
  })

  it('returns hours and 0m for exact hours', () => {
    expect(formatRuntime(2 * 3600_000)).toBe('2h 0m')
  })

  it('truncates seconds (does not round)', () => {
    // 59 seconds = 0m
    expect(formatRuntime(59_000)).toBe('0m')
    // 61 seconds = 1m
    expect(formatRuntime(61_000)).toBe('1m')
  })
})

describe('computeRuntime', () => {
  it('returns null for pending jobs (no start metadata)', () => {
    const meta = makeMetadata({ init: { timestamp: '2025-01-01T00:00:00Z' } })
    expect(computeRuntime(meta)).toBeNull()
  })

  it('returns null when no metadata at all', () => {
    const meta = makeMetadata()
    expect(computeRuntime(meta)).toBeNull()
  })

  it('computes total runtime for a completed job', () => {
    const meta = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      runInferEnd: ts('2025-01-01T11:00:00Z'),
      evalInferStart: ts('2025-01-01T11:05:00Z'),
      evalInferEnd: ts('2025-01-01T12:30:00Z'),
    })
    // 2h 30m from init to evalInferEnd
    expect(computeRuntime(meta)).toBe('2h 30m')
  })

  it('computes total runtime for an errored job', () => {
    const meta = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
      error: ts('2025-01-01T10:45:00Z'),
    })
    // 45m from init to error
    expect(computeRuntime(meta)).toBe('45m')
  })

  it('computes elapsed time for a running job (running-infer)', () => {
    const meta = makeMetadata({
      init: ts('2025-01-01T10:00:00Z'),
      runInferStart: ts('2025-01-01T10:05:00Z'),
    })
    const fakeNow = new Date('2025-01-01T11:30:00Z').getTime()
    // 1h 30m from init to now
    expect(computeRuntime(meta, fakeNow)).toBe('1h 30m')
  })

  it('computes elapsed time for a running job (running-eval)', () => {
    const meta = makeMetadata({
      init: ts('2025-01-01T08:00:00Z'),
      runInferStart: ts('2025-01-01T08:05:00Z'),
      runInferEnd: ts('2025-01-01T09:00:00Z'),
      evalInferStart: ts('2025-01-01T09:10:00Z'),
    })
    const fakeNow = new Date('2025-01-01T10:15:00Z').getTime()
    // 2h 15m from init to now
    expect(computeRuntime(meta, fakeNow)).toBe('2h 15m')
  })

  it('uses runInferStart as start time when init is missing', () => {
    const meta = makeMetadata({
      runInferStart: ts('2025-01-01T10:00:00Z'),
      runInferEnd: ts('2025-01-01T10:30:00Z'),
      evalInferStart: ts('2025-01-01T10:35:00Z'),
      evalInferEnd: ts('2025-01-01T11:00:00Z'),
    })
    // 1h from runInferStart to evalInferEnd
    expect(computeRuntime(meta)).toBe('1h 0m')
  })

  it('returns null when timestamp field is missing from data', () => {
    const meta = makeMetadata({
      runInferStart: { someOtherField: 'value' },
    })
    expect(computeRuntime(meta)).toBeNull()
  })
})
