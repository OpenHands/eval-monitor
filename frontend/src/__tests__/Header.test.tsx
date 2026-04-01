import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from '../components/Header'

const defaultProps = {
  date: '2025-03-19',
  onDateChange: vi.fn(),
  onRefresh: vi.fn(),
  selectedRun: null,
  onBack: vi.fn(),
  numDays: 2,
  onNumDaysChange: vi.fn(),
}

describe('Header', () => {
  it('renders the OpenHands logo image', () => {
    render(<Header {...defaultProps} />)
    const logo = screen.getByTestId('openhands-logo')
    expect(logo.tagName).toBe('IMG')
    expect((logo as HTMLImageElement).src).toContain('openhands-logo.svg')
    expect((logo as HTMLImageElement).alt).toBe('OpenHands')
  })

  it('does not render the old OH text placeholder', () => {
    render(<Header {...defaultProps} />)
    const ohPlaceholders = screen.queryAllByText('OH')
    expect(ohPlaceholders).toHaveLength(0)
  })

  it('renders the OpenHands Eval Monitor title', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('OpenHands Eval Monitor')).toBeTruthy()
  })

  it('renders the logo as a link when selectedRun is set', () => {
    const props = { ...defaultProps, selectedRun: 'test-run-123' }
    render(<Header {...props} />)
    const logoContainer = screen.getByTestId('openhands-logo').parentElement
    expect(logoContainer?.tagName).toBe('A')
    expect(logoContainer?.className).toContain('cursor-pointer')
    expect((logoContainer as HTMLAnchorElement).href).toContain('/')
  })

  it('logo is not a link when selectedRun is not set', () => {
    const props = { ...defaultProps, selectedRun: null }
    render(<Header {...props} />)
    const logoContainer = screen.getByTestId('openhands-logo').parentElement
    expect(logoContainer?.tagName).toBe('DIV')
    expect(logoContainer?.className).not.toContain('cursor-pointer')
  })
})
