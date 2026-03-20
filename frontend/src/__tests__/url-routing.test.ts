import { describe, it, expect } from 'vitest'
import { parseSearchParams, buildSearchString } from '../App'

describe('parseSearchParams', () => {
  const defaultDate = '2025-03-17'

  it('returns defaults when search string is empty', () => {
    const result = parseSearchParams('', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: null, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('parses date from search params', () => {
    const result = parseSearchParams('?date=2025-01-15', defaultDate)
    expect(result).toEqual({ date: '2025-01-15', run: null, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('parses run from search params', () => {
    const result = parseSearchParams('?run=swebench/model/123', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: 'swebench/model/123', numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('parses both date and run from search params', () => {
    const result = parseSearchParams('?date=2025-02-20&run=gaia/litellm_proxy-gpt4/456', defaultDate)
    expect(result).toEqual({ date: '2025-02-20', run: 'gaia/litellm_proxy-gpt4/456', numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('handles URL-encoded run slugs with slashes', () => {
    const result = parseSearchParams('?run=bench%2Fmodel%2Fjob', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: 'bench/model/job', numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('uses default date when date param is missing', () => {
    const result = parseSearchParams('?run=test/run/1', '2025-12-31')
    expect(result).toEqual({ date: '2025-12-31', run: 'test/run/1', numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('parses days param', () => {
    const result = parseSearchParams('?days=3', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: null, numDays: 3, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('clamps days param to valid range (1-7)', () => {
    expect(parseSearchParams('?days=0', defaultDate).numDays).toBe(2)
    expect(parseSearchParams('?days=8', defaultDate).numDays).toBe(2)
    expect(parseSearchParams('?days=-1', defaultDate).numDays).toBe(2)
    expect(parseSearchParams('?days=abc', defaultDate).numDays).toBe(2)
    expect(parseSearchParams('?days=7', defaultDate).numDays).toBe(7)
  })

  it('parses date, run, and days together', () => {
    const result = parseSearchParams('?date=2025-02-20&run=gaia/model/1&days=5', defaultDate)
    expect(result).toEqual({ date: '2025-02-20', run: 'gaia/model/1', numDays: 5, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('parses filters', () => {
    const result = parseSearchParams('?benchmark=swebench&status=completed&text=gpt4', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: null, numDays: 2, filterBenchmark: 'swebench', filterStatus: 'completed', filterText: 'gpt4' })
  })
})

describe('buildSearchString', () => {
  const today = '2025-03-17'

  it('returns empty string when date is today and no run', () => {
    const result = buildSearchString('2025-03-17', null, today)
    expect(result).toBe('')
  })

  it('includes date when it differs from today', () => {
    const result = buildSearchString('2025-01-15', null, today)
    expect(result).toBe('?date=2025-01-15')
  })

  it('includes run when provided', () => {
    const result = buildSearchString('2025-03-17', 'swebench/model/123', today)
    expect(result).toBe('?run=swebench%2Fmodel%2F123')
  })

  it('includes both date and run when date differs from today', () => {
    const result = buildSearchString('2025-02-20', 'gaia/gpt4/456', today)
    expect(result).toBe('?date=2025-02-20&run=gaia%2Fgpt4%2F456')
  })

  it('omits date param when date matches today', () => {
    const result = buildSearchString(today, 'bench/model/job', today)
    expect(result).toBe('?run=bench%2Fmodel%2Fjob')
  })

  it('omits days param when numDays is 2 (default)', () => {
    const result = buildSearchString(today, null, today, 2)
    expect(result).toBe('')
  })

  it('includes days param when numDays is not the default', () => {
    const result = buildSearchString(today, null, today, 3)
    expect(result).toBe('?days=3')
  })

  it('includes days param when numDays is 1', () => {
    const result = buildSearchString(today, null, today, 1)
    expect(result).toBe('?days=1')
  })

  it('includes filters when provided', () => {
    const result = buildSearchString(today, null, today, 2, 'swebench', 'completed', 'gpt4')
    expect(result).toBe('?benchmark=swebench&status=completed&text=gpt4')
  })

  it('includes days along with date and run', () => {
    const result = buildSearchString('2025-02-20', 'gaia/model/1', today, 5)
    expect(result).toBe('?date=2025-02-20&run=gaia%2Fmodel%2F1&days=5')
  })
})

describe('round-trip: buildSearchString -> parseSearchParams', () => {
  const today = '2025-03-17'

  it('round-trips a run selection with non-today date', () => {
    const date = '2025-01-10'
    const run = 'swebench/litellm_proxy-claude/789'
    const qs = buildSearchString(date, run, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date, run, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips a run selection with today date', () => {
    const run = 'gaia/model/42'
    const qs = buildSearchString(today, run, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips list view with non-today date', () => {
    const date = '2025-06-15'
    const qs = buildSearchString(date, null, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date, run: null, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips list view with today date', () => {
    const qs = buildSearchString(today, null, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run: null, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips with numDays > 2', () => {
    const date = '2025-02-20'
    const run = 'swebench/model/123'
    const numDays = 5
    const qs = buildSearchString(date, run, today, numDays)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date, run, numDays, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips with numDays = 2 (default omitted)', () => {
    const qs = buildSearchString(today, null, today, 2)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run: null, numDays: 2, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips with numDays = 1', () => {
    const qs = buildSearchString(today, null, today, 1)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run: null, numDays: 1, filterBenchmark: 'all', filterStatus: 'all', filterText: '' })
  })

  it('round-trips with filters', () => {
    const qs = buildSearchString(today, null, today, 2, 'swebench', 'completed', 'gpt4')
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run: null, numDays: 2, filterBenchmark: 'swebench', filterStatus: 'completed', filterText: 'gpt4' })
  })
})
