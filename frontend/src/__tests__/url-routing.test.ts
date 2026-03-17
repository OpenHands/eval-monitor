import { describe, it, expect } from 'vitest'
import { parseSearchParams, buildSearchString } from '../App'

describe('parseSearchParams', () => {
  const defaultDate = '2025-03-17'

  it('returns defaults when search string is empty', () => {
    const result = parseSearchParams('', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: null })
  })

  it('parses date from search params', () => {
    const result = parseSearchParams('?date=2025-01-15', defaultDate)
    expect(result).toEqual({ date: '2025-01-15', run: null })
  })

  it('parses run from search params', () => {
    const result = parseSearchParams('?run=swebench/model/123', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: 'swebench/model/123' })
  })

  it('parses both date and run from search params', () => {
    const result = parseSearchParams('?date=2025-02-20&run=gaia/litellm_proxy-gpt4/456', defaultDate)
    expect(result).toEqual({ date: '2025-02-20', run: 'gaia/litellm_proxy-gpt4/456' })
  })

  it('handles URL-encoded run slugs with slashes', () => {
    const result = parseSearchParams('?run=bench%2Fmodel%2Fjob', defaultDate)
    expect(result).toEqual({ date: '2025-03-17', run: 'bench/model/job' })
  })

  it('uses default date when date param is missing', () => {
    const result = parseSearchParams('?run=test/run/1', '2025-12-31')
    expect(result).toEqual({ date: '2025-12-31', run: 'test/run/1' })
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
})

describe('round-trip: buildSearchString -> parseSearchParams', () => {
  const today = '2025-03-17'

  it('round-trips a run selection with non-today date', () => {
    const date = '2025-01-10'
    const run = 'swebench/litellm_proxy-claude/789'
    const qs = buildSearchString(date, run, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date, run })
  })

  it('round-trips a run selection with today date', () => {
    const run = 'gaia/model/42'
    const qs = buildSearchString(today, run, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run })
  })

  it('round-trips list view with non-today date', () => {
    const date = '2025-06-15'
    const qs = buildSearchString(date, null, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date, run: null })
  })

  it('round-trips list view with today date', () => {
    const qs = buildSearchString(today, null, today)
    const parsed = parseSearchParams(qs, today)
    expect(parsed).toEqual({ date: today, run: null })
  })
})
