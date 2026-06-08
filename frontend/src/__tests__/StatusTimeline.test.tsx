import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render } from '@testing-library/react'
import StatusTimeline, { formatStageDuration, buildLaminarTracesUrl } from '../components/StatusTimeline'
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

describe('formatStageDuration', () => {
  it('returns dash when startStr is null', () => {
    expect(formatStageDuration(null, null, false, Date.now())).toBe('—')
  })

  it('returns dash when startStr is invalid', () => {
    expect(formatStageDuration('not-a-date', '2025-03-15T11:00:00Z', false, Date.now())).toBe('—')
  })

  it('returns dash when endStr is null and not active', () => {
    expect(formatStageDuration('2025-03-15T10:00:00Z', null, false, Date.now())).toBe('—')
  })

  it('returns duration between start and end for completed stage', () => {
    expect(formatStageDuration('2025-03-15T10:00:00Z', '2025-03-15T11:30:00Z', false, Date.now())).toBe('1h 30m')
  })

  it('returns duration between start and now for active stage', () => {
    const now = new Date('2025-03-15T10:45:00Z').getTime()
    expect(formatStageDuration('2025-03-15T10:00:00Z', null, true, now)).toBe('45m 0s')
  })

  it('returns seconds for short durations', () => {
    expect(formatStageDuration('2025-03-15T10:00:00Z', '2025-03-15T10:00:30Z', false, Date.now())).toBe('30s')
  })

  it('returns minutes and seconds for medium durations', () => {
    expect(formatStageDuration('2025-03-15T10:00:00Z', '2025-03-15T10:05:30Z', false, Date.now())).toBe('5m 30s')
  })

  it('returns dash for negative duration', () => {
    expect(formatStageDuration('2025-03-15T11:00:00Z', '2025-03-15T10:00:00Z', false, Date.now())).toBe('—')
  })
})

