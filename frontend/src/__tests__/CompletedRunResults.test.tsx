import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompletedRunResults from '../components/CompletedRunResults'
import { clearJsonCache } from '../api'

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
  clearJsonCache()
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
})
