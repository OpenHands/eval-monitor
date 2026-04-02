import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import JsonCard from '../components/JsonCard'

describe('JsonCard repo links', () => {
  it('links sdk_commit to the software-agent-sdk commit page', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ sdk_commit: 'abc1234def5678' }}
      />
    )

    const link = screen.getByRole('link', { name: 'abc1234def5678' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/software-agent-sdk/commit/abc1234def5678')
  })

  it('links sdk_workflow_run_id to the software-agent-sdk actions run page', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ sdk_workflow_run_id: '23663720332' }}
      />
    )

    const link = screen.getByRole('link', { name: '23663720332' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/software-agent-sdk/actions/runs/23663720332')
  })

  it('does not link sdk_workflow_run_id if value is not numeric', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ sdk_workflow_run_id: 'not-a-number' }}
      />
    )

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('links evaluation_branch to the evaluation repo tree and strips refs/heads/', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ evaluation_branch: 'refs/heads/feature/test-branch' }}
      />
    )

    const link = screen.getByRole('link', { name: 'feature/test-branch' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/evaluation/tree/feature/test-branch')
  })

  it('links benchmarks_branch to the benchmarks repo tree and strips refs/heads/', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ benchmarks_branch: 'refs/heads/my-bench-branch' }}
      />
    )

    const link = screen.getByRole('link', { name: 'my-bench-branch' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/benchmarks/tree/my-bench-branch')
  })

  it('links build_action to the benchmarks actions page with a query filter', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ build_action: 'dispatch-23910750652-claude-4-6' }}
      />
    )

    const link = screen.getByRole('link', { name: 'dispatch-23910750652-claude-4-6' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/benchmarks/actions?query=branch%3Adispatch-23910750652-claude-4-6')
  })

  it('does not link build_action values that do not start with dispatch-', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ build_action: 'other-value' }}
      />
    )

    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('JsonCard URL detection', () => {
  it('links trigger_reason when value is a full https URL', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ trigger_reason: 'https://github.com/OpenHands/foo/pull/42' }}
      />
    )

    const link = screen.getByRole('link', { name: 'https://github.com/OpenHands/foo/pull/42' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/foo/pull/42')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('links trigger_reason when value is a bare domain URL', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ trigger_reason: 'openhands.dev/blabla' }}
      />
    )

    const link = screen.getByRole('link', { name: 'openhands.dev/blabla' })
    expect(link.getAttribute('href')).toBe('https://openhands.dev/blabla')
  })

  it('links the URL portion when trigger_reason contains a URL embedded in text', () => {
    const { container } = render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ trigger_reason: 'abc openhands.dev/blabla xyz' }}
      />
    )

    const link = screen.getByRole('link', { name: 'openhands.dev/blabla' })
    expect(link.getAttribute('href')).toBe('https://openhands.dev/blabla')
    // surrounding text is preserved
    const cell = container.querySelector('td:last-child')!
    expect(cell.textContent).toBe('abc openhands.dev/blabla xyz')
  })

  it('links only the first URL when multiple URLs appear in a value', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ trigger_reason: 'https://first.example.com/a https://second.example.com/b' }}
      />
    )

    const links = screen.getAllByRole('link')
    // Only one link should be rendered (the first URL)
    const triggerLinks = links.filter(l => l.closest('td'))
    expect(triggerLinks).toHaveLength(1)
    expect(triggerLinks[0].getAttribute('href')).toBe('https://first.example.com/a')
  })

  it('does not link plain text with no URL', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ trigger_reason: 'testing SDK: fix/issue-2375' }}
      />
    )

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('links any string field that is a URL, not just trigger_reason', () => {
    render(
      <JsonCard
        title="Parameters"
        icon="⚙️"
        data={{ some_url_field: 'https://example.com/path' }}
      />
    )

    const link = screen.getByRole('link', { name: 'https://example.com/path' })
    expect(link.getAttribute('href')).toBe('https://example.com/path')
  })
})