describe('StatusTimeline', () => {
  // Stub a project id so that the Laminar-button-related tests can rely on
  // a deterministic URL. Tests that explicitly need a missing project id
  // use the `buildLaminarTracesUrl` helper directly.
  beforeAll(() => {
    vi.stubEnv('VITE_LAMINAR_PROJECT_ID', 'test-project')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('shows duration instead of timestamp for completed stages', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      init: { timestamp: '2025-03-15T10:05:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:06:00Z' },
      runInferEnd: { timestamp: '2025-03-15T11:06:00Z' },
      evalInferStart: { timestamp: '2025-03-15T11:07:00Z' },
      evalInferEnd: { timestamp: '2025-03-15T12:07:00Z' },
    })
    const { container } = render(<StatusTimeline metadata={metadata} now={Date.now()} />)
    const text = container.textContent!
    // Should show durations
    expect(text).toContain('5m 0s')   // Building Images: 10:00 -> 10:05
    expect(text).toContain('1h 0m')   // Run Inference: 10:06 -> 11:06
    // Should NOT show timestamps
    expect(text).not.toContain('UTC')
    expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('shows live duration for active stage using now prop', () => {
    const now = new Date('2025-03-15T10:30:00Z').getTime()
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      init: { timestamp: '2025-03-15T10:05:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:06:00Z' },
    })
    const { container } = render(<StatusTimeline metadata={metadata} now={now} />)
    const text = container.textContent!
    // Building Images completed: 5m 0s
    expect(text).toContain('5m 0s')
    // Run Inference active: 10:06 -> 10:30 = 24m 0s
    expect(text).toContain('24m 0s')
    // No timestamps
    expect(text).not.toContain('UTC')
  })

  it('shows no duration for pending stages', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
    })
    const now = new Date('2025-03-15T10:30:00Z').getTime()
    const { container } = render(<StatusTimeline metadata={metadata} now={now} />)
    const pipelineSection = container.querySelector('.bg-oh-surface')!
    const durationElements = pipelineSection.querySelectorAll('p.text-\\[10px\\]')
    // Only "Building Images" is active, the other two are pending and should not show duration
    // Building Images stage is active (params exists, init doesn't)
    expect(durationElements.length).toBe(1)
    expect(durationElements[0].textContent).toContain('30m 0s')
  })

  it('shows dash when start timestamp is missing', () => {
    const metadata = makeMetadata({
      params: { no_timestamp: true },
      init: { timestamp: '2025-03-15T10:05:00Z' },
    })
    const { container } = render(<StatusTimeline metadata={metadata} now={Date.now()} />)
    // Building Images: params has no timestamp -> should show "—"
    const durationElements = container.querySelectorAll('p.text-\\[10px\\]')
    const texts = Array.from(durationElements).map(el => el.textContent)
    expect(texts).toContain('—')
  })

  it('never shows timestamps, only durations', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      init: { timestamp: '2025-03-15T10:05:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:06:00Z' },
      runInferEnd: { timestamp: '2025-03-15T11:06:00Z' },
    })
    const now = new Date('2025-03-15T12:00:00Z').getTime()
    const { container } = render(<StatusTimeline metadata={metadata} now={now} />)
    const text = container.textContent!
    expect(text).not.toContain('UTC')
    expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('renders a Laminar traces button under Run Inference once inference has started', () => {
    const metadata = makeMetadata({
      params: {
        timestamp: '2025-03-15T10:00:00Z',
        unique_eval_name: '26779733963-gemini-3-5',
      },
      init: { timestamp: '2025-03-15T10:05:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:06:00Z' },
    })
    const { queryByTestId } = render(
      <StatusTimeline metadata={metadata} now={Date.now()} />,
    )
    const button = queryByTestId('laminar-traces-button') as HTMLAnchorElement | null
    expect(button).not.toBeNull()
    expect(button!.href).toContain('https://laminar.sh/project/test-project/traces')
    expect(button!.href).toContain('search=26779733963-gemini-3-5')
    // Time-anchored from the beginning of inference
    expect(button!.href).toContain('startDate=')
    expect(decodeURIComponent(button!.href)).toContain('2025-03-15T10:06:00Z')
  })

  it('does not render Laminar button before inference starts', () => {
    const metadata = makeMetadata({
      params: {
        timestamp: '2025-03-15T10:00:00Z',
        unique_eval_name: '26779733963-gemini-3-5',
      },
      init: { timestamp: '2025-03-15T10:05:00Z' },
    })
    const { queryByTestId } = render(
      <StatusTimeline metadata={metadata} now={Date.now()} />,
    )
    expect(queryByTestId('laminar-traces-button')).toBeNull()
  })

  it('does not render Laminar button when unique_eval_name is missing', () => {
    const metadata = makeMetadata({
      params: { timestamp: '2025-03-15T10:00:00Z' },
      init: { timestamp: '2025-03-15T10:05:00Z' },
      runInferStart: { timestamp: '2025-03-15T10:06:00Z' },
    })
    const { queryByTestId } = render(
      <StatusTimeline metadata={metadata} now={Date.now()} />,
    )
    expect(queryByTestId('laminar-traces-button')).toBeNull()
  })
})

describe('buildLaminarTracesUrl', () => {
  it('returns null when no project ID is configured', () => {
    expect(buildLaminarTracesUrl('some-name', '2025-03-15T10:00:00Z', '')).toBeNull()
  })

  it('returns null when no unique_eval_name is provided', () => {
    expect(buildLaminarTracesUrl(null, '2025-03-15T10:00:00Z', 'proj-1')).toBeNull()
    expect(buildLaminarTracesUrl(undefined, '2025-03-15T10:00:00Z', 'proj-1')).toBeNull()
  })

  it('builds a URL filtered by unique_eval_name and infer start time', () => {
    const url = buildLaminarTracesUrl(
      '26779733963-gemini-3-5',
      '2025-03-15T10:06:00Z',
      'proj-1',
    )
    expect(url).not.toBeNull()
    expect(url).toContain('https://laminar.sh/project/proj-1/traces')
    expect(url).toContain('search=26779733963-gemini-3-5')
    expect(decodeURIComponent(url!)).toContain('startDate=2025-03-15T10:06:00Z')
  })

  it('omits startDate when no inferStartTimestamp is provided', () => {
    const url = buildLaminarTracesUrl('eval-1', null, 'proj-1')
    expect(url).not.toBeNull()
    expect(url).toContain('search=eval-1')
    expect(url).not.toContain('startDate')
  })
})
