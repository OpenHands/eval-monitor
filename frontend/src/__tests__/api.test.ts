import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getResultsUrl, filterScalarFields, extractTriggeredBy, extractTriggerReason, getDateNDaysAgo, getDatesForRange, fetchSubmissionData, fetchCostReport, getActiveWorkersForInstance, getPartialArchiveUrl, extractBenchmarkModelFromPartialArchiveUrl, isResumedRun, getOriginalRunSlug, buildOriginalRunUrl, fetchRunList, getClusterHealthState } from '../api'
import type { RunMetadata, ClusterHealthReport } from '../api'

function makeReport(overrides: Partial<ClusterHealthReport> = {}): ClusterHealthReport {
  return {
    timestamp: new Date().toISOString(),
    nodes: { total: 6, ready: 6, not_ready: 0, pressure: { memory: [], disk: [], pid: [] }, resources: [] },
    pods: { namespace: 'evaluation-jobs', total: 0, phases: {}, problems: [] },
    events: { failed_scheduling: [], warnings: [], warnings_summary: {} },
    pvcs: { unbound: [] },
    runtime_pods: { total: 0, running: 0 },
    summary: { healthy: true, issues: [], errors: [] },
    ...overrides,
  }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
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

describe('extractTriggerReason', () => {
  it('returns dash when metadata is undefined', () => {
    expect(extractTriggerReason(undefined)).toBe('—')
  })

  it('returns dash when both init and params are null', () => {
    expect(extractTriggerReason(makeMetadata())).toBe('—')
  })

  it('extracts trigger_reason from params.json', () => {
    const metadata = makeMetadata({
      params: { trigger_reason: 'testing SDK: fix/issue-2375', triggered_by: 'user1' },
    })
    expect(extractTriggerReason(metadata)).toBe('testing SDK: fix/issue-2375')
  })

  it('extracts trigger_reason from init.json as fallback', () => {
    const metadata = makeMetadata({
      init: { trigger_reason: 'scheduled run' },
    })
    expect(extractTriggerReason(metadata)).toBe('scheduled run')
  })

  it('prefers params over init when both have trigger_reason', () => {
    const metadata = makeMetadata({
      params: { trigger_reason: 'from-params' },
      init: { trigger_reason: 'from-init' },
    })
    expect(extractTriggerReason(metadata)).toBe('from-params')
  })

  it('falls back to init when params has no reason keys', () => {
    const metadata = makeMetadata({
      params: { llm_config: 'gpt-5' },
      init: { trigger_reason: 'nightly' },
    })
    expect(extractTriggerReason(metadata)).toBe('nightly')
  })

  it('recognizes alternative reason keys like event_name and event_type', () => {
    expect(extractTriggerReason(makeMetadata({ params: { event_name: 'workflow_dispatch' } }))).toBe('workflow_dispatch')
    expect(extractTriggerReason(makeMetadata({ init: { event_type: 'push' } }))).toBe('push')
  })

  it('ignores non-string reason values', () => {
    const metadata = makeMetadata({
      params: { trigger_reason: 123 },
      init: { trigger_reason: 'fallback-reason' },
    })
    expect(extractTriggerReason(metadata)).toBe('fallback-reason')
  })

  it('returns dash when trigger_reason is null', () => {
    const metadata = makeMetadata({
      params: { trigger_reason: null },
    })
    expect(extractTriggerReason(metadata)).toBe('—')
  })

  it('returns dash when reason keys exist but are empty strings', () => {
    const metadata = makeMetadata({
      params: { trigger_reason: '' },
      init: { trigger_reason: '' },
    })
    expect(extractTriggerReason(metadata)).toBe('—')
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

describe('fetchSubmissionData', () => {
  it('returns submission data when file exists with valid url and timestamp', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        timestamp: '2026-03-23T21:29:48Z',
        url: 'https://github.com/OpenHands/openhands-index-results/pull/719',
      }),
    })) as unknown as typeof fetch

    const result = await fetchSubmissionData('swebench/model/123')
    expect(result).toEqual({
      timestamp: '2026-03-23T21:29:48Z',
      url: 'https://github.com/OpenHands/openhands-index-results/pull/719',
    })
  })

  it('returns null when submission.json does not exist (404)', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
    })) as unknown as typeof fetch

    const result = await fetchSubmissionData('swebench/model/123')
    expect(result).toBeNull()
  })

  it('returns null when response has no url field', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ timestamp: '2026-03-23T21:29:48Z' }),
    })) as unknown as typeof fetch

    const result = await fetchSubmissionData('swebench/model/123')
    expect(result).toBeNull()
  })

  it('returns null when response has non-string url field', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ url: 42 }),
    })) as unknown as typeof fetch

    const result = await fetchSubmissionData('swebench/model/123')
    expect(result).toBeNull()
  })

  it('strips trailing slash from slug when building fetch URL', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
    })) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    await fetchSubmissionData('swebench/model/123/')
    const calledUrl = String((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(calledUrl).not.toMatch(/\/\//  )
    expect(calledUrl).toContain('swebench/model/123/metadata/submission.json')
  })

  it('uses empty string for timestamp when not a string in the response', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ url: 'https://github.com/OpenHands/results/pull/1', timestamp: null }),
    })) as unknown as typeof fetch

    const result = await fetchSubmissionData('swebench/model/123')
    expect(result).toEqual({
      timestamp: '',
      url: 'https://github.com/OpenHands/results/pull/1',
    })
  })
})

