import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExportPathsModal, { EXPORTABLE_FILES, getFilePath, buildFilterString } from '../components/ExportPathsModal'

describe('ExportPathsModal', () => {
  const mockOnClose = vi.fn()
  const mockFilteredRuns = [
    { slug: 'swebench/model-a/123', jobId: '123' },
    { slug: 'gaia/model-b/456', jobId: '456' },
  ]

  beforeEach(() => {
    mockOnClose.mockClear()
    // Mock URL.createObjectURL and URL.revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('does not render when closed', () => {
    render(
      <ExportPathsModal
        isOpen={false}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    expect(screen.queryByText('Export current instances paths to JSON')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    expect(screen.getByText('Export current instances paths to JSON')).toBeInTheDocument()
    expect(screen.getByText(/Select which files to include.*2 runs/)).toBeInTheDocument()
  })

  it('shows all exportable file checkboxes', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    EXPORTABLE_FILES.forEach(file => {
      expect(screen.getByText(file.filename)).toBeInTheDocument()
    })
  })

  it('has default checked files: params.json, results.tar.gz, output.report.json', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    const paramsCheckbox = screen.getByTestId('checkbox-params.json') as HTMLInputElement
    const resultsCheckbox = screen.getByTestId('checkbox-results.tar.gz') as HTMLInputElement
    const outputCheckbox = screen.getByTestId('checkbox-output.report.json') as HTMLInputElement
    const initCheckbox = screen.getByTestId('checkbox-init.json') as HTMLInputElement

    expect(paramsCheckbox.checked).toBe(true)
    expect(resultsCheckbox.checked).toBe(true)
    expect(outputCheckbox.checked).toBe(true)
    expect(initCheckbox.checked).toBe(false)
  })

  it('toggles individual checkbox on click', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    const initCheckbox = screen.getByTestId('checkbox-init.json') as HTMLInputElement
    expect(initCheckbox.checked).toBe(false)

    fireEvent.click(initCheckbox)
    expect(initCheckbox.checked).toBe(true)

    fireEvent.click(initCheckbox)
    expect(initCheckbox.checked).toBe(false)
  })

  it('toggles all checkboxes with mark all button', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    const toggleAllCheckbox = screen.getByTestId('toggle-all-checkbox') as HTMLInputElement

    // Mark all
    fireEvent.click(toggleAllCheckbox)
    EXPORTABLE_FILES.forEach(file => {
      const checkbox = screen.getByTestId(`checkbox-${file.filename}`) as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    // Unmark all
    fireEvent.click(toggleAllCheckbox)
    EXPORTABLE_FILES.forEach(file => {
      const checkbox = screen.getByTestId(`checkbox-${file.filename}`) as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })
  })

  it('calls onClose when clicking close button', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    fireEvent.click(screen.getByTestId('close-modal-button'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    fireEvent.click(screen.getByTestId('export-modal-backdrop'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking cancel button', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('disables export button when no files selected', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    // Unmark all
    fireEvent.click(screen.getByTestId('toggle-all-checkbox'))
    fireEvent.click(screen.getByTestId('toggle-all-checkbox'))

    const exportButton = screen.getByTestId('download-button')
    expect(exportButton).toBeDisabled()
  })

  it('disables copy button when no files selected', () => {
    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    // Unmark all
    fireEvent.click(screen.getByTestId('toggle-all-checkbox'))
    fireEvent.click(screen.getByTestId('toggle-all-checkbox'))

    const copyButton = screen.getByTestId('copy-button')
    expect(copyButton).toBeDisabled()
  })

  it('copies JSON to clipboard when clicking copy button', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText }
    })

    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )

    fireEvent.click(screen.getByTestId('copy-button'))

    expect(mockWriteText).toHaveBeenCalled()
    const copiedJson = JSON.parse(mockWriteText.mock.calls[0][0])
    expect(copiedJson).toHaveLength(2)
    expect(copiedJson[0].eval_job_id).toBe('123')
    expect(copiedJson[0]['params.json']).toContain('swebench/model-a/123')
  })

  it('shows Copied! text after clicking copy button', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText }
    })

    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )

    const copyButton = screen.getByTestId('copy-button')
    expect(copyButton).toHaveTextContent('Copy')

    fireEvent.click(copyButton)

    // Wait for state update
    await vi.waitFor(() => {
      expect(screen.getByTestId('copy-button')).toHaveTextContent('Copied!')
    })
  })

  it('calls onClose after clicking export', () => {
    // Mock the download behavior
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()

    const mockClick = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement(tagName)
        anchor.click = mockClick
        return anchor
      }
      return originalCreateElement(tagName)
    })

    render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )

    fireEvent.click(screen.getByTestId('download-button'))

    expect(mockClick).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()

    // Cleanup
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('resets selections when modal reopens', () => {
    const { rerender } = render(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )

    // Select init.json
    fireEvent.click(screen.getByTestId('checkbox-init.json'))
    expect((screen.getByTestId('checkbox-init.json') as HTMLInputElement).checked).toBe(true)

    // Close and reopen
    rerender(
      <ExportPathsModal
        isOpen={false}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )
    rerender(
      <ExportPathsModal
        isOpen={true}
        onClose={mockOnClose}
        filteredRuns={mockFilteredRuns}
        filterBenchmark="all"
        filterStatus="all"
        filterText=""
      />
    )

    // Should be back to defaults
    expect((screen.getByTestId('checkbox-init.json') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByTestId('checkbox-params.json') as HTMLInputElement).checked).toBe(true)
  })
})

