import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('enables copy button when workflow inputs are found', () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: 'v1.15.0',
      eval_limit: '10',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    expect(copyButton).toBeTruthy()
    expect((copyButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables copy button when no workflow inputs found', () => {
    const data = {
      timestamp: '2026-03-27T19:54:18Z',
      triggered_by: 'user123',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('No workflow inputs found in parameters')
    expect(copyButton).toBeTruthy()
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('copies gh command with workflow inputs from params', () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: 'main',
      eval_limit: '1',
      model_ids: 'minimax-m2.5',
      timestamp: '2026-03-27T19:54:18Z',
      triggered_by: 'user123',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

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
      expect.stringContaining('-f sdk_ref="main"')
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('-f eval_limit="1"')
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('-f model_ids="minimax-m2.5"')
    )
    // Should not include non-workflow fields
    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).not.toContain('timestamp')
    expect(call).not.toContain('triggered_by')
  })

  it('shows "Copied!" feedback after copying', async () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: 'main',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy()
    })
  })

  it('skips null values', () => {
    const data = {
      benchmark: 'swebench',
      sdk_ref: 'main',
      instance_ids: null,
      num_infer_workers: null,
      eval_limit: '1',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f benchmark="swebench"')
    expect(call).toContain('-f sdk_ref="main"')
    expect(call).toContain('-f eval_limit="1"')
    expect(call).not.toContain('instance_ids')
    expect(call).not.toContain('num_infer_workers')
  })

  it('maps evaluation_branch to eval_branch and strips refs/heads/', () => {
    const data = {
      benchmark: 'swebench',
      evaluation_branch: 'refs/heads/main',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f eval_branch="main"')
    expect(call).not.toContain('evaluation_branch')
    expect(call).not.toContain('refs/heads')
  })

  it('maps trigger_reason to reason', () => {
    const data = {
      benchmark: 'swebench',
      trigger_reason: 'test eval-job-id',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f reason="test eval-job-id"')
    expect(call).not.toContain('trigger_reason')
  })

  it('extracts model_ids from model_name', () => {
    const data = {
      benchmark: 'swebench',
      model_name: 'litellm_proxy/minimax/MiniMax-M2.5',
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f model_ids="minimax-m2.5"')
    expect(call).not.toContain('model_name')
  })

  it('handles boolean values correctly', () => {
    const data = {
      benchmark: 'swebench',
      allow_unreleased_branches: true,
      enable_conversation_event_logging: false,
    }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f allow_unreleased_branches="true"')
    expect(call).toContain('-f enable_conversation_event_logging="false"')
  })
})
