import '@testing-library/jest-dom'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import InferProgressGraph from '../components/InferProgressGraph'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('InferProgressGraph', () => {
  const defaultSlug = 'swebench/litellm_proxy-claude-sonnet/123'

  it('renders nothing when file is not found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { container } = render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders nothing when data is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    })

    const { container } = render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders graph with valid data', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 0, 2, 0, 0
2026-03-26 21:32:20 UTC, 2, 3, 1, 0`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Inference Progress')).toBeInTheDocument()
    })

    expect(screen.getByText('📊')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
    expect(screen.getByText('Critic 1')).toBeInTheDocument()
    expect(screen.getByText('Critic 2')).toBeInTheDocument()
    expect(screen.getByText('Critic 3')).toBeInTheDocument()
  })

  it('renders speed statistics', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 0, 2, 0, 0
2026-03-26 21:32:20 UTC, 2, 3, 1, 0
2026-03-26 21:33:20 UTC, 3, 5, 2, 1`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Average Speed:')).toBeInTheDocument()
    })

    expect(screen.getByText('Current Speed:')).toBeInTheDocument()
    const speedTexts = screen.getAllByText(/instances\/min/)
    expect(speedTexts.length).toBe(2)
  })

  it('renders accepted for each critic', async () => {
    // Based on real data format:
    // Line 1: critic2=0, critic3=0 -> lastCritic1OnlyPoint
    // Line 2: critic3=0 -> lastCritic2DonePoint
    // Line 3: final point
    //
    // acceptedCritic1 = 430 / 432 = 0.9954 -> 99.54%
    // acceptedCritic2 = (431 - 430) / 4 = 0.25 -> 25.00%
    // acceptedCritic3 = (433 - 431) / 3 = 0.6667 -> 66.67%
    const mockData = `2026-04-04 05:38:41 UTC, 430, 432, 0, 0
2026-04-04 13:33:18 UTC, 431, 432, 4, 0
2026-04-04 15:25:40 UTC, 433, 432, 4, 3`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('99.54%')).toBeInTheDocument() // acceptedCritic1
    expect(screen.getByText('25.00%')).toBeInTheDocument() // acceptedCritic2
    expect(screen.getByText('66.67%')).toBeInTheDocument() // acceptedCritic3
  })

  it('handles case where only critic 1 ran', async () => {
    // Only critic 1 ran, so only acceptedCritic1 can be calculated
    // acceptedCritic1 = 430 / 432 = 0.9954 -> 99.54%
    // acceptedCritic2 and acceptedCritic3 should be 0.00%
    const mockData = `2026-04-04 05:38:41 UTC, 430, 432, 0, 0`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('99.54%')).toBeInTheDocument() // acceptedCritic1
    const zeroValues = screen.getAllByText('0.00%')
    expect(zeroValues.length).toBe(2) // acceptedCritic2 and acceptedCritic3
  })

  it('handles case where critic 1 and 2 ran but not 3', async () => {
    // acceptedCritic1 = 430 / 432 = 0.9954 -> 99.54%
    // acceptedCritic2 = (431 - 430) / 4 = 0.25 -> 25.00%
    // acceptedCritic3 = 0.00% (critic3 never ran)
    const mockData = `2026-04-04 05:38:41 UTC, 430, 432, 0, 0
2026-04-04 13:33:18 UTC, 431, 432, 4, 0`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('99.54%')).toBeInTheDocument() // acceptedCritic1
    expect(screen.getByText('25.00%')).toBeInTheDocument() // acceptedCritic2
    expect(screen.getByText('0.00%')).toBeInTheDocument() // acceptedCritic3
  })

  it('has section menu with download link', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 0, 2, 0, 0`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Inference Progress')).toBeInTheDocument()
    })

    const section = screen.getByText('Inference Progress').closest('#infer-progress')
    expect(section).toBeInTheDocument()
    expect(section?.className).toContain('scroll-mt-24')
  })

  it('renders chart with correct viewBox', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 5, 3, 2, 1
2026-03-26 21:31:20 UTC, 10, 6, 4, 2`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    const { container } = render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      const svgs = container.querySelectorAll('svg')
      const chartSvg = Array.from(svgs).find(svg => svg.getAttribute('viewBox') === '0 0 800 200')
      expect(chartSvg).toBeInTheDocument()
    })
  })

  it('handles fetch errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const { container } = render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('parses multi-line data correctly', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 5, 2, 1, 0
2026-03-26 21:32:20 UTC, 10, 8, 3, 1
2026-03-26 21:33:20 UTC, 15, 12, 6, 2`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    const { container } = render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Inference Progress')).toBeInTheDocument()
    })

    const svgs = container.querySelectorAll('svg')
    const chartSvg = Array.from(svgs).find(svg => svg.getAttribute('viewBox') === '0 0 800 200')
    expect(chartSvg).toBeInTheDocument()
    
    const paths = chartSvg?.querySelectorAll('path[stroke]')
    expect(paths?.length).toBeGreaterThanOrEqual(4)
  })

  it('includes cache bust parameter in fetch URL', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0`

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })
    globalThis.fetch = mockFetch

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const fetchUrl = mockFetch.mock.calls[0][0]
    expect(fetchUrl).toMatch(/\/api\/swebench\/litellm_proxy-claude-sonnet\/123\/metadata\/run-infer-progress\.txt\?\d+/)
    expect(fetchUrl).toContain('/metadata/run-infer-progress.txt?')
  })

  it('renders chart with correct colors for each line', async () => {
    const mockData = `2026-03-26 21:30:20 UTC, 5, 3, 2, 1
2026-03-26 21:31:20 UTC, 10, 6, 4, 2`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    const { container } = render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      const svgs = container.querySelectorAll('svg')
      const chartSvg = Array.from(svgs).find(svg => svg.getAttribute('viewBox') === '0 0 800 200')
      expect(chartSvg).toBeInTheDocument()

      const paths = chartSvg?.querySelectorAll('path[stroke]')
      expect(paths?.length).toBe(4)

      const colors = Array.from(paths!).map(p => p.getAttribute('stroke'))
      // output: cyan-green, critic1: green-yellow, critic2: orange, critic3: red
      expect(colors).toContain('#0ea5e9') // skyblue for output
      expect(colors).toContain('#a3e635') // green-yellow for critic1
      expect(colors).toContain('#fb923c') // yellowish orange for critic2
      expect(colors).toContain('#ef4444') // red for critic3
    })
  })
})
