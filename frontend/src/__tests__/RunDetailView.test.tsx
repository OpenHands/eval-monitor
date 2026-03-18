import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunDetailView from '../components/RunDetailView'
import type { RunMetadata } from '../api'

function makeMetadata(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    init: null,
    params: null,
    error: null,
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
    ...overrides,
  }
}

describe('RunDetailView', () => {
  const defaultSlug = 'swebench/litellm_proxy-claude-sonnet/123'

  it('shows triggered by from metadata', () => {
    const metadata = makeMetadata({
      params: { triggered_by: 'juanmichelini', timestamp: '2025-03-15T10:00:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
    )
    const el = screen.getByTestId('triggered-by')
    expect(el.textContent).toContain('juanmichelini')
  })

  it('shows dash for triggered by when metadata has no trigger info', () => {
    const metadata = makeMetadata({
      params: { llm_config: 'gpt-5' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
    )
    const el = screen.getByTestId('triggered-by')
    expect(el.textContent).toContain('—')
  })

  it('shows runtime for a completed run', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      evalInferEnd: { timestamp: '2025-03-15T11:30:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="completed" />
    )
    const el = screen.getByTestId('runtime')
    expect(el.textContent).toContain('1h 30m')
  })

  it('shows dash for runtime when no timestamps are available', () => {
    const metadata = makeMetadata()
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
    )
    const el = screen.getByTestId('runtime')
    expect(el.textContent).toContain('—')
  })

  it('shows dash for triggered by and runtime when metadata is null', () => {
    render(
      <RunDetailView slug={defaultSlug} metadata={null} loading={false} status="pending" />
    )
    const triggeredByEl = screen.getByTestId('triggered-by')
    expect(triggeredByEl.textContent).toContain('—')
    const runtimeEl = screen.getByTestId('runtime')
    expect(runtimeEl.textContent).toContain('—')
  })

  it('shows timer icon for running (non-finished) run with runtime', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:01:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="running-infer" />
    )
    const el = screen.getByTestId('runtime')
    expect(el.textContent).toContain('⏱')
  })

  it('does not show timer icon for completed runs', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      evalInferEnd: { timestamp: '2025-03-15T10:45:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="completed" />
    )
    const el = screen.getByTestId('runtime')
    expect(el.textContent).not.toContain('⏱')
  })

  it('renders error section before pipeline progress and after run header', () => {
    const metadata = makeMetadata({
      error: { message: 'Something went wrong', code: 'FAIL' },
      params: { timestamp: '2025-03-15T10:00:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:01:00Z' },
    })
    const { container } = render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="error" />
    )

    // Error section should be present
    const errorSection = screen.getByTestId('error-section')
    expect(errorSection).toBeTruthy()
    expect(errorSection.textContent).toContain('Something went wrong')

    // Verify ordering: error section appears before the StatusTimeline
    // and after the run header in the DOM
    const topLevelChildren = container.querySelector('.space-y-6')!.children
    const childArray = Array.from(topLevelChildren)

    // Find indices of key sections
    const headerIdx = childArray.findIndex(el =>
      el.querySelector('h2')?.textContent?.includes('claude-sonnet')
    )
    const errorIdx = childArray.findIndex(el =>
      el.getAttribute('data-testid') === 'error-section'
    )
    const timelineIdx = childArray.findIndex(el =>
      el.textContent?.includes('Pipeline Progress')
    )

    expect(headerIdx).toBeGreaterThanOrEqual(0)
    expect(errorIdx).toBeGreaterThanOrEqual(0)
    expect(timelineIdx).toBeGreaterThanOrEqual(0)

    // Error should come after header and before timeline
    expect(errorIdx).toBeGreaterThan(headerIdx)
    expect(errorIdx).toBeLessThan(timelineIdx)
  })

  it('does not render error section when there is no error', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
    )
    expect(screen.queryByTestId('error-section')).toBeNull()
  })

  it('shows Building Images stage in Pipeline Progress instead of Init', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      init: { timestamp: '2025-03-15T10:05:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:06:00Z' },
    })
    const { container } = render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="running-infer" />
    )
    // Find the Pipeline Progress section specifically
    const pipelineHeading = Array.from(container.querySelectorAll('h3')).find(
      el => el.textContent === 'Pipeline Progress'
    )
    expect(pipelineHeading).toBeTruthy()
    const pipelineSection = pipelineHeading!.parentElement!
    // Stage labels use specific classes; select only the label elements
    const stageLabels = Array.from(pipelineSection.querySelectorAll('p.text-xs.font-medium'))
      .map(p => p.textContent)
    expect(stageLabels).toContain('Building Images')
    expect(stageLabels).not.toContain('Init')
  })

  it('shows Building Images badge for building status', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="building" />
    )
    const badges = screen.getAllByText('Building Images')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })
})
