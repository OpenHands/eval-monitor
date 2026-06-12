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
})
