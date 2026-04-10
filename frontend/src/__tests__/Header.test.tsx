import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  refreshNonce: 0,
  clusterHealthOpen: false,
  onClusterHealthToggle: vi.fn(),
  evalTimeOpen: false,
  onEvalTimeToggle: vi.fn(),
  runMetadataMap: {},
  runs: [],
}

// ClusterHealthBadge fetches on mount; stub fetch per-test so we don't hit the
// network and the stub doesn't leak into other test files sharing the global.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('renders the logo as a button when selectedRun is set', () => {
    const props = { ...defaultProps, selectedRun: 'test-run-123' }
    render(<Header {...props} />)
    const logoContainer = screen.getByTestId('openhands-logo').parentElement
    expect(logoContainer?.tagName).toBe('BUTTON')
    expect(logoContainer?.className).toContain('cursor-pointer')
  })

  it('calls onBack when logo button is clicked', () => {
    const onBack = vi.fn()
    const props = { ...defaultProps, selectedRun: 'test-run-123', onBack }
    render(<Header {...props} />)
    const logoButton = screen.getByTestId('openhands-logo').parentElement
    logoButton?.click()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('opens in new tab when logo button is ctrl/cmd+clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const props = { ...defaultProps, selectedRun: 'test-run-123' }
    render(<Header {...props} />)
    const logoButton = screen.getByTestId('openhands-logo').parentElement as HTMLButtonElement
    logoButton?.click()
    // Simulate Ctrl+click
    const ctrlClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(ctrlClickEvent, 'ctrlKey', { value: true })
    logoButton?.dispatchEvent(ctrlClickEvent)
    expect(openSpy).toHaveBeenCalledWith('/', '_blank')
    openSpy.mockRestore()
  })

  it('logo is not a link when selectedRun is not set', () => {
    const props = { ...defaultProps, selectedRun: null }
    render(<Header {...props} />)
    const logoContainer = screen.getByTestId('openhands-logo').parentElement
    expect(logoContainer?.tagName).toBe('DIV')
    expect(logoContainer?.className).not.toContain('cursor-pointer')
  })
})
