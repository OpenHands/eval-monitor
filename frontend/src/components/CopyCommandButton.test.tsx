import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CopyCommandButton from './CopyCommandButton'

describe('CopyCommandButton', () => {
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

  it('does not render when no data', () => {
    const { container } = render(<CopyCommandButton data={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when no model_id (older runs)', () => {
    const data = {
      benchmark: 'swebench',
      eval_limit: '1',
      model_name: 'litellm_proxy/claude-sonnet-4-5-20250929',
      // no model_id field
    }
    const { container } = render(<CopyCommandButton data={data} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders copy button with data and model_id', () => {
    const data = {
      benchmark: 'swebench',
      eval_limit: '1',
      model_id: 'claude-sonnet-4-5-20250929',
    }
    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    expect(copyButton).toBeTruthy()
    expect((copyButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('copies gh command with all parameters', () => {
    const data = {
      benchmark: 'swebench',
      eval_limit: '1',
      model_id: 'minimax-m2.5',
      trigger_reason: 'test eval-job-id',
      evaluation_branch: 'refs/heads/main',
      benchmarks_branch: 'main',
      instance_ids: null,
      num_infer_workers: null,
      num_eval_workers: null,
      agent_type: 'default',
      partial_archive_url: null,
    }

    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('gh workflow run run-eval.yml')
    expect(call).toContain('--repo OpenHands/software-agent-sdk')
    expect(call).toContain('-f benchmark="swebench"')
    expect(call).toContain('-f sdk_ref=""')
    expect(call).toContain('-f allow_unreleased_branches="true"')
    expect(call).toContain('-f eval_limit="1"')
    expect(call).toContain('-f model_id="minimax-m2.5"')
    expect(call).toContain('-f reason="test eval-job-id"')
    expect(call).toContain('-f eval_branch="main"')
    expect(call).toContain('-f benchmarks_branch="main"')
    expect(call).toContain('-f instance_ids=""')
    expect(call).toContain('-f enable_conversation_event_logging="true"')
    expect(call).toContain('-f max_retries="3"')
    expect(call).toContain('-f tool_preset="default"')
    expect(call).toContain('-f agent_type="default"')
  })

  it('shows Copied! feedback after copying', async () => {
    const data = { benchmark: 'swebench', model_id: 'claude-sonnet-4' }
    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy()
    })
  })

  it('converts N/A to empty string', () => {
    const data = {
      benchmark: 'swebench',
      model_id: 'claude-sonnet-4',
      instance_ids: 'N/A',
      num_infer_workers: 'N/A',
    }

    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f instance_ids=""')
    expect(call).toContain('-f num_infer_workers=""')
  })

  it('uses model_id directly from params', () => {
    const data = {
      benchmark: 'swebench',
      model_id: 'claude-sonnet-4-5-20250929',
    }

    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f model_id="claude-sonnet-4-5-20250929"')
  })

  it('strips refs/heads/ from branches', () => {
    const data = {
      benchmark: 'swebench',
      model_id: 'claude-sonnet-4',
      evaluation_branch: 'refs/heads/feature-branch',
      benchmarks_branch: 'refs/heads/main',
    }

    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f eval_branch="feature-branch"')
    expect(call).toContain('-f benchmarks_branch="main"')
    expect(call).not.toContain('refs/heads')
  })

  it('uses sdk_commit value for sdk_ref parameter', () => {
    const data = {
      benchmark: 'swebench',
      model_id: 'claude-sonnet-4',
      sdk_commit: 'abc123def456',
    }

    render(<CopyCommandButton data={data} />)

    const copyButton = screen.getByTitle('Copy gh workflow run command')
    fireEvent.click(copyButton)

    const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toContain('-f sdk_ref="abc123def456"')
  })
})
