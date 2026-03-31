import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ErrorReportSection from '../components/ErrorReportSection'
import * as api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    fetchErrorReport: vi.fn(),
    getResultsUrl: vi.fn((slug, path) => `https://mock-results.com/${slug}/${path}`)
  }
})

describe('ErrorReportSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when error report is null and status is not eval-related', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" status="pending" />)
    
    await waitFor(() => {
      expect(screen.queryByTestId('error-report-section')).not.toBeInTheDocument()
    })
  })

  it('does not render when error report is null and no status provided', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" />)
    
    await waitFor(() => {
      expect(screen.queryByTestId('error-report-section')).not.toBeInTheDocument()
    })
  })

  it('shows warning when eval started but error report not available yet (running-eval)', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" status="running-eval" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('error-report-section')).toBeInTheDocument()
    })
    
    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('Error Report')).toBeInTheDocument()
    expect(screen.getByText('Evaluation has started but error report is not available yet. Please check back shortly.')).toBeInTheDocument()
  })

  it('shows warning when eval started but error report not available yet (completed)', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" status="completed" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('error-report-section')).toBeInTheDocument()
    })
    
    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('Error Report')).toBeInTheDocument()
    expect(screen.getByText('Evaluation has started but error report is not available yet. Please check back shortly.')).toBeInTheDocument()
  })

  it('does not show warning when eval has not started (running-infer)', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" status="running-infer" />)
    
    await waitFor(() => {
      expect(screen.queryByTestId('error-report-section')).not.toBeInTheDocument()
    })
  })

  it('does not show warning when status is pending', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" status="pending" />)
    
    await waitFor(() => {
      expect(screen.queryByTestId('error-report-section')).not.toBeInTheDocument()
    })
  })

  it('renders correctly when error report has content (errors found)', async () => {
    const mockReport = 'Some inference error happened\nTraceback...'
    vi.mocked(api.fetchErrorReport).mockResolvedValue(mockReport)
    
    render(<ErrorReportSection slug="test-run" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('error-report-section')).toBeInTheDocument()
    })
    
    expect(screen.getByText('⚠️')).toBeInTheDocument()
    expect(screen.getByText('Conversation Errors Found')).toBeInTheDocument()
    expect(screen.getByText('View full list of errors (conversation-errors.txt)')).toBeInTheDocument()
    expect(screen.getByText('View full list of errors (conversation-errors.txt)')).toHaveAttribute(
      'href', 
      'https://mock-results.com/test-run/conversation-errors.txt'
    )
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'pre' && content.includes('Some inference error happened');
    })).toBeInTheDocument()
  })

  it('renders correctly when no errors found', async () => {
    const mockReport = 'Everything is fine\nNo errors found.'
    vi.mocked(api.fetchErrorReport).mockResolvedValue(mockReport)
    
    render(<ErrorReportSection slug="test-run" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('error-report-section')).toBeInTheDocument()
    })
    
    expect(screen.getByText('✅')).toBeInTheDocument()
    expect(screen.getByText('All Conversations Pass Checks')).toBeInTheDocument()
    expect(screen.queryByText('View full list of errors (conversation-errors.txt)')).not.toBeInTheDocument()
    
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'pre' && content.includes('Everything is fine');
    })).toBeInTheDocument()
  })
})
