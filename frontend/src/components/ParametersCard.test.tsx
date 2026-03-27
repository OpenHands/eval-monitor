import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ParametersCard from './ParametersCard'

describe('ParametersCard', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    })
  })

  it('renders "Not available yet" when data is null', () => {
    render(<ParametersCard data={null} />)
    expect(screen.getByText('Not available yet')).toBeTruthy()
  })

  it('renders "Not available yet" when data is undefined', () => {
    render(<ParametersCard data={undefined} />)
    expect(screen.getByText('Not available yet')).toBeTruthy()
  })

  it('renders parameters table with data', () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: 'v1.15.0',
      eval_limit: '10',
    }
    render(<ParametersCard data={data} />)

    expect(screen.getByText('Parameters')).toBeTruthy()
    expect(screen.getByText('benchmark')).toBeTruthy()
    expect(screen.getByText('swebench')).toBeTruthy()
    expect(screen.getByText('sdk_ref')).toBeTruthy()
    expect(screen.getByText('v1.15.0')).toBeTruthy()
  })

  it('shows "Copy command" button', () => {
    const data = { benchmark: 'swebench' }
    render(<ParametersCard data={data} />)

    expect(screen.getByTitle('Copy gh workflow run command')).toBeTruthy()
  })

  it('copies gh command to clipboard when button is clicked', async () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: 'v1.15.0',
      eval_limit: '10',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('gh workflow run run-eval.yml')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('--repo OpenHands/software-agent-sdk')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f benchmark="swebench"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f sdk_ref="v1.15.0"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f eval_limit="10"')
      )
    })
  })

  it('shows "Copied!" feedback after copying', async () => {
    const data = { benchmark: 'swebench' }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy()
    })
  })

  it('strips refs/heads/ prefix from branch names', async () => {
    const data = {
      eval_branch: 'refs/heads/main',
      benchmarks_branch: 'refs/heads/feature-branch',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f eval_branch="main"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f benchmarks_branch="feature-branch"')
      )
    })
  })

  it('handles boolean values correctly', async () => {
    const data = {
      allow_unreleased_branches: true,
      enable_conversation_event_logging: false,
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f allow_unreleased_branches="true"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f enable_conversation_event_logging="false"')
      )
    })
  })

  it('skips null and undefined values', async () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: null,
      eval_limit: undefined,
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call).toContain('-f benchmark="swebench"')
      expect(call).not.toContain('sdk_ref')
      expect(call).not.toContain('eval_limit')
    })
  })

  it('maps evaluation_branch to eval_branch', async () => {
    const data = {
      evaluation_branch: 'main',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f eval_branch="main"')
      )
    })
  })
})
