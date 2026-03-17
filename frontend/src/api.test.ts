import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRunList, parseRunSlug, getStageStatus, type RunMetadata } from './api'

describe('fetchRunList', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns runs in reverse order (most recent first)', async () => {
    const mockResponse = new Response(
      'swebench/model-a/100\nswebench/model-b/101\nswebench/model-c/102\n',
      { status: 200 }
    )
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const result = await fetchRunList('2025-01-01')

    expect(result).toEqual([
      'swebench/model-c/102',
      'swebench/model-b/101',
      'swebench/model-a/100',
    ])
  })

  it('returns empty array on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 }))

    const result = await fetchRunList('2025-01-01')
    expect(result).toEqual([])
  })

  it('filters out blank lines and reverses', async () => {
    const mockResponse = new Response(
      'a/b/1\n\n  \nc/d/2\n',
      { status: 200 }
    )
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const result = await fetchRunList('2025-01-01')
    expect(result).toEqual(['c/d/2', 'a/b/1'])
  })
})

describe('parseRunSlug', () => {
  it('parses a standard slug into benchmark, model, and jobId', () => {
    const result = parseRunSlug('swebench/litellm_proxy-gpt4/42')
    expect(result).toEqual({
      benchmark: 'swebench',
      model: 'gpt4',
      jobId: '42',
    })
  })

  it('handles slugs with trailing slashes', () => {
    const result = parseRunSlug('swebench/litellm_proxy-gpt4/42/')
    expect(result).toEqual({
      benchmark: 'swebench',
      model: 'gpt4',
      jobId: '42',
    })
  })

  it('returns slug as benchmark when format is unexpected', () => {
    const result = parseRunSlug('onlyonething')
    expect(result).toEqual({ benchmark: 'onlyonething', model: '', jobId: '' })
  })
})

describe('getStageStatus', () => {
  const emptyMetadata: RunMetadata = {
    init: null,
    params: null,
    error: null,
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
  }

  it('returns error when error metadata exists', () => {
    expect(getStageStatus({ ...emptyMetadata, error: {} })).toBe('error')
  })

  it('returns completed when evalInferEnd exists', () => {
    expect(getStageStatus({ ...emptyMetadata, evalInferEnd: {} })).toBe('completed')
  })

  it('returns running-eval when evalInferStart exists', () => {
    expect(getStageStatus({ ...emptyMetadata, evalInferStart: {} })).toBe('running-eval')
  })

  it('returns running-infer when runInferStart exists', () => {
    expect(getStageStatus({ ...emptyMetadata, runInferStart: {} })).toBe('running-infer')
  })

  it('returns pending when only init exists', () => {
    expect(getStageStatus({ ...emptyMetadata, init: {} })).toBe('pending')
  })

  it('returns pending when nothing exists', () => {
    expect(getStageStatus(emptyMetadata)).toBe('pending')
  })
})
