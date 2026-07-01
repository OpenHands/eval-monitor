import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CompletedRunResults from '../components/CompletedRunResults'

const originalFetch = globalThis.fetch

// Anchors used by the cache-hit-rate "missing" warning logic
// (Date.UTC month is 0-indexed: 5 = June).
const CACHE_HIT_RATE_CUTOFF_MS = Date.UTC(2026, 5, 11)
const BEFORE_CUTOFF_MS = CACHE_HIT_RATE_CUTOFF_MS - 24 * 60 * 60 * 1000
const AFTER_CUTOFF_MS = CACHE_HIT_RATE_CUTOFF_MS + 24 * 60 * 60 * 1000

function mockFetchWithSummary(summary: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('output.report.json')) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as unknown as Response
    }

    if (url.includes('cost_report_v2.json')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ summary }),
      } as unknown as Response
    }

    if (url.includes('cost_report.jsonl')) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as unknown as Response
    }

    if (url.includes('efficiency_summary.json')) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as unknown as Response
    }

    throw new Error(`Unexpected fetch url: ${url}`)
  })

  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

interface FetchOptions {
  /** Efficiency summary response body, or undefined to 404 it. */
  efficiency?: Record<string, unknown> | null
  /** Shape of the v1 cost_report.jsonl summary; defaults to a summary
   *  without `cache_hit_rate` (the realistic OpenHands/benchmarks
   *  producer on main today). Set to `null` to 404 the file. */
  costReportSummary?: Record<string, unknown> | null
}

/** Build a fetch mock for the realistic post-#185 scenario: a v1
 *  `cost_report.jsonl` (no cache_hit_rate) plus an optional
 *  `efficiency_summary.json`. `cost_report_v2.json` is the missing
 *  third file — only emitted by the separate recalculate-costs job. */
