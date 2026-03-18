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
})
