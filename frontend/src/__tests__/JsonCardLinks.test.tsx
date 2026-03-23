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
        data={{ build_action: 'dispatch-abc123xyz' }}
      />
    )

    const link = screen.getByRole('link', { name: 'dispatch-abc123xyz' })
    expect(link.getAttribute('href')).toBe('https://github.com/OpenHands/benchmarks/actions?query=branch%3Adispatch-abc123xyz')
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
