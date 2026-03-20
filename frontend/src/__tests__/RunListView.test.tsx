import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RunListView from '../components/RunListView'

describe('RunListView', () => {
  const mockOnSelectRun = vi.fn()
  const defaultProps = {
    runs: [
      {
        slug: 'swebench/test-run/123',
        benchmark: 'swebench',
        model: 'test-run',
        jobId: '123'
      }
    ],
    loading: false,
    error: null,
    onSelectRun: mockOnSelectRun,
    runMetadataMap: {},
    loadingMetadataList: false,
    dayGroups: [{ date: '2025-01-01', runs: ['swebench/test-run/123'] }],
    filterBenchmark: 'all',
    setFilterBenchmark: vi.fn(),
    filterStatus: 'all',
    setFilterStatus: vi.fn(),
    filterText: '',
    setFilterText: vi.fn()
  }

  beforeEach(() => {
    mockOnSelectRun.mockClear()
    vi.stubGlobal('window', {
      ...window,
      location: { href: 'http://localhost/' },
      open: vi.fn()
    })
  })

  it('calls onSelectRun on normal click', () => {
    render(<RunListView {...defaultProps} />)
    const row = screen.getByText('test-run').closest('tr')!
    fireEvent.click(row)
    expect(mockOnSelectRun).toHaveBeenCalledWith('swebench/test-run/123')
    expect(window.open).not.toHaveBeenCalled()
  })

  it('opens in new tab on alt click', () => {
    render(<RunListView {...defaultProps} />)
    const row = screen.getByText('test-run').closest('tr')!
    fireEvent.click(row, { altKey: true })
    expect(mockOnSelectRun).not.toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith('http://localhost/?run=swebench%2Ftest-run%2F123', '_blank')
  })

  it('opens in new tab on meta click', () => {
    render(<RunListView {...defaultProps} />)
    const row = screen.getByText('test-run').closest('tr')!
    fireEvent.click(row, { metaKey: true })
    expect(mockOnSelectRun).not.toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith('http://localhost/?run=swebench%2Ftest-run%2F123', '_blank')
  })

  it('opens in new tab on ctrl click', () => {
    render(<RunListView {...defaultProps} />)
    const row = screen.getByText('test-run').closest('tr')!
    fireEvent.click(row, { ctrlKey: true })
    expect(mockOnSelectRun).not.toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith('http://localhost/?run=swebench%2Ftest-run%2F123', '_blank')
  })

  it('opens in new tab on middle click', () => {
    render(<RunListView {...defaultProps} />)
    const row = screen.getByText('test-run').closest('tr')!
    fireEvent(row, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(mockOnSelectRun).not.toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith('http://localhost/?run=swebench%2Ftest-run%2F123', '_blank')
  })
})
