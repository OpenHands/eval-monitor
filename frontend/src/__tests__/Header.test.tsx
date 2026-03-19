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
    expect((logo as HTMLImageElement).src).toContain('openhands-logo-white.svg')
    expect((logo as HTMLImageElement).alt).toBe('OpenHands')
  })

  it('does not render the old OH text placeholder', () => {
    render(<Header {...defaultProps} />)
    const ohPlaceholders = screen.queryAllByText('OH')
    expect(ohPlaceholders).toHaveLength(0)
  })

  it('renders the Eval Monitor title', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('Eval Monitor')).toBeTruthy()
  })
})
