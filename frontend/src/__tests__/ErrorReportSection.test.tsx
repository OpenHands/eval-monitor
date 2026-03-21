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

  it('does not render when error report is null', async () => {
    vi.mocked(api.fetchErrorReport).mockResolvedValue(null)
    
    render(<ErrorReportSection slug="test-run" />)
    
    // Wait for the state to settle
    await waitFor(() => {
      expect(screen.queryByTestId('error-report-section')).not.toBeInTheDocument()
    })
  })

  it('renders correctly when error report has content', async () => {
    const mockReport = 'Some inference error happened\nTraceback...'
    vi.mocked(api.fetchErrorReport).mockResolvedValue(mockReport)
    
    render(<ErrorReportSection slug="test-run" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('error-report-section')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Inference Error report')).toBeInTheDocument()
    expect(screen.getByText('View full list of errors (metadata/conversation-errors.txt)')).toBeInTheDocument()
    expect(screen.getByText('View full list of errors (metadata/conversation-errors.txt)')).toHaveAttribute(
      'href', 
      'https://mock-results.com/test-run/metadata/conversation-errors.txt'
    )
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'pre' && content.includes('Some inference error happened');
    })).toBeInTheDocument()
  })
})
