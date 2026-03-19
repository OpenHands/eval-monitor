import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunListView from '../components/RunListView'
import type { DayRunGroup } from '../api'

const defaultProps = {
  runs: [
    { slug: 'swebench/gpt-4/42', benchmark: 'swebench', model: 'gpt-4', jobId: '42' },
  ],
  loading: false,
  error: null,
  onSelectRun: vi.fn(),
  runMetadataMap: {},
  loadingMetadataList: false,
  dayGroups: [{ date: '2025-03-15', runs: ['swebench/gpt-4/42'] }] as DayRunGroup[],
}

describe('RunListView', () => {
  it('displays job id without # prefix in the list', () => {
    render(<RunListView {...defaultProps} />)
    const jobCell = screen.getByText('42')
    expect(jobCell.textContent).toBe('42')
    expect(jobCell.textContent).not.toContain('#')
  })

  it('does not display # before job id', () => {
    render(<RunListView {...defaultProps} />)
    // There should be no element containing '#42'
    const allText = document.body.textContent || ''
    expect(allText).not.toContain('#42')
  })
})