describe('fetchCostReport', () => {
  const costSummary = {
    total_cost: 1.5,
    total_duration: 30.0,
    only_main_output_cost: 1.2,
    sum_critic_files: 0.3,
  }

  function makeFetchMock({ v2Exists, v1Exists }: { v2Exists: boolean; v1Exists: boolean }) {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('cost_report_v2.json')) {
        if (!v2Exists) return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ summary: costSummary }),
        } as unknown as Response
      }
      if (url.includes('cost_report.jsonl')) {
        if (!v1Exists) return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ summary: costSummary }),
        } as unknown as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    }) as unknown as typeof fetch
  }

  it('uses cost_report_v2.json when it exists', async () => {
    globalThis.fetch = makeFetchMock({ v2Exists: true, v1Exists: true })
    const result = await fetchCostReport('swebench/model/123')
    expect(result).not.toBeNull()
    expect(result!.fullUrl).toContain('cost_report_v2.json')
    expect(result!.summary).toEqual(costSummary)
  })

  it('falls back to cost_report.jsonl when v2 does not exist', async () => {
    globalThis.fetch = makeFetchMock({ v2Exists: false, v1Exists: true })
    const result = await fetchCostReport('swebench/model/123')
    expect(result).not.toBeNull()
    expect(result!.fullUrl).toContain('cost_report.jsonl')
    expect(result!.summary).toEqual(costSummary)
  })

  it('returns null when neither v2 nor v1 exists', async () => {
    globalThis.fetch = makeFetchMock({ v2Exists: false, v1Exists: false })
    const result = await fetchCostReport('swebench/model/123')
    expect(result).toBeNull()
  })

  it('does not fetch cost_report.jsonl when v2 exists', async () => {
    const fetchMock = makeFetchMock({ v2Exists: true, v1Exists: true })
    globalThis.fetch = fetchMock
    await fetchCostReport('swebench/model/123')
    const calledUrls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.map((call: unknown[]) => String(call[0]))
    expect(calledUrls.some(u => u.includes('cost_report_v2.json'))).toBe(true)
    expect(calledUrls.some(u => u.includes('cost_report.jsonl'))).toBe(false)
  })

  it('strips trailing slash from slug when building fetch URL', async () => {
    const fetchMock = makeFetchMock({ v2Exists: false, v1Exists: false })
    globalThis.fetch = fetchMock
    await fetchCostReport('swebench/model/123/')
    const calledUrls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.map((call: unknown[]) => String(call[0]))
    expect(calledUrls.every(u => !u.includes('//'))).toBe(true)
  })
})

