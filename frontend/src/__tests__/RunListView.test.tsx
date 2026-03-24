import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RunListView from '../components/RunListView'

describe('RunListView', () => {
  const mockOnSelectRun = vi.fn()
  const multipleRunsProps = {
    runs: [
      {
        slug: 'swebench/qwen-2.5-coder/123',
        benchmark: 'swebench',
        model: 'qwen-2.5-coder',
        jobId: '123'
      },
      {
        slug: 'gaia/claude-sonnet/456',
        benchmark: 'gaia',
        model: 'claude-sonnet',
        jobId: '456'
      },
      {
        slug: 'swebench/gpt-4o/789',
        benchmark: 'swebench',
        model: 'gpt-4o',
        jobId: '789'
      }
    ],
    loading: false,
    error: null,
    onSelectRun: mockOnSelectRun,
    runMetadataMap: {
      'swebench/qwen-2.5-coder/123': {
        init: null,
        params: { triggered_by: 'juanmichelini' },
        error: null,
        runInferStart: null,
        runInferEnd: null,
        evalInferStart: null,
        evalInferEnd: null,
        cancelEval: null
      },
      'gaia/claude-sonnet/456': {
        init: null,
        params: { triggered_by: 'admin' },
        error: null,
        runInferStart: null,
        runInferEnd: null,
        evalInferStart: null,
        evalInferEnd: null,
        cancelEval: null
      },
      'swebench/gpt-4o/789': {
        init: null,
        params: { triggered_by: 'admin' },
        error: null,
        runInferStart: null,
        runInferEnd: null,
        evalInferStart: null,
        evalInferEnd: null,
        cancelEval: null
      }
    },
    loadingMetadataList: false,
    dayGroups: [{ date: '2025-01-01', runs: ['swebench/qwen-2.5-coder/123', 'gaia/claude-sonnet/456', 'swebench/gpt-4o/789'] }],
    filterBenchmark: 'all',
    setFilterBenchmark: vi.fn(),
    filterStatus: 'all',
    setFilterStatus: vi.fn(),
    filterText: '',
    setFilterText: vi.fn()
  }
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

  describe('text filtering', () => {
    it('filters by single term', () => {
      render(<RunListView {...multipleRunsProps} filterText="qwen" />)
      // Should only show the qwen model
      expect(screen.getByText('qwen-2.5-coder')).toBeInTheDocument()
      expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()
      expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument()
    })

    it('filters by multiple space-separated terms using AND logic', () => {
      // "juan qwen" should match runs where BOTH terms appear (in any field)
      render(<RunListView {...multipleRunsProps} filterText="juan qwen" />)
      // qwen-2.5-coder is triggered by juanmichelini, so it matches both "juan" and "qwen"
      expect(screen.getByText('qwen-2.5-coder')).toBeInTheDocument()
      // Others don't match both terms
      expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()
      expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument()
    })

    it('requires all terms to match for AND filtering', () => {
      // "swebench admin" should match runs that have BOTH terms
      render(<RunListView {...multipleRunsProps} filterText="swebench admin" />)
      // gpt-4o is swebench + triggered by admin
      expect(screen.getByText('gpt-4o')).toBeInTheDocument()
      // qwen-2.5-coder is swebench but triggered by juanmichelini (no admin)
      expect(screen.queryByText('qwen-2.5-coder')).not.toBeInTheDocument()
      // claude-sonnet is gaia + triggered by admin (no swebench)
      expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()
    })

    it('is case insensitive', () => {
      render(<RunListView {...multipleRunsProps} filterText="QWEN JUAN" />)
      expect(screen.getByText('qwen-2.5-coder')).toBeInTheDocument()
    })

    it('handles extra whitespace', () => {
      render(<RunListView {...multipleRunsProps} filterText="  juan   qwen  " />)
      expect(screen.getByText('qwen-2.5-coder')).toBeInTheDocument()
      expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()
    })

    it('handles + as separator between terms', () => {
      render(<RunListView {...multipleRunsProps} filterText="juan+qwen" />)
      expect(screen.getByText('qwen-2.5-coder')).toBeInTheDocument()
      expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()
      expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument()
    })

    it('shows no results when no runs match all terms', () => {
      render(<RunListView {...multipleRunsProps} filterText="nonexistent terms" />)
      expect(screen.getByText('No runs match the current filters.')).toBeInTheDocument()
    })
  })
})
