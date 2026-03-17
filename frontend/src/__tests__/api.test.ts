import { describe, it, expect } from 'vitest'
import { getResultsUrl, filterScalarFields, extractTriggeredBy, getDateNDaysAgo, getDatesForRange } from '../api'
import type { RunMetadata } from '../api'

describe('getResultsUrl', () => {
  it('constructs the correct URL for a file', () => {
    const url = getResultsUrl('swebench/litellm_proxy-claude-sonnet/123', 'output.report.json')
    expect(url).toBe('https://results.eval.all-hands.dev/swebench/litellm_proxy-claude-sonnet/123/output.report.json')
  })

  it('strips trailing slash from slug', () => {
    const url = getResultsUrl('swebench/litellm_proxy-claude-sonnet/123/', 'cost_report.jsonl')
    expect(url).toBe('https://results.eval.all-hands.dev/swebench/litellm_proxy-claude-sonnet/123/cost_report.jsonl')
  })

  it('constructs correct URL for results archive', () => {
    const url = getResultsUrl('swebench/model/456', 'results.tar.gz')
    expect(url).toBe('https://results.eval.all-hands.dev/swebench/model/456/results.tar.gz')
  })
})

describe('filterScalarFields', () => {
  it('separates scalar and list fields', () => {
    const data = {
      total_instances: 500,
      submitted_instances: 1,
      completed_ids: ['id1', 'id2'],
      schema_version: 1,
      error_ids: [],
    }
    const result = filterScalarFields(data)
    expect(result.scalarFields).toEqual({
      total_instances: 500,
      submitted_instances: 1,
      schema_version: 1,
    })
    expect(result.hasListFields).toBe(true)
  })

  it('returns hasListFields false when no arrays exist', () => {
    const data = {
      total_instances: 500,
      schema_version: 1,
      name: 'test',
    }
    const result = filterScalarFields(data)
    expect(result.scalarFields).toEqual({
      total_instances: 500,
      schema_version: 1,
      name: 'test',
    })
    expect(result.hasListFields).toBe(false)
  })

  it('handles empty object', () => {
    const result = filterScalarFields({})
    expect(result.scalarFields).toEqual({})
    expect(result.hasListFields).toBe(false)
  })

  it('handles all list fields', () => {
    const data = {
      ids: [1, 2, 3],
      names: ['a', 'b'],
    }
    const result = filterScalarFields(data)
    expect(result.scalarFields).toEqual({})
    expect(result.hasListFields).toBe(true)
  })

  it('preserves various scalar types', () => {
    const data = {
      count: 42,
      name: 'test',
      active: true,
      ratio: 0.75,
      nothing: null,
      items: [1, 2],
    }
    const result = filterScalarFields(data)
    expect(result.scalarFields).toEqual({
      count: 42,
      name: 'test',
      active: true,
      ratio: 0.75,
      nothing: null,
    })
    expect(result.hasListFields).toBe(true)
  })
})

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

describe('extractTriggeredBy', () => {
  it('returns dash when metadata is undefined', () => {
    expect(extractTriggeredBy(undefined)).toBe('—')
  })

  it('returns dash when both init and params are null', () => {
    expect(extractTriggeredBy(makeMetadata())).toBe('—')
  })

  it('extracts triggered_by from params.json', () => {
    const metadata = makeMetadata({
      params: { triggered_by: 'juanmichelini', some_other: 'value' },
    })
    expect(extractTriggeredBy(metadata)).toBe('juanmichelini')
  })

  it('extracts triggered_by from init.json as fallback', () => {
    const metadata = makeMetadata({
      init: { triggered_by: 'alice' },
    })
    expect(extractTriggeredBy(metadata)).toBe('alice')
  })

  it('prefers params over init when both have triggered_by', () => {
    const metadata = makeMetadata({
      params: { triggered_by: 'from-params' },
      init: { triggered_by: 'from-init' },
    })
    expect(extractTriggeredBy(metadata)).toBe('from-params')
  })

  it('falls back to init when params has no trigger keys', () => {
    const metadata = makeMetadata({
      params: { llm_config: 'gpt-5' },
      init: { actor: 'bob' },
    })
    expect(extractTriggeredBy(metadata)).toBe('bob')
  })

  it('recognizes alternative trigger keys like actor and github_actor', () => {
    expect(extractTriggeredBy(makeMetadata({ params: { actor: 'ci-bot' } }))).toBe('ci-bot')
    expect(extractTriggeredBy(makeMetadata({ params: { github_actor: 'gh-user' } }))).toBe('gh-user')
    expect(extractTriggeredBy(makeMetadata({ init: { sender: 'webhook' } }))).toBe('webhook')
  })

  it('ignores non-string trigger values', () => {
    const metadata = makeMetadata({
      params: { triggered_by: 123 },
      init: { triggered_by: 'fallback' },
    })
    expect(extractTriggeredBy(metadata)).toBe('fallback')
  })

  it('returns dash when trigger keys exist but are empty strings', () => {
    const metadata = makeMetadata({
      params: { triggered_by: '' },
      init: { triggered_by: '' },
    })
    expect(extractTriggeredBy(metadata)).toBe('—')
  })
})

describe('getDateNDaysAgo', () => {
  it('returns the same date for n=0', () => {
    expect(getDateNDaysAgo('2025-03-17', 0)).toBe('2025-03-17')
  })

  it('returns yesterday for n=1', () => {
    expect(getDateNDaysAgo('2025-03-17', 1)).toBe('2025-03-16')
  })

  it('handles month boundary', () => {
    expect(getDateNDaysAgo('2025-03-01', 1)).toBe('2025-02-28')
  })

  it('handles year boundary', () => {
    expect(getDateNDaysAgo('2025-01-01', 1)).toBe('2024-12-31')
  })

  it('returns 7 days ago correctly', () => {
    expect(getDateNDaysAgo('2025-03-17', 7)).toBe('2025-03-10')
  })
})

describe('getDatesForRange', () => {
  it('returns single date for numDays=1', () => {
    expect(getDatesForRange('2025-03-17', 1)).toEqual(['2025-03-17'])
  })

  it('returns 3 dates in order (most recent first)', () => {
    expect(getDatesForRange('2025-03-17', 3)).toEqual([
      '2025-03-17',
      '2025-03-16',
      '2025-03-15',
    ])
  })

  it('returns 7 dates for a full week', () => {
    const dates = getDatesForRange('2025-03-17', 7)
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2025-03-17')
    expect(dates[6]).toBe('2025-03-11')
  })

  it('handles month boundary across range', () => {
    const dates = getDatesForRange('2025-03-02', 3)
    expect(dates).toEqual([
      '2025-03-02',
      '2025-03-01',
      '2025-02-28',
    ])
  })
})