describe('getActiveWorkersForInstance', () => {
  it('returns num_infer_workers when set', () => {
    const metadata = makeMetadata({
      params: { num_infer_workers: 50 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(50)
  })

  it('returns num_infer_workers when eval_limit is also set', () => {
    const metadata = makeMetadata({
      params: { num_infer_workers: 30, eval_limit: 100 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(30)
  })

  it('returns min(eval_limit, 20) when num_infer_workers not set', () => {
    const metadata = makeMetadata({
      params: { eval_limit: 100 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(20)
  })

  it('returns eval_limit when eval_limit <= 20', () => {
    const metadata = makeMetadata({
      params: { eval_limit: 15 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(15)
  })

  it('returns 20 when eval_limit is exactly 20', () => {
    const metadata = makeMetadata({
      params: { eval_limit: 20 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(20)
  })

  it('returns 20 when neither num_infer_workers nor eval_limit is set', () => {
    const metadata = makeMetadata()
    expect(getActiveWorkersForInstance(metadata)).toBe(20)
  })

  it('returns 20 when params is null', () => {
    const metadata = makeMetadata({ params: null })
    expect(getActiveWorkersForInstance(metadata)).toBe(20)
  })

  it('returns 20 when params is empty object', () => {
    const metadata = makeMetadata({ params: {} })
    expect(getActiveWorkersForInstance(metadata)).toBe(20)
  })

  it('ignores non-numeric num_infer_workers and uses eval_limit', () => {
    const metadata = makeMetadata({
      params: { num_infer_workers: 'string' as unknown as number, eval_limit: 10 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(10)
  })

  it('ignores null num_infer_workers and uses eval_limit', () => {
    const metadata = makeMetadata({
      params: { num_infer_workers: null, eval_limit: 5 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(5)
  })

  it('ignores null eval_limit and uses num_infer_workers', () => {
    const metadata = makeMetadata({
      params: { num_infer_workers: 30, eval_limit: null },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(30)
  })

  it('returns min when both are set and eval_limit > 20', () => {
    const metadata = makeMetadata({
      params: { num_infer_workers: 10, eval_limit: 50 },
    })
    expect(getActiveWorkersForInstance(metadata)).toBe(10)
  })
})

describe('getPartialArchiveUrl', () => {
  it('returns null when metadata is null', () => {
    expect(getPartialArchiveUrl(null)).toBeNull()
  })

  it('returns null when params is null', () => {
    expect(getPartialArchiveUrl(makeMetadata({ params: null }))).toBeNull()
  })

  it('returns null when partial_archive_url is not present', () => {
    expect(getPartialArchiveUrl(makeMetadata({ params: { model_id: 'test' } }))).toBeNull()
  })

  it('returns null when partial_archive_url is null', () => {
    expect(getPartialArchiveUrl(makeMetadata({ params: { partial_archive_url: null } }))).toBeNull()
  })

  it('returns null when partial_archive_url is empty string', () => {
    expect(getPartialArchiveUrl(makeMetadata({ params: { partial_archive_url: '' } }))).toBeNull()
  })

  it('returns the partial_archive_url path when it is a full URL', () => {
    const fullUrl = 'https://results.eval.all-hands.dev/swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz'
    expect(getPartialArchiveUrl(makeMetadata({ params: { partial_archive_url: fullUrl } }))).toBe('swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz')
  })

  it('returns the partial_archive_url when it is just a path', () => {
    const path = 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz'
    expect(getPartialArchiveUrl(makeMetadata({ params: { partial_archive_url: path } }))).toBe(path)
  })
})

describe('extractBenchmarkModelFromPartialArchiveUrl', () => {
  it('returns null for null input', () => {
    expect(extractBenchmarkModelFromPartialArchiveUrl(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractBenchmarkModelFromPartialArchiveUrl(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractBenchmarkModelFromPartialArchiveUrl('')).toBeNull()
  })

  it('extracts benchmark/model from valid partial_archive_url', () => {
    const url = 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz'
    expect(extractBenchmarkModelFromPartialArchiveUrl(url)).toBe('swtbench/litellm_proxy-minimax-MiniMax-M2-7')
  })

  it('returns null for invalid URL format', () => {
    expect(extractBenchmarkModelFromPartialArchiveUrl('invalid-url')).toBeNull()
  })

  it('handles URLs without results.tar.gz suffix', () => {
    const url = 'swtbench/model/12345/some-other-file.tar.gz'
    expect(extractBenchmarkModelFromPartialArchiveUrl(url)).toBe('swtbench/model')
  })
})

describe('isResumedRun', () => {
  it('returns false when metadata is null', () => {
    expect(isResumedRun(null)).toBe(false)
  })

  it('returns false when params is null', () => {
    expect(isResumedRun(makeMetadata({ params: null }))).toBe(false)
  })

  it('returns false when partial_archive_url is not present', () => {
    expect(isResumedRun(makeMetadata({ params: { model_id: 'test' } }))).toBe(false)
  })

  it('returns true when partial_archive_url is present', () => {
    expect(isResumedRun(makeMetadata({ params: { partial_archive_url: 'some/url/results.tar.gz' } }))).toBe(true)
  })
})

describe('getOriginalRunSlug', () => {
  it('returns null when metadata is null', () => {
    expect(getOriginalRunSlug(null, 'swtbench/model/123')).toBeNull()
  })

  it('returns null when params is null', () => {
    expect(getOriginalRunSlug(makeMetadata({ params: null }), 'swtbench/model/123')).toBeNull()
  })

  it('returns original_run_id when present', () => {
    const metadata = makeMetadata({
      params: {
        original_run_id: 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/23324404309',
        partial_archive_url: 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz',
      },
    })
    expect(getOriginalRunSlug(metadata, 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569')).toBe('swtbench/litellm_proxy-minimax-MiniMax-M2-7/23324404309')
  })

  it('uses original_timestamp when original_run_id is not present', () => {
    const metadata = makeMetadata({
      params: {
        original_timestamp: '23324404309',
        partial_archive_url: 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz',
      },
    })
    expect(getOriginalRunSlug(metadata, 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569')).toBe('swtbench/litellm_proxy-minimax-MiniMax-M2-7/23324404309')
  })

  it('uses github_run_id when it looks like a timestamp', () => {
    const metadata = makeMetadata({
      params: {
        github_run_id: '23324404309',
        partial_archive_url: 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz',
      },
    })
    expect(getOriginalRunSlug(metadata, 'swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569')).toBe('swtbench/litellm_proxy-minimax-MiniMax-M2-7/23324404309')
  })

  it('returns original_run_id when partial_archive_url is not present', () => {
    const metadata = makeMetadata({
      params: {
        original_run_id: 'swtbench/model/123',
      },
    })
    // original_run_id is the most reliable source, so we return it directly
    expect(getOriginalRunSlug(metadata, 'swtbench/model/456')).toBe('swtbench/model/123')
  })
})

describe('buildOriginalRunUrl', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'https:',
        host: 'example.com',
        pathname: '/',
      },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  it('builds URL with run and text params', () => {
    const result = buildOriginalRunUrl('https://example.com/?run=test/123', 'swtbench/model/456')
    expect(result).toContain('run=swtbench%2Fmodel%2F456')
    expect(result).toContain('text=456')
  })

  it('uses current host and path', () => {
    const result = buildOriginalRunUrl('https://example.com/', 'swtbench/model/456')
    expect(result).toMatch(/^https:\/\/example\.com\//)
  })

  it('sets text filter to timestamp', () => {
    const result = buildOriginalRunUrl('https://example.com/', 'swtbench/model/789')
    expect(result).toContain('text=789')
  })
})

describe('fetchRunList', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        headers: new Headers(),
      } as Response)
    )
  })

  it('returns empty array on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([])
  })

  it('throws on other errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    )
    await expect(fetchRunList('2024-01-01')).rejects.toThrow('Failed to fetch run list: 500')
  })

  it('parses JSONL lines correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`{"path": "swebench/model1/123", "status": "completed", "triggered_by": "user1", "trigger_reason": "PR #123"}
{"path": "swebench/model2/456", "status": "error", "triggered_by": "user2", "trigger_reason": "scheduled"}
{"path": "swebench/model3/789", "status": "running-infer"}
`),
        headers: new Headers(),
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([
      { slug: 'swebench/model3/789', status: 'running-infer' },
      { slug: 'swebench/model2/456', status: 'error', triggeredBy: 'user2', triggerReason: 'scheduled' },
      { slug: 'swebench/model1/123', status: 'completed', triggeredBy: 'user1', triggerReason: 'PR #123' },
    ])
  })

  it('maps unknown status to undefined', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`{"path": "swebench/model/123", "status": "init"}
`),
        headers: new Headers(),
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([
      { slug: 'swebench/model/123' },
    ])
  })

  it('maps "cancel" status to "cancelled"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`{"path": "swebench/model/123", "status": "cancel"}
`),
        headers: new Headers(),
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([
      { slug: 'swebench/model/123', status: 'cancelled' },
    ])
  })

  it('handles items with and without status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`{"path": "swebench/model1/123", "status": "completed"}
{"path": "swebench/model2/456"}
{"path": "swebench/model3/789", "status": "running-infer"}
`),
        headers: new Headers(),
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([
      { slug: 'swebench/model3/789', status: 'running-infer' },
      { slug: 'swebench/model2/456' },
      { slug: 'swebench/model1/123', status: 'completed' },
    ])
  })

  it('filters out empty lines and invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`{"path": "swebench/model1/123"}

{"path": "swebench/model2/456", "status": "completed"}

invalid json here

`),
        headers: new Headers(),
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([
      { slug: 'swebench/model2/456', status: 'completed' },
      { slug: 'swebench/model1/123' },
    ])
  })

  it('filters out items with empty path', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`{"path": "", "status": "completed"}
{"path": "swebench/model2/456", "status": "error"}
`),
        headers: new Headers(),
      } as Response)
    )
    const result = await fetchRunList('2024-01-01')
    expect(result).toEqual([
      { slug: 'swebench/model2/456', status: 'error' },
    ])
  })
})

describe('getClusterHealthState', () => {
  const FRESH_NOW = new Date('2026-04-09T07:20:00Z').getTime()
  const FRESH_TIMESTAMP = '2026-04-09T07:18:00Z' // 2 min old, fresh

  it('returns healthy when nothing is wrong', () => {
    const report = makeReport({ timestamp: FRESH_TIMESTAMP })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('healthy')
  })

  it('returns stale when the report is older than the threshold', () => {
    const report = makeReport({ timestamp: '2026-04-09T07:00:00Z' }) // 20 min old
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('stale')
  })

  it('returns critical when a node is not ready', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      nodes: { total: 6, ready: 5, not_ready: 1, pressure: { memory: [], disk: [], pid: [] }, resources: [] },
      summary: { healthy: false, issues: ['1 node(s) not ready'], errors: [] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('critical')
  })

  it('returns critical on node memory pressure', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      nodes: { total: 6, ready: 6, not_ready: 0, pressure: { memory: ['node-a'], disk: [], pid: [] }, resources: [] },
      summary: { healthy: false, issues: ['memory pressure on node-a'], errors: [] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('critical')
  })

  it('returns critical on FailedScheduling events', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      events: { failed_scheduling: [{ name: 'pod-a', reason: 'FailedScheduling', message: '0/6 nodes' }], warnings: [], warnings_summary: {} },
      summary: { healthy: false, issues: ['FailedScheduling for pod-a'], errors: [] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('critical')
  })

  it('returns critical on OOMKilled / CrashLoopBackOff / Error / Evicted pods', () => {
    for (const state of ['OOMKilled', 'CrashLoopBackOff', 'Error', 'Evicted', 'ImagePullBackOff']) {
      const report = makeReport({
        timestamp: FRESH_TIMESTAMP,
        pods: { namespace: 'evaluation-jobs', total: 1, phases: {}, problems: [{ name: 'p', state }] },
        summary: { healthy: false, issues: [`p in ${state}`], errors: [] },
      })
      expect(getClusterHealthState(report, FRESH_NOW)).toBe('critical')
    }
  })

  it('returns warning on unbound PVCs only', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      pvcs: { unbound: [{ name: 'pvc-a', phase: 'Pending' }] },
      summary: { healthy: false, issues: ['PVC pvc-a is Pending'], errors: [] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('warning')
  })

  it('returns warning on stuck Pending / Terminating / Unknown pods', () => {
    for (const state of ['Pending', 'Terminating', 'Unknown', 'HighRestartCount']) {
      const report = makeReport({
        timestamp: FRESH_TIMESTAMP,
        pods: { namespace: 'evaluation-jobs', total: 1, phases: {}, problems: [{ name: 'p', state }] },
        summary: { healthy: false, issues: [`p stuck ${state}`], errors: [] },
      })
      expect(getClusterHealthState(report, FRESH_NOW)).toBe('warning')
    }
  })

  it('returns warning when collector errors are present (data degraded)', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      summary: { healthy: false, issues: ['Health collection degraded: 1 API error(s)'], errors: ['nodes collection failed'] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('warning')
  })

  it('critical takes precedence over warning when both are present', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      pods: {
        namespace: 'evaluation-jobs',
        total: 2,
        phases: {},
        problems: [
          { name: 'p1', state: 'Pending' },     // warning
          { name: 'p2', state: 'OOMKilled' },   // critical
        ],
      },
      pvcs: { unbound: [{ name: 'pvc-a', phase: 'Pending' }] },
      summary: { healthy: false, issues: ['p2 in OOMKilled'], errors: [] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('critical')
  })

  it('returns warning when summary.healthy is false but no known cause was matched', () => {
    const report = makeReport({
      timestamp: FRESH_TIMESTAMP,
      summary: { healthy: false, issues: ['something we did not classify'], errors: [] },
    })
    expect(getClusterHealthState(report, FRESH_NOW)).toBe('warning')
  })
})

