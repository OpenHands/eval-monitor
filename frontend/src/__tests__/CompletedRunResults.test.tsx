import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CompletedRunResults from '../components/CompletedRunResults'

const originalFetch = globalThis.fetch

function mockFetchWithCost(totalCost: number) {
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
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          summary: {
            total_cost: totalCost,
            total_duration: 12.3,
            only_main_output_cost: totalCost,
            sum_critic_files: 0,
          },
        }),
      } as unknown as Response
    }

    throw new Error(`Unexpected fetch url: ${url}`)
  })

  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
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
})