function mockFetch(opts: FetchOptions = {}) {
  const { efficiency, costReportSummary } = opts
  const v1Summary = costReportSummary ?? {
    total_cost: 1.7044946,
    total_duration: 591.20869,
    only_main_output_cost: 1.7044946,
    sum_critic_files: 1.7044946,
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('output.report.json')) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as unknown as Response
    }

    if (url.includes('cost_report_v2.json')) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as unknown as Response
    }

    if (url.includes('cost_report.jsonl')) {
      if (costReportSummary === null) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => null },
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ summary: v1Summary }),
      } as unknown as Response
    }

    if (url.includes('efficiency_summary.json')) {
      if (efficiency === undefined || efficiency === null) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => null },
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => efficiency,
      } as unknown as Response
    }

    throw new Error(`Unexpected fetch url: ${url}`)
  })

  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function mockFetchWithCost(totalCost: number) {
  return mockFetchWithSummary({
    total_cost: totalCost,
    total_duration: 12.3,
    only_main_output_cost: totalCost,
    sum_critic_files: 0,
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('CompletedRunResults', () => {
  it('shows a warning when total cost is 0', async () => {
    mockFetchWithCost(0)

    render(<CompletedRunResults slug="swebench/model/123" />)

    const warning = await screen.findByTestId('zero-cost-warning')
    expect(warning.textContent).toContain('Cost is $0.0000')
  })

  it('does not show a warning when total cost is non-zero', async () => {
    mockFetchWithCost(1.2345)

    render(<CompletedRunResults slug="swebench/model/123" />)

    await screen.findByText('Cost Report')
    expect(screen.queryByTestId('zero-cost-warning')).toBeNull()
  })

  describe('Submit to index button', () => {
    const originalOpen = window.open

    beforeEach(() => {
      window.open = vi.fn()
    })

    afterEach(() => {
      window.open = originalOpen
      globalThis.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('renders the submit to index button', async () => {
      mockFetchWithCost(1.2345)

      render(<CompletedRunResults slug="swebench/model/123" />)

      await screen.findByText('Copy archive link and submit to index')
    })

    it('copies archive URL to clipboard and opens push-to-index workflow when clicked', async () => {
      mockFetchWithCost(1.2345)
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      render(<CompletedRunResults slug="swebench/model/123" />)

      const button = await screen.findByText('Copy archive link and submit to index')
      await act(async () => {
        fireEvent.click(button)
      })

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('results.tar.gz'))
      expect(window.open).toHaveBeenCalledWith(
        'https://github.com/OpenHands/evaluation/actions/workflows/push-to-index.yml',
        '_blank'
      )
    })

    it('renders both download and submit to index buttons', async () => {
      mockFetchWithCost(1.2345)

      render(<CompletedRunResults slug="swebench/model/123" />)

      await screen.findByText('Download results.tar.gz')
      await screen.findByText('Copy archive link and submit to index')
    })
  })

  describe('Trajectory Visualizer button', () => {
    it('renders the "See in Trajectory Visualizer" button', async () => {
      mockFetchWithCost(1.2345)

      render(<CompletedRunResults slug="swebench/model/123" />)

      await screen.findByText('See in Trajectory Visualizer')
    })

    it('links to the trajectory visualizer with the correct URL', async () => {
      mockFetchWithCost(1.2345)

      render(<CompletedRunResults slug="swebench/litellm_proxy-minimax-MiniMax-M2-7/24458507797" />)

      const link = await screen.findByText('See in Trajectory Visualizer')
      const anchor = link.closest('a')
      expect(anchor).not.toBeNull()
      expect(anchor?.href).toBe(
        'https://trajectory-visualizer.all-hands.dev/?inUrl=' +
        encodeURIComponent('https://results.eval.all-hands.dev/swebench/litellm_proxy-minimax-MiniMax-M2-7/24458507797/results.tar.gz')
      )
      expect(anchor?.target).toBe('_blank')
      expect(anchor?.rel).toContain('noopener')
    })
  })

  describe('cache_hit_rate', () => {
    function summaryWith(rate: number | null | undefined) {
      const base: Record<string, unknown> = {
        total_cost: 1.5,
        total_duration: 12.3,
        only_main_output_cost: 1.5,
        sum_critic_files: 0,
      }
      // `undefined` means "key absent", i.e. legacy producer.
      if (rate !== undefined) base.cache_hit_rate = rate
      return base
    }

    it('renders cache_hit_rate as a percentage', async () => {
      mockFetchWithSummary(summaryWith(0.7842))
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      await screen.findByText('cache_hit_rate')
      expect(screen.getByText('78.42%')).toBeTruthy()
    })

    it('shows a warning when cache_hit_rate is exactly 0', async () => {
      mockFetchWithSummary(summaryWith(0))
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      const warning = await screen.findByTestId('zero-cache-hit-warning')
      expect(warning.textContent).toContain('Cache hit rate is 0%')
    })

    it('does not warn about zero when cache_hit_rate is non-zero', async () => {
      mockFetchWithSummary(summaryWith(0.42))
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      await screen.findByText('Cost Report')
      expect(screen.queryByTestId('zero-cache-hit-warning')).toBeNull()
    })

    it('does not warn about zero when cache_hit_rate is null (no input to measure)', async () => {
      mockFetchWithSummary(summaryWith(null))
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      await screen.findByText('Cost Report')
      expect(screen.queryByTestId('zero-cache-hit-warning')).toBeNull()
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })

    it('shows a missing warning when the key is absent and the run is post-cutoff', async () => {
      mockFetchWithSummary(summaryWith(undefined))
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      const warning = await screen.findByTestId('missing-cache-hit-warning')
      expect(warning.textContent).toContain('Cache hit rate not reported')
    })

    it('does not show a missing warning for pre-cutoff (legacy) runs', async () => {
      mockFetchWithSummary(summaryWith(undefined))
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={BEFORE_CUTOFF_MS} />)
      await screen.findByText('Cost Report')
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })

    it('does not show a missing warning when the run completion time is unknown', async () => {
      // Old callers that don't pass runCompletedAtMs should keep working.
      mockFetchWithSummary(summaryWith(undefined))
      render(<CompletedRunResults slug="swebench/model/123" />)
      await screen.findByText('Cost Report')
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })
  })

  describe('efficiency_summary.json fallback', () => {
    function efficiencyWith(rate: number | null | undefined) {
      const tokens: Record<string, unknown> = {
        prompt_tokens: 5418997,
        completion_tokens: 22301,
        cache_read_tokens: 4067968,
      }
      if (rate !== undefined) tokens.cache_hit_rate = rate
      return {
        schema_version: 6,
        cost: { tokens },
      }
    }

    it('surfaces the rate from efficiency_summary when v1 lacks cache_hit_rate', async () => {
      // Realistic open-benchmarks-on-main scenario: v1 cost_report.jsonl
      // exists (no cache_hit_rate), efficiency_summary.json carries
      // cache_hit_rate = 0.7507, cost_report_v2.json absent.
      mockFetch({ efficiency: efficiencyWith(0.7506865200331353) })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)

      const banner = await screen.findByTestId('cache-hit-rate-from-efficiency')
      expect(banner.textContent).toContain('Cache hit rate is 75.07%')
      expect(banner.textContent).toContain('efficiency_summary.json')
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })

    it('suppresses the missing warning when efficiency ships the rate as a number', async () => {
      mockFetch({ efficiency: efficiencyWith(0.5) })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      await screen.findByTestId('cache-hit-rate-from-efficiency')
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })

    it('suppresses the missing warning when efficiency ships null (no input to measure)', async () => {
      // null in efficiency_summary.json means "we measured, but there
      // was no input to measure" — distinct from "key absent". Treat it
      // as a valid measurement signal: no info banner (nothing to show)
      // and no missing warning (we have a measurement).
      mockFetch({ efficiency: efficiencyWith(null) })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      await screen.findByText('Cost Report')
      expect(screen.queryByTestId('cache-hit-rate-from-efficiency')).toBeNull()
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })

    it('still warns when efficiency exists but lacks the rate (pre-schema-6 producer)', async () => {
      // efficiency_summary exists, schema_version 6, but no
      // `cost.tokens.cache_hit_rate` (e.g. a producer that hasn't been
      // upgraded past schema_version 5).
      mockFetch({
        efficiency: {
          schema_version: 6,
          cost: { tokens: { prompt_tokens: 1, completion_tokens: 1 } },
        },
      })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      const warning = await screen.findByTestId('missing-cache-hit-warning')
      expect(warning.textContent).toContain('Cache hit rate not reported')
    })

    it('still warns when both cost_report and efficiency_summary lack the rate', async () => {
      mockFetch({ efficiency: undefined })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      const warning = await screen.findByTestId('missing-cache-hit-warning')
      expect(warning.textContent).toContain('Cache hit rate not reported')
    })

    it('falls back gracefully when efficiency_summary.json is missing entirely', async () => {
      mockFetch({ efficiency: null })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      const warning = await screen.findByTestId('missing-cache-hit-warning')
      expect(warning.textContent).toContain('Cache hit rate not reported')
      // Body should match the original PR #185 copy when no efficiency file exists.
      expect(warning.textContent).toContain('cost_report_v2')
      expect(warning.textContent).not.toContain('Neither')
    })

    it('does not show the missing warning for pre-cutoff runs even without efficiency', async () => {
      mockFetch({ efficiency: null })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={BEFORE_CUTOFF_MS} />)
      await screen.findByText('Cost Report')
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
      expect(screen.queryByTestId('cache-hit-rate-from-efficiency')).toBeNull()
    })

    it('does not show the info banner when v2 already carries cache_hit_rate', async () => {
      // When v2 ships cache_hit_rate, the table itself shows it; the
      // info banner must NOT double up.
      const summaryWithRate = {
        total_cost: 1.7,
        total_duration: 591.2,
        only_main_output_cost: 1.7,
        sum_critic_files: 0,
        cache_hit_rate: 0.9,
      }
      mockFetch({ efficiency: efficiencyWith(0.5), costReportSummary: summaryWithRate })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      await screen.findByText('90.00%')
      expect(screen.queryByTestId('cache-hit-rate-from-efficiency')).toBeNull()
    })

    it('shows the zero-cache-hit warning when v2 ships 0 even if efficiency has 0 too', async () => {
      const summaryWithRate = {
        total_cost: 1.7,
        total_duration: 591.2,
        only_main_output_cost: 1.7,
        sum_critic_files: 0,
        cache_hit_rate: 0,
      }
      mockFetch({ efficiency: efficiencyWith(0), costReportSummary: summaryWithRate })
      render(<CompletedRunResults slug="swebench/model/123" runCompletedAtMs={AFTER_CUTOFF_MS} />)
      const warning = await screen.findByTestId('zero-cache-hit-warning')
      expect(warning.textContent).toContain('Cache hit rate is 0%')
      expect(screen.queryByTestId('cache-hit-rate-from-efficiency')).toBeNull()
      expect(screen.queryByTestId('missing-cache-hit-warning')).toBeNull()
    })
  })
})
