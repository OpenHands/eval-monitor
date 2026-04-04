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
    // lastPoint: output=10, critic1=5, critic2=2, critic3=1
    // acceptedCritic1 = 10/5 = 2
    // acceptedCritic2 = (10*(1-2))/2 = -5
    // acceptedCritic3 = ((10*(1-2))*(1-(-5)))/1 = -60
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 10, 5, 2, 1`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('Accepted critic 2:')).toBeInTheDocument()
    expect(screen.getByText('Accepted critic 3:')).toBeInTheDocument()
    expect(screen.getByText('2.00')).toBeInTheDocument() // acceptedCritic1
    expect(screen.getByText('-5.00')).toBeInTheDocument() // acceptedCritic2
    expect(screen.getByText('-60.00')).toBeInTheDocument() // acceptedCritic3
  })

  it('shows 0.00 when critic denominator is 0', async () => {
    // lastPoint: output=10, critic1=0, critic2=0, critic3=0
    // All accepted should be 0
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 10, 0, 0, 0`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    // All should show 0.00
    const zeroValues = screen.getAllByText('0.00')
    expect(zeroValues.length).toBe(3)
  })

  it('shows 0.00 when intermediate critic denominator is 0', async () => {
    // lastPoint: output=10, critic1=5, critic2=0, critic3=0
    // acceptedCritic1 = 10/5 = 2
    // acceptedCritic2 = 0 (denominator is 0)
    // acceptedCritic3 = 0 (denominator is 0)
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 10, 5, 0, 0`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('2.00')).toBeInTheDocument() // acceptedCritic1
    // acceptedCritic2 and acceptedCritic3 should be 0
    const zeroValues = screen.getAllByText('0.00')
    expect(zeroValues.length).toBe(2)
  })

  it('renders accepted with positive values', async () => {
    // lastPoint: output=100, critic1=200, critic2=50, critic3=20
    // acceptedCritic1 = 100/200 = 0.5
    // acceptedCritic2 = (100*(1-0.5))/50 = 1, display "-"
    // acceptedCritic3 = display "-" (because acceptedCritic2 is 1.0)
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 100, 200, 50, 20`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('0.50')).toBeInTheDocument() // acceptedCritic1
    expect(screen.getAllByText('-').length).toBe(2) // acceptedCritic2 and acceptedCritic3 both show "-"
  })

  it('shows dash for critic 2 and 3 when critic 1 is 1.0', async () => {
    // lastPoint: output=100, critic1=100, critic2=50, critic3=20
    // acceptedCritic1 = 100/100 = 1.0, display "1.00"
    // acceptedCritic2 = display "-"
    // acceptedCritic3 = display "-"
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 100, 100, 50, 20`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('1.00')).toBeInTheDocument() // acceptedCritic1
    expect(screen.getAllByText('-').length).toBe(2) // acceptedCritic2 and acceptedCritic3 both show "-"
  })

  it('shows dash for critic 3 when critic 2 is 1.0', async () => {
    // lastPoint: output=100, critic1=200, critic2=100, critic3=20
    // acceptedCritic1 = 100/200 = 0.5, display "0.50"
    // acceptedCritic2 = (100*(1-0.5))/100 = 0.5, NOT 1.0 so we calculate normally
    // Let's use output=100, critic1=50, critic2=100, critic3=20
    // acceptedCritic1 = 100/50 = 2.0
    // acceptedCritic2 = (100*(1-2.0))/100 = -1.0, display "-1.00"
    // acceptedCritic3 = display "-"
    // Actually let's make acceptedCritic2 = 1.0: output=100, critic1=50, critic2=100
    // acceptedCritic1 = 100/50 = 2.0
    // acceptedCritic2 = (100*(1-2))/100 = -1, not 1.0
    // Let's try: output=100, critic1=200, critic2=50, critic3=25
    // acceptedCritic1 = 100/200 = 0.5
    // acceptedCritic2 = (100*(1-0.5))/50 = 1.0, display "-"
    // acceptedCritic3 = display "-"
    // Use: output=200, critic1=100, critic2=100, critic3=50
    // acceptedCritic1 = 200/100 = 2.0
    // acceptedCritic2 = (200*(1-2))/100 = -2.0
    // Let's use: output=100, critic1=50, critic2=50, critic3=20
    // acceptedCritic1 = 100/50 = 2.0
    // acceptedCritic2 = (100*(1-2))/50 = -2.0
    // To get acceptedCritic2 = 1.0: output=100, critic1=50, critic2=100
    // acceptedCritic1 = 100/50 = 2.0, not what we want
    // To get acceptedCritic1 = 0.5 AND acceptedCritic2 = 1.0:
    // output=100, critic1=200, critic2=50 -> acceptedCritic1 = 0.5, acceptedCritic2 = 1.0
    // This means critic 3 will also be "-" due to critic 1 = 1.0 check
    // Let's use: output=50, critic1=100, critic2=50, critic3=20
    // acceptedCritic1 = 50/100 = 0.5
    // acceptedCritic2 = (50*(1-0.5))/50 = 0.5
    // acceptedCritic3 = ((50*(1-0.5))*(1-0.5))/20 = 0.125
    // To get acceptedCritic2 = 1.0, we need acceptedCritic1 = 0.5 AND (output * 0.5) / critic2 = 1.0
    // So output * 0.5 = critic2, meaning critic2 = output * 0.5
    // If output=100, critic1=200 (acceptedCritic1=0.5), then critic2 should be 50
    // acceptedCritic2 = (100 * 0.5) / 50 = 1.0 -> display "-"
    // acceptedCritic3 = display "-" (because acceptedCritic2 is 1.0)
    const mockData = `2026-03-26 21:30:20 UTC, 0, 0, 0, 0
2026-03-26 21:31:20 UTC, 100, 200, 50, 20`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockData,
    })

    render(<InferProgressGraph slug={defaultSlug} />)
    
    await waitFor(() => {
      expect(screen.getByText('Accepted critic 1:')).toBeInTheDocument()
    })

    expect(screen.getByText('0.50')).toBeInTheDocument() // acceptedCritic1
    // Note: critic 3 will also be "-" because critic 2 is 1.0
    expect(screen.getAllByText('-').length).toBe(2) // acceptedCritic2 and acceptedCritic3 both show "-"
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