describe('getFilePath', () => {
  it('returns filename for files without subdir', () => {
    expect(getFilePath({ filename: 'results.tar.gz', defaultChecked: true })).toBe('results.tar.gz')
  })

  it('returns subdir/filename for files with subdir', () => {
    expect(getFilePath({ filename: 'params.json', subdir: 'metadata', defaultChecked: true })).toBe('metadata/params.json')
  })
})

describe('EXPORTABLE_FILES', () => {
  it('has correct default checked files', () => {
    const defaultChecked = EXPORTABLE_FILES.filter(f => f.defaultChecked).map(f => f.filename)
    expect(defaultChecked).toEqual(['params.json', 'results.tar.gz', 'output.report.json'])
  })

  it('contains all expected files', () => {
    const filenames = EXPORTABLE_FILES.map(f => f.filename)
    expect(filenames).toContain('params.json')
    expect(filenames).toContain('results.tar.gz')
    expect(filenames).toContain('output.report.json')
    expect(filenames).toContain('init.json')
    expect(filenames).toContain('error.json')
    expect(filenames).toContain('cost_report_v2.json')
    expect(filenames).toContain('cost_report.jsonl')
    expect(filenames).toContain('conversation-error-report.txt')
  })
})

describe('buildFilterString', () => {
  it('returns "all" when no filters are active', () => {
    expect(buildFilterString('all', 'all', '')).toBe('all')
  })

  it('includes benchmark when not "all"', () => {
    expect(buildFilterString('swebench', 'all', '')).toBe('benchmark-swebench')
  })

  it('includes status when not "all"', () => {
    expect(buildFilterString('all', 'completed', '')).toBe('status-completed')
  })

  it('includes sanitized text filter', () => {
    expect(buildFilterString('all', 'all', 'my search')).toBe('text-my-search')
  })

  it('combines multiple filters with underscores', () => {
    expect(buildFilterString('swebench', 'completed', 'test')).toBe('benchmark-swebench_status-completed_text-test')
  })

  it('sanitizes special characters in text filter', () => {
    expect(buildFilterString('all', 'all', 'hello@world!test')).toBe('text-hello-world-test')
  })

  it('truncates long text filters to 30 characters', () => {
    const longText = 'this is a very long search string that should be truncated'
    const result = buildFilterString('all', 'all', longText)
    // After sanitization "this is a very long search string..." becomes "this-is-a-very-long-search-str..."
    // Then it's sliced to 30 chars
    expect(result.startsWith('text-')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(35) // 'text-' (5) + 30 chars max
  })
})
