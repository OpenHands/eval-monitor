import { describe, it, expect } from 'vitest'
import { getResultsUrl, filterScalarFields } from '../api'

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
