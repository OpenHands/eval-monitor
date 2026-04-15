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

    it('resets filterStatus to "all" when selected status does not exist in data (after data loads)', () => {
      // Scenario: URL has ?status=error but no runs have error status
      // The reset should only happen AFTER runs have loaded (runs.length > 0)
      const mockSetFilterStatus = vi.fn()
      const propsWithNoErrorRuns = {
        runs: [
          { slug: 'swebench/completed-run/1', benchmark: 'swebench', model: 'completed-run', jobId: '1', status: 'completed' as const },
          { slug: 'swebench/infer-run/2', benchmark: 'swebench', model: 'infer-run', jobId: '2', status: 'running-infer' as const }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/completed-run/1' }, { slug: 'swebench/infer-run/2' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'error', // This status doesn't exist in the runs
        setFilterStatus: mockSetFilterStatus,
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithNoErrorRuns} />)

      // Should call setFilterStatus('all') because 'error' is not in available statuses
      // and runs have loaded (runs.length > 0)
      expect(mockSetFilterStatus).toHaveBeenCalledWith('all')
    })

    it('does not reset filterStatus when runs have not loaded yet', () => {
      // Scenario: runs are still loading (empty array)
      const mockSetFilterStatus = vi.fn()
      const propsWithNoRuns = {
        runs: [], // No runs loaded yet
        loading: true,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'error', // This status doesn't exist but we shouldn't reset while loading
        setFilterStatus: mockSetFilterStatus,
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithNoRuns} />)

      // Should NOT call setFilterStatus because runs haven't loaded yet
      expect(mockSetFilterStatus).not.toHaveBeenCalled()
    })

    it('does not reset filterStatus when selected status exists in data', () => {
      const mockSetFilterStatus = vi.fn()
      const propsWithErrorRuns = {
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
        filterStatus: 'error', // This status DOES exist in the runs
        setFilterStatus: mockSetFilterStatus,
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithErrorRuns} />)

      // Should NOT call setFilterStatus because 'error' exists in available statuses
      expect(mockSetFilterStatus).not.toHaveBeenCalled()
    })

    it('does not reset filterStatus when it is "active"', () => {
      const mockSetFilterStatus = vi.fn()
      const propsWithNoActiveRuns = {
        runs: [
          { slug: 'swebench/completed-run/1', benchmark: 'swebench', model: 'completed-run', jobId: '1', status: 'completed' as const }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/completed-run/1' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'active', // Special status that should always be valid
        setFilterStatus: mockSetFilterStatus,
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }

      render(<RunListView {...propsWithNoActiveRuns} />)

      // Should NOT call setFilterStatus because 'active' is always a valid filter
      expect(mockSetFilterStatus).not.toHaveBeenCalled()
    })
  })

  describe('active workers summary', () => {
    const createMetadata = (status: string, triggeredBy: string = 'user1', extraParams: Record<string, unknown> = {}) => {
      const base = {
        init: null,
        params: triggeredBy ? { triggered_by: triggeredBy, ...extraParams } : null,
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
          return { ...base, params: base.params ? { ...base.params, timestamp: '2025-01-01T00:00:00Z' } : { timestamp: '2025-01-01T00:00:00Z' } }
        case 'running-infer':
          return { ...base, runInferStart: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'running-eval':
          return { ...base, evalInferStart: { timestamp: '2025-01-01T00:00:00Z' } }
        case 'completed':
          return { ...base, evalInferEnd: { timestamp: '2025-01-01T00:00:00Z' } }
        default:
          return base
      }
    }

    it('shows total active workers count', () => {
      const props = {
        runs: [
          { slug: 'swebench/run1/1', benchmark: 'swebench', model: 'run1', jobId: '1' },
          { slug: 'swebench/run2/2', benchmark: 'swebench', model: 'run2', jobId: '2' },
          { slug: 'swebench/run3/3', benchmark: 'swebench', model: 'run3', jobId: '3' }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {
          'swebench/run1/1': createMetadata('running-infer', 'user1'),
          'swebench/run2/2': createMetadata('running-infer', 'user1'),
          'swebench/run3/3': createMetadata('completed', 'user1')
        },
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/run1/1' }, { slug: 'swebench/run2/2' }, { slug: 'swebench/run3/3' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      // 2 running-infer runs with default 20 workers each = 40 workers
      expect(screen.getByTestId('total-active-workers').textContent).toBe('40')
    })

    it('shows per-author breakdown for active workers based on worker count', () => {
      const props = {
        runs: [
          { slug: 'swebench/run1/1', benchmark: 'swebench', model: 'run1', jobId: '1', triggeredBy: 'alice' },
          { slug: 'swebench/run2/2', benchmark: 'swebench', model: 'run2', jobId: '2', triggeredBy: 'alice' },
          { slug: 'swebench/run3/3', benchmark: 'swebench', model: 'run3', jobId: '3', triggeredBy: 'bob' }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {
          'swebench/run1/1': createMetadata('running-infer', 'alice', { num_infer_workers: 10 }),
          'swebench/run2/2': createMetadata('running-infer', 'alice', { num_infer_workers: 5 }),
          'swebench/run3/3': createMetadata('running-infer', 'bob', { num_infer_workers: 2 })
        },
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/run1/1' }, { slug: 'swebench/run2/2' }, { slug: 'swebench/run3/3' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      // Only running-infer runs: alice has 10+5=15, bob has 2, total=17
      expect(screen.getByTestId('total-active-workers').textContent).toBe('17')
      expect(screen.getByTestId('active-workers-author-alice').textContent).toContain('alice: 15')
      expect(screen.getByTestId('active-workers-author-bob').textContent).toContain('bob: 2')
    })

    it('calculates workers from eval_limit when num_infer_workers not set', () => {
      const props = {
        runs: [
          { slug: 'swebench/run1/1', benchmark: 'swebench', model: 'run1', jobId: '1' },
          { slug: 'swebench/run2/2', benchmark: 'swebench', model: 'run2', jobId: '2' }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {
          'swebench/run1/1': createMetadata('running-infer', 'user1', { eval_limit: 50 }),
          'swebench/run2/2': createMetadata('running-infer', 'user1', { eval_limit: 10 })
        },
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/run1/1' }, { slug: 'swebench/run2/2' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      // eval_limit: 50 -> capped to 20, eval_limit: 10 -> 10
      expect(screen.getByTestId('total-active-workers').textContent).toBe('30')
    })

    it('shows primary color when total active workers < 240', () => {
      const props = {
        runs: [
          { slug: 'swebench/run1/1', benchmark: 'swebench', model: 'run1', jobId: '1' }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {
          'swebench/run1/1': createMetadata('running-infer', 'user1')
        },
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/run1/1' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      expect(screen.getByTestId('total-active-workers').className).toContain('text-oh-primary')
    })

    it('shows orange color when total active workers >= 240 and <= 256', () => {
      const runs = Array.from({ length: 12 }, (_, i) => ({
        slug: `swebench/run${i}/${i}`,
        benchmark: 'swebench',
        model: `run${i}`,
        jobId: String(i)
      }))
      const runMetadataMap: Record<string, ReturnType<typeof createMetadata>> = {}
      runs.forEach((run) => {
        // 12 runs * 20 workers each = 240 workers (orange threshold)
        runMetadataMap[run.slug] = createMetadata('running-infer', 'user1', { num_infer_workers: 20 })
      })
      const props = {
        runs,
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap,
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: runs.map(r => ({ slug: r.slug })) }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      expect(screen.getByTestId('total-active-workers').textContent).toBe('240')
      expect(screen.getByTestId('total-active-workers').className).toContain('text-orange-400')
    })

    it('shows error color when total active workers > 256', () => {
      const runs = Array.from({ length: 13 }, (_, i) => ({
        slug: `swebench/run${i}/${i}`,
        benchmark: 'swebench',
        model: `run${i}`,
        jobId: String(i)
      }))
      const runMetadataMap: Record<string, ReturnType<typeof createMetadata>> = {}
      runs.forEach((run) => {
        // 13 runs * 20 workers each = 260 workers (red threshold)
        runMetadataMap[run.slug] = createMetadata('running-infer', 'user1', { num_infer_workers: 20 })
      })
      const props = {
        runs,
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap,
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: runs.map(r => ({ slug: r.slug })) }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      expect(screen.getByTestId('total-active-workers').textContent).toBe('260')
      expect(screen.getByTestId('total-active-workers').className).toContain('text-oh-error')
    })

    it('hides active workers summary when showDetail is true', () => {
      const props = {
        runs: [
          { slug: 'swebench/run1/1', benchmark: 'swebench', model: 'run1', jobId: '1' }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {
          'swebench/run1/1': createMetadata('running-infer', 'user1')
        },
        loadingMetadataList: false,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/run1/1' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: true
      }
      render(<RunListView {...props} />)
      expect(screen.queryByTestId('total-active-workers')).not.toBeInTheDocument()
    })

    it('does not show active summary when loading metadata', () => {
      const props = {
        runs: [
          { slug: 'swebench/run1/1', benchmark: 'swebench', model: 'run1', jobId: '1' }
        ],
        loading: false,
        error: null,
        onSelectRun: mockOnSelectRun,
        runMetadataMap: {},
        loadingMetadataList: true,
        dayGroups: [{ date: '2025-01-01', runs: [{ slug: 'swebench/run1/1' }] }],
        filterBenchmark: 'all',
        setFilterBenchmark: vi.fn(),
        filterStatus: 'all',
        setFilterStatus: vi.fn(),
        filterText: '',
        setFilterText: vi.fn(),
        showDetail: false
      }
      render(<RunListView {...props} />)
      expect(screen.queryByTestId('total-active-workers')).not.toBeInTheDocument()
    })
  })
})
