import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    cancelEval: null,
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

  it('shows trigger reason from metadata', () => {
    const metadata = makeMetadata({
      params: { trigger_reason: 'testing SDK: fix/issue-2375', triggered_by: 'user1', timestamp: '2025-03-15T10:00:00Z' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
    )
    const el = screen.getByTestId('trigger-reason')
    expect(el.textContent).toContain('testing SDK: fix/issue-2375')
  })

  it('shows dash for trigger reason when metadata has no reason info', () => {
    const metadata = makeMetadata({
      params: { llm_config: 'gpt-5' },
    })
    render(
      <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
    )
    const el = screen.getByTestId('trigger-reason')
    expect(el.textContent).toContain('—')
  })

  it('shows dash for trigger reason when metadata is null', () => {
    render(
      <RunDetailView slug={defaultSlug} metadata={null} loading={false} status="pending" />
    )
    const el = screen.getByTestId('trigger-reason')
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

  describe('Cancel Evaluation section', () => {
    it('shows cancel evaluation section when the run is not finished', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        runInferStart: { timestamp: '2025-03-15T10:01:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="running-infer" />
      )
      const section = screen.getByTestId('cancel-evaluation-section')
      expect(section).toBeTruthy()
      expect(section.textContent).toContain('Cancel Evaluation')
      expect(section.textContent).toContain('Copy Id and Open Cancel Action')
    })

    it('does not show cancel evaluation section when the run is completed', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        evalInferEnd: { timestamp: '2025-03-15T11:30:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="completed" />
      )
      expect(screen.queryByTestId('cancel-evaluation-section')).toBeNull()
    })

    it('does not show cancel evaluation section when the run has an error', () => {
      const metadata = makeMetadata({
        error: { message: 'Something went wrong' },
        params: { timestamp: '2025-03-15T10:00:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="error" />
      )
      expect(screen.queryByTestId('cancel-evaluation-section')).toBeNull()
    })

    it('does not show cancel evaluation section when metadata is null', () => {
      render(
        <RunDetailView slug={defaultSlug} metadata={null} loading={false} status="pending" />
      )
      expect(screen.queryByTestId('cancel-evaluation-section')).toBeNull()
    })

    it('copies job id to clipboard and opens kill workflow on button click', async () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        runInferStart: { timestamp: '2025-03-15T10:01:00Z' },
      })

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="running-infer" />
      )

      const button = screen.getByText('Copy Id and Open Cancel Action')
      await fireEvent.click(button)

      expect(writeText).toHaveBeenCalledWith('123')
      expect(openSpy).toHaveBeenCalledWith(
        'https://github.com/OpenHands/evaluation/actions/workflows/kill-eval-job.yml',
        '_blank'
      )

      openSpy.mockRestore()
    })

    it('shows cancel evaluation section for building status', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="building" />
      )
      expect(screen.getByTestId('cancel-evaluation-section')).toBeTruthy()
    })

    it('shows cancel evaluation section for pending status with params', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        init: { timestamp: '2025-03-15T10:01:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="pending" />
      )
      expect(screen.getByTestId('cancel-evaluation-section')).toBeTruthy()
    })
  })

  describe('Cancelled section', () => {
    it('shows cancelled section when cancelEval exists with timestamp and cancelled_by', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        runInferStart: { timestamp: '2025-03-15T10:05:00Z' },
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const section = screen.getByTestId('cancelled-section')
      expect(section).toBeTruthy()
      expect(section.textContent).toContain('Evaluation Cancelled')
    })

    it('shows cancelled by name in cancelled section', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const cancelledByEl = screen.getByTestId('cancelled-by')
      expect(cancelledByEl.textContent).toContain('alice')
    })

    it('shows dash for cancelled by when no known key in cancelEval', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const cancelledByEl = screen.getByTestId('cancelled-by')
      expect(cancelledByEl.textContent).toContain('—')
    })

    it('shows timestamp in cancelled section when timestamp is present', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'bob' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const timestampEl = screen.getByTestId('cancelled-timestamp')
      expect(timestampEl).toBeTruthy()
    })

    it('does not show cancelled section when cancelEval is null', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        evalInferEnd: { timestamp: '2025-03-15T11:30:00Z' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="completed" />
      )
      expect(screen.queryByTestId('cancelled-section')).toBeNull()
    })

    it('shows Cancelled badge for cancelled status', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      expect(screen.getByText('Cancelled')).toBeTruthy()
    })

    it('does not show cancel evaluation button for cancelled run', () => {
      const metadata = makeMetadata({
        params: { timestamp: '2025-03-15T10:00:00Z' },
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      expect(screen.queryByTestId('cancel-evaluation-section')).toBeNull()
    })

    it('shows kubernetes_jobs_found when present in cancelEval', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice', kubernetes_jobs_found: 3 },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const el = screen.getByTestId('kubernetes-jobs-found')
      expect(el.textContent).toContain('Kubernetes jobs found:')
      expect(el.textContent).toContain('3')
    })

    it('shows helm_releases_found when present in cancelEval', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice', helm_releases_found: 5 },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const el = screen.getByTestId('helm-releases-found')
      expect(el.textContent).toContain('Helm releases found:')
      expect(el.textContent).toContain('5')
    })

    it('does not show kubernetes_jobs_found when absent from cancelEval', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      expect(screen.queryByTestId('kubernetes-jobs-found')).toBeNull()
    })

    it('does not show helm_releases_found when absent from cancelEval', () => {
      const metadata = makeMetadata({
        cancelEval: { timestamp: '2025-03-15T10:45:00Z', cancelled_by: 'alice' },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      expect(screen.queryByTestId('helm-releases-found')).toBeNull()
    })

    it('shows both kubernetes_jobs_found and helm_releases_found when both present', () => {
      const metadata = makeMetadata({
        cancelEval: {
          timestamp: '2025-03-15T10:45:00Z',
          cancelled_by: 'alice',
          kubernetes_jobs_found: 2,
          helm_releases_found: 4,
        },
      })
      render(
        <RunDetailView slug={defaultSlug} metadata={metadata} loading={false} status="cancelled" />
      )
      const k8sEl = screen.getByTestId('kubernetes-jobs-found')
      expect(k8sEl.textContent).toContain('2')
      const helmEl = screen.getByTestId('helm-releases-found')
      expect(helmEl.textContent).toContain('4')
    })
  })
})
