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
})
