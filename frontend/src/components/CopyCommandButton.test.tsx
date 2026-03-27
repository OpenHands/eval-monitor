import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CopyCommandButton from './CopyCommandButton'

describe('CopyCommandButton', () => {
  let fetchMock: any

  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    })

    // Mock fetch API
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockWorkflowParamsResponse = (params: Record<string, string>) => {
    // Mock API response from our serverless function
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ params }),
    })
  }

  it('does not render when no sdkWorkflowRunId', () => {
    const { container } = render(<CopyCommandButton sdkWorkflowRunId={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state initially', () => {
    mockWorkflowParamsResponse({ benchmark: 'swebench' })
    render(<CopyCommandButton sdkWorkflowRunId="12345" />)
    
    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('enables copy button when workflow inputs are loaded', async () => {
    mockWorkflowParamsResponse({
      benchmark: 'swebench',
      sdk_ref: 'main',
      eval_limit: '1',
    })

    render(<CopyCommandButton sdkWorkflowRunId="23664774188" />)

    await waitFor(() => {
      const copyButton = screen.getByTitle('Copy gh workflow run command')
      expect(copyButton).toBeTruthy()
      expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('copies gh command with parameters from workflow logs', async () => {
    mockWorkflowParamsResponse({
      benchmark: 'swebench',
      sdk_ref: 'main',
      allow_unreleased_branches: 'true',
      eval_limit: '1',
      model_ids: 'minimax-m2.5',
    })

    render(<CopyCommandButton sdkWorkflowRunId="23664774188" />)

    await waitFor(() => {
      const copyButton = screen.getByTitle('Copy gh workflow run command')
      expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    })

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call).toContain('gh workflow run run-eval.yml')
      expect(call).toContain('--repo OpenHands/software-agent-sdk')
      expect(call).toContain('-f benchmark="swebench"')
      expect(call).toContain('-f sdk_ref="main"')
      expect(call).toContain('-f allow_unreleased_branches="true"')
      expect(call).toContain('-f eval_limit="1"')
      expect(call).toContain('-f model_ids="minimax-m2.5"')
    })
  })

  it('shows Copied! feedback after copying', async () => {
    mockWorkflowParamsResponse({ benchmark: 'swebench' })
    render(<CopyCommandButton sdkWorkflowRunId="12345" />)

    await waitFor(() => {
      const copyButton = screen.getByTitle('Copy gh workflow run command')
      expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    })

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy()
    })
  })

  it('receives filtered parameters from API (N/A and (default) excluded)', async () => {
    // Server-side already filters out N/A and (default) values
    mockWorkflowParamsResponse({
      benchmark: 'swebench',
      sdk_ref: 'main',
      eval_limit: '1',
      // instance_ids and num_infer_workers are already filtered by the API
    })

    render(<CopyCommandButton sdkWorkflowRunId="12345" />)

    await waitFor(() => {
      const copyButton = screen.getByTitle('Copy gh workflow run command')
      expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    })

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call).toContain('-f benchmark="swebench"')
      expect(call).toContain('-f sdk_ref="main"')
      expect(call).toContain('-f eval_limit="1"')
      expect(call).not.toContain('instance_ids')
      expect(call).not.toContain('num_infer_workers')
    })
  })

  it('handles API errors gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    render(<CopyCommandButton sdkWorkflowRunId="12345" />)

    // Button should remain disabled
    await waitFor(() => {
      const copyButton = screen.getByTitle('No workflow inputs found in parameters')
      expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
