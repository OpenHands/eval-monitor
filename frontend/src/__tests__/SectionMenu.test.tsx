import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import SectionMenu from '../components/SectionMenu'

describe('SectionMenu', () => {
  beforeEach(() => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/run/some-run-slug',
      },
      writable: true,
    })
  })

  it('renders closed by default', () => {
    render(<SectionMenu id="test-section" />)
    expect(screen.queryByText('Copy link')).toBeNull()
  })

  it('opens menu when clicking the button', () => {
    render(<SectionMenu id="test-section" />)
    const button = screen.getByRole('button', { name: /section options/i })
    
    fireEvent.click(button)
    
    expect(screen.getByText('Copy link')).toBeInTheDocument()
  })

  it('copies correct URL to clipboard when copy link is clicked', async () => {
    render(<SectionMenu id="test-section" />)
    
    // Open menu
    fireEvent.click(screen.getByRole('button', { name: /section options/i }))
    
    // Click copy
    const copyButton = screen.getByText('Copy link')
    await act(async () => {
      fireEvent.click(copyButton)
    })
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost/run/some-run-slug#test-section')
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })
})
