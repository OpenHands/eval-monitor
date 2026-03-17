import { describe, it, expect } from 'vitest'
import { getStageStatuses, getResultsUrl, filterScalarFields } from '../api'
import type { RunMetadata } from '../api'

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

describe('getStageStatuses', () => {
  it('returns all pending when no metadata files exist', () => {
    const result = getStageStatuses(makeMetadata())
    expect(result).toEqual({
      init: 'pending',
      runInferStart: 'pending',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks init as active when only init exists', () => {
    const result = getStageStatuses(makeMetadata({ init: { timestamp: '2024-01-01' } }))
    expect(result).toEqual({
      init: 'active',
      runInferStart: 'pending',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks init as completed and runInferStart as active when both exist', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'active',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks through runInferEnd as active', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      runInferEnd: { timestamp: '2024-01-01' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'completed',
      runInferEnd: 'active',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks all as completed when all stages exist', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      runInferEnd: { timestamp: '2024-01-01' },
      evalInferStart: { timestamp: '2024-01-01' },
      evalInferEnd: { timestamp: '2024-01-01' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'completed',
      runInferEnd: 'completed',
      evalInferStart: 'completed',
      evalInferEnd: 'completed',
    })
  })

  it('marks the last active stage as error when error exists', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      error: { message: 'something failed' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'error',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks error on evalInferStart when error exists during eval', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      runInferEnd: { timestamp: '2024-01-01' },
      evalInferStart: { timestamp: '2024-01-01' },
      error: { message: 'eval failed' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'completed',
      runInferEnd: 'completed',
      evalInferStart: 'error',
      evalInferEnd: 'pending',
    })
  })

  it('marks error on init when only init and error exist', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      error: { message: 'init failed' },
    }))
    expect(result).toEqual({
      init: 'error',
      runInferStart: 'pending',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })
})

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
