import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunDetailView from '../components/RunDetailView'

describe('RunDetailView metadata card order', () => {
  const metadata = {
    init: { key: 'init-value' },
    params: { key: 'params-value' },
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
    error: null,
  }

  it('renders Parameters card before Init card', () => {
    render(
      <RunDetailView
        slug="benchmark/model/123"
        metadata={metadata}
        loading={false}
        status="running-infer"
      />
    )

    const headings = screen.getAllByRole('heading', { level: 3 })
    const titles = headings.map((h) => h.textContent)

    const parametersIndex = titles.indexOf('Parameters')
    const initIndex = titles.indexOf('Init')

    expect(parametersIndex).toBeGreaterThanOrEqual(0)
    expect(initIndex).toBeGreaterThanOrEqual(0)
    expect(parametersIndex).toBeLessThan(initIndex)
  })
})
