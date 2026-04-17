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
        jobId: '123',
        triggeredBy: 'juanmichelini'
      },
      {
        slug: 'gaia/claude-sonnet/456',
        benchmark: 'gaia',
        model: 'claude-sonnet',
        jobId: '456',
        triggeredBy: 'admin'
      },
      {
        slug: 'swebench/gpt-4o/789',
        benchmark: 'swebench',
        model: 'gpt-4o',
        jobId: '789',
        triggeredBy: 'admin'
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
    dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/qwen-2.5-coder/123' }, { slug: 'gaia/claude-sonnet/456' }, { slug: 'swebench/gpt-4o/789' }] }],
    filterBenchmark: 'all',
    setFilterBenchmark: vi.fn(),
    filterStatus: 'all',
    setFilterStatus: vi.fn(),
    filterText: '',
    setFilterText: vi.fn(),
    showDetail: false
  }

  beforeEach(() => {
    mockOnSelectRun.mockClear()
    vi.stubGlobal('window', {
      ...window,
      location: { href: 'http://localhost/' },
      open: vi.fn()
    })
  })

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
    dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/test-run/123' }] }],
    filterBenchmark: 'all',
    setFilterBenchmark: vi.fn(),
    filterStatus: 'all',
    setFilterStatus: vi.fn(),
    filterText: '',
    setFilterText: vi.fn(),
    showDetail: false
  }

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

  describe('active status filtering', () => {
    const createMetadata = (status: string) => {
      const base = {
        init: null,
        params: null,
        error: null,
        runInferStart: null,
        runInferEnd: null,
        evalInferStart: null,
        evalInferEnd: null,
        cancelEval: null
      }
      switch (status) {
        case 'pending':
          return { ...base }
        case 'building':
          return { ...base, params: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'running-infer':
          return { ...base, runInferStart: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'running-eval':
          return { ...base, evalInferStart: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'completed':
          return { ...base, evalInferEnd: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'error':
          return { ...base, error: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'cancelled':
          return { ...base, cancelEval: { timestamp: '2025-01-01T00:00:00Z' } }
        default:
          return base
      }
    }

    const activeStatusProps = {
      runs: [
        { slug: 'swebench/pending-run/1', benchmark: 'swebench', model: 'pending-run', jobId: '1' },
        { slug: 'swebench/building-run/2', benchmark: 'swebench', model: 'building-run', jobId: '2' },
        { slug: 'swebench/infer-run/3', benchmark: 'swebench', model: 'infer-run', jobId: '3' },
        { slug: 'swebench/eval-run/4', benchmark: 'swebench', model: 'eval-run', jobId: '4' },
        { slug: 'swebench/completed-run/5', benchmark: 'swebench', model: 'completed-run', jobId: '5' },
        { slug: 'swebench/error-run/6', benchmark: 'swebench', model: 'error-run', jobId: '6' },
        { slug: 'swebench/cancelled-run/7', benchmark: 'swebench', model: 'cancelled-run', jobId: '7' }
      ],
      loading: false,
      error: null,
      onSelectRun: mockOnSelectRun,
      runMetadataMap: {
        'swebench/pending-run/1': createMetadata('pending'),
        'swebench/building-run/2': createMetadata('building'),
        'swebench/infer-run/3': createMetadata('running-infer'),
        'swebench/eval-run/4': createMetadata('running-eval'),
        'swebench/completed-run/5': createMetadata('completed'),
        'swebench/error-run/6': createMetadata('error'),
        'swebench/cancelled-run/7': createMetadata('cancelled')
      },
      loadingMetadataList: false,
      dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/pending-run/1' }, { slug: 'swebench/building-run/2' }, { slug: 'swebench/infer-run/3' }, { slug: 'swebench/eval-run/4' }, { slug: 'swebench/completed-run/5' }, { slug: 'swebench/error-run/6' }, { slug: 'swebench/cancelled-run/7' }] }],
      filterBenchmark: 'all',
      setFilterBenchmark: vi.fn(),
      filterStatus: 'all',
      setFilterStatus: vi.fn(),
      filterText: '',
      setFilterText: vi.fn(),
      showDetail: false
    }

    it('shows all active statuses when filterStatus is "active"', () => {
      render(<RunListView {...activeStatusProps} filterStatus="active" />)
      // Should show pending, building, running-infer, running-eval
      expect(screen.getByText('pending-run')).toBeInTheDocument()
      expect(screen.getByText('building-run')).toBeInTheDocument()
      expect(screen.getByText('infer-run')).toBeInTheDocument()
      expect(screen.getByText('eval-run')).toBeInTheDocument()
      // Should NOT show completed, error, cancelled
      expect(screen.queryByText('completed-run')).not.toBeInTheDocument()
      expect(screen.queryByText('error-run')).not.toBeInTheDocument()
      expect(screen.queryByText('cancelled-run')).not.toBeInTheDocument()
    })

    it('shows the active option in the status filter dropdown', () => {
      render(<RunListView {...activeStatusProps} />)
      // The status dropdown is the second select element
      const selects = document.querySelectorAll('select')
      expect(selects[1]).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Active' })).toBeInTheDocument()
    })

    it('filters runs correctly when filterStatus is set from URL', () => {
      // Scenario: URL has ?status=error and data has error runs
      const propsWithErrorFilter = {
        runs: [
          { slug: 'swebench/completed-run/1', benchmark: 'swebench', model: 'completed-run', jobId: '1', status: 'completed' as const },
          { slug: 'swebench/error-run/2', benchmark: 'swebench', model: 'error-run', jobId: '2', status: 'error' as const },
          { slug: 'swebench/infer-run/3', benchmark: 'swebench', model: 'infer-run', jobId: '3', status: 'running-infer' as const }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/completed-run/1' }, { slug: 'swebench/error-run/2' }, { slug: 'swebench/infer-run/3' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'error', // Filter by error
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithErrorFilter} />)

      // Should only show the error run
      expect(screen.getByText('error-run')).toBeInTheDocument()
      expect(screen.queryByText('completed-run')).not.toBeInTheDocument()
      expect(screen.queryByText('infer-run')).not.toBeInTheDocument()
    })

    it('shows no runs message when filter matches no runs', () => {
      // Scenario: URL has ?status=cancelled but no cancelled runs exist
      const propsWithNoCancelledRuns = {
        runs: [
          { slug: 'swebench/completed-run/1', benchmark: 'swebench', model: 'completed-run', jobId: '1', status: 'completed' as const },
          { slug: 'swebench/error-run/2', benchmark: 'swebench', model: 'error-run', jobId: '2', status: 'error' as const }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/completed-run/1' }, { slug: 'swebench/error-run/2' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'cancelled', // No cancelled runs exist
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithNoCancelledRuns} />)

      // Should show the "no runs" message
      expect(screen.getByText('No runs match the current filters.')).toBeInTheDocument()
    })

    it('clicking status badge calls setFilterStatus with correct value', () => {
      const setFilterStatus = vi.fn()
      const propsWithMixedStatuses = {
        runs: [
          { slug: 'swebench/completed-run/1', benchmark: 'swebench', model: 'completed-run', jobId: '1', status: 'completed' as const },
          { slug: 'swebench/error-run/2', benchmark: 'swebench', model: 'error-run', jobId: '2', status: 'error' as const },
          { slug: 'swebench/infer-run/3', benchmark: 'swebench', model: 'infer-run', jobId: '3', status: 'running-infer' as const }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/completed-run/1' }, { slug: 'swebench/error-run/2' }, { slug: 'swebench/infer-run/3' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus,
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithMixedStatuses} />)

      // Find and click the Error badge button (contains "Error" text and a count)
      const errorBadge = screen.getByRole('button', { name: /Error.*1/i })
      fireEvent.click(errorBadge)

      // Should call setFilterStatus with 'error'
      expect(setFilterStatus).toHaveBeenCalledWith('error')
    })

    it('clicking same status badge toggles filter back to all', () => {
      const setFilterStatus = vi.fn()
      const propsWithErrorFilter = {
        runs: [
          { slug: 'swebench/completed-run/1', benchmark: 'swebench', model: 'completed-run', jobId: '1', status: 'completed' as const },
          { slug: 'swebench/error-run/2', benchmark: 'swebench', model: 'error-run', jobId: '2', status: 'error' as const }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/completed-run/1' }, { slug: 'swebench/error-run/2' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'error', // Already filtering by error
        setFilterStatus,
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithErrorFilter} />)

      // Find and click the Error badge button (should toggle off since we're already filtering by error)
      const errorBadge = screen.getByRole('button', { name: /Error.*1/i })
      fireEvent.click(errorBadge)

      // Should call setFilterStatus with 'all' to clear the filter
      expect(setFilterStatus).toHaveBeenCalledWith('all')
    })
  })
})
