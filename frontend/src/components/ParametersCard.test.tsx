import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ParametersCard from './ParametersCard'

describe('ParametersCard', () => {
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

  const mockWorkflowResponse = (params: Record<string, string>) => {
    const paramsText = Object.entries(params)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    const logs = `
Some log output before
=== Input Parameters ===
${paramsText}
=== End ===
Some log output after
`

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            { id: 123, name: 'print-parameters' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => logs,
      })
  }

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

  it('button is disabled when no sdk_workflow_run_id', () => {
    const data = { benchmark: 'swebench' }
    render(<ParametersCard data={data} />)

    const copyButton = screen.getByTitle('Workflow run ID not available')
    expect(copyButton).toBeTruthy()
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('fetches workflow params and enables copy button', async () => {
    mockWorkflowResponse({
      benchmark: 'swebench',
      sdk_ref: 'main',
      eval_limit: '1',
    })

    const data = {
      sdk_workflow_run_id: '23664774188',
      benchmark: 'swebench',
    }
    render(<ParametersCard data={data} />)

    // Initially shows loading
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeTruthy()
    })

    // Then enables the button
    await waitFor(() => {
      const copyButton = screen.getByTitle('Copy gh workflow run command')
      expect(copyButton).toBeTruthy()
      expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('copies gh command from workflow params', async () => {
    mockWorkflowResponse({
      benchmark: 'swebench',
      sdk_ref: 'main',
      allow_unreleased_branches: 'true',
      eval_limit: '1',
      model_ids: 'minimax-m2.5',
    })

    const data = {
      sdk_workflow_run_id: '23664774188',
      benchmark: 'swebench',
    }
    render(<ParametersCard data={data} />)

    // Wait for workflow params to load
    await waitFor(() => {
      const copyButton = screen.getByTitle('Copy gh workflow run command')
      expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    })

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
        expect.stringContaining('-f sdk_ref="main"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f eval_limit="1"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('-f model_ids="minimax-m2.5"')
      )
    })
  })

  it('shows "Copied!" feedback after copying', async () => {
    mockWorkflowResponse({
      benchmark: 'swebench',
      sdk_ref: 'main',
    })

    const data = {
      sdk_workflow_run_id: '12345',
      benchmark: 'swebench',
    }
    render(<ParametersCard data={data} />)

    // Wait for params to load
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

  it('skips N/A and (default) values from workflow logs', async () => {
    const logsWithDefaults = `
=== Input Parameters ===
benchmark: swebench
sdk_ref: main
instance_ids: N/A
num_infer_workers: (default)
eval_limit: 1
=== End ===
`
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [{ id: 123, name: 'print-parameters' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => logsWithDefaults,
      })

    const data = {
      sdk_workflow_run_id: '12345',
      benchmark: 'swebench',
    }
    render(<ParametersCard data={data} />)

    // Wait for params to load
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
})
