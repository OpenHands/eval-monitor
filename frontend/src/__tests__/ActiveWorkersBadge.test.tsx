import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ActiveWorkersBadge from '../components/ActiveWorkersBadge'
import type { RunListItem, RunMetadata } from '../api'

describe('ActiveWorkersBadge', () => {
  // Helper to create metadata with specific worker params
  const createMetadata = (overrides: Partial<RunMetadata['params']> = {}): RunMetadata => ({
    init: null,
    params: overrides as RunMetadata['params'],
    error: null,
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
    cancelEval: null,
  })

  // Helper to create a run item
  const createRun = (slug: string, triggeredBy: string, status: RunListItem['status'] = 'running-infer'): RunListItem => ({
    slug,
    status,
    triggeredBy,
  })

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('total count calculation', () => {
    it('shows pulsing placeholder when runs and metadata are empty (loading state)', () => {
      const { container } = render(
        <ActiveWorkersBadge runMetadataMap={{}} runs={[]} />
      )
      // Should show pulsing dot with "Active workers" label
      expect(screen.getByText('Active workers')).toBeTruthy()
      const dot = container.querySelector('.animate-pulse')
      expect(dot).toHaveClass('bg-oh-text-muted')
    })

    it('shows zero workers when no runs are active', () => {
      const completedRuns = [
        createRun('swebench/qwen/123', 'juanmichelini', 'completed'),
        createRun('gaia/claude/456', 'admin', 'error'),
      ]
      render(
        <ActiveWorkersBadge runMetadataMap={{}} runs={completedRuns} />
      )
      expect(screen.getByText('Active workers: 0')).toBeTruthy()
      // Should not be clickable when zero
      const badge = screen.getByText('Active workers: 0')
      expect(badge.closest('button')).toBeNull()
    })

    it('calculates total active workers from running-infer runs', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', 'admin', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 20 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      expect(screen.getByText('Active workers: 30')).toBeTruthy()
    })

    it('uses default 20 workers when metadata has no worker params', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({}),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      expect(screen.getByText('Active workers: 20')).toBeTruthy()
    })
  })

  describe('per-author breakdown', () => {
    it('groups workers by author (triggeredBy)', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', 'juanmichelini', 'running-infer'),
        createRun('swebench/gpt/789', 'admin', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 5 }),
        'swebench/gpt/789': createMetadata({ num_infer_workers: 15 }),
      }
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={true}
          onToggle={vi.fn()}
        />
      )
      
      // Badge should show total
      expect(screen.getByText('Active workers: 30')).toBeTruthy()
      
      // Modal should show per-author breakdown
      expect(screen.getByText('juanmichelini')).toBeTruthy()
      expect(screen.getByText('admin')).toBeTruthy()
    })

    it('shows correct worker counts per author', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', 'admin', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 12 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 8 }),
      }
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={true}
          onToggle={vi.fn()}
        />
      )
      
      // Modal should show the counts
      expect(screen.getByText('12 workers')).toBeTruthy()
      expect(screen.getByText('8 workers')).toBeTruthy()
    })

    it('ignores runs with triggeredBy "—" in per-author breakdown but includes in total', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', '—', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 20 }),
      }
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={true}
          onToggle={vi.fn()}
        />
      )
      
      // Total includes both: 10 + 20 = 30
      expect(screen.getByText('Active workers: 30')).toBeTruthy()
      
      // But modal only shows juanmichelini (not "—")
      expect(screen.getByText('juanmichelini')).toBeTruthy()
      expect(screen.getByText('10 workers')).toBeTruthy()
    })
  })

  describe('worker calculation from metadata', () => {
    it('uses num_infer_workers when present', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 50 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      expect(screen.getByText('Active workers: 50')).toBeTruthy()
    })

    it('falls back to eval_limit capped at 20 when num_infer_workers is missing', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ eval_limit: 30 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      // eval_limit capped at 20
      expect(screen.getByText('Active workers: 20')).toBeTruthy()
    })

    it('uses eval_limit when below 20', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ eval_limit: 8 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      expect(screen.getByText('Active workers: 8')).toBeTruthy()
    })

    it('defaults to 20 when no params are set', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({}),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      expect(screen.getByText('Active workers: 20')).toBeTruthy()
    })

    it('handles params as strings (from JSON)', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ 
          num_infer_workers: '15' as unknown as number,
          eval_limit: '10' as unknown as number,
        }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      // num_infer_workers should take precedence
      expect(screen.getByText('Active workers: 15')).toBeTruthy()
    })
  })

  describe('color threshold logic', () => {
    it('shows green (primary) for < 240 workers', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 100 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      
      // Find the dot by its size class (w-2 h-2)
      const dot = screen.getByText('Active workers: 100').previousElementSibling
      expect(dot).toHaveClass('bg-oh-primary')
    })

    it('shows orange for 240-256 workers', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', 'admin', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 250 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 6 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      
      const dot = screen.getByText('Active workers: 256').previousElementSibling
      expect(dot).toHaveClass('bg-orange-400')
    })

    it('shows red for > 256 workers', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', 'admin', 'running-infer'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 200 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 100 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      
      const dot = screen.getByText('Active workers: 300').previousElementSibling
      expect(dot).toHaveClass('bg-oh-error')
    })

    it('shows exactly 240 as orange', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 240 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      
      const dot = screen.getByText('Active workers: 240').previousElementSibling
      expect(dot).toHaveClass('bg-orange-400')
    })

    it('shows exactly 256 as orange', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 256 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      
      const dot = screen.getByText('Active workers: 256').previousElementSibling
      expect(dot).toHaveClass('bg-orange-400')
    })

    it('shows 257 as red', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 257 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      
      const dot = screen.getByText('Active workers: 257').previousElementSibling
      expect(dot).toHaveClass('bg-oh-error')
    })
  })

  describe('visibility conditions', () => {
    it('only counts runs with status running-infer', () => {
      const runs = [
        createRun('swebench/qwen/123', 'juanmichelini', 'running-infer'),
        createRun('gaia/claude/456', 'admin', 'building'),
        createRun('swebench/gpt/789', 'other', 'pending'),
        createRun('bench/other/111', 'third', 'completed'),
      ]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 25 }),
        'gaia/claude/456': createMetadata({ num_infer_workers: 30 }),
        'swebench/gpt/789': createMetadata({ num_infer_workers: 35 }),
        'bench/other/111': createMetadata({ num_infer_workers: 40 }),
      }
      render(<ActiveWorkersBadge runMetadataMap={metadataMap} runs={runs} />)
      // Only the running-infer run should count
      expect(screen.getByText('Active workers: 25')).toBeTruthy()
    })

    it('is clickable when there are active workers', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini', 'running-infer')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
      }
      const onToggle = vi.fn()
      
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={false}
          onToggle={onToggle}
        />
      )
      
      const badge = screen.getByText('Active workers: 10')
      fireEvent.click(badge)
      expect(onToggle).toHaveBeenCalledWith(true)
    })

    it('does not call onToggle when zero workers', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini', 'completed')]
      const onToggle = vi.fn()
      
      render(
        <ActiveWorkersBadge 
          runMetadataMap={{}} 
          runs={runs} 
          isOpen={false}
          onToggle={onToggle}
        />
      )
      
      const badge = screen.getByText('Active workers: 0')
      fireEvent.click(badge)
      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('modal behavior', () => {
    it('does not render modal when isOpen is false', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini', 'running-infer')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
      }
      
      const { queryByText } = render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={false}
          onToggle={vi.fn()}
        />
      )
      
      // Modal title should not be present
      expect(queryByText('Active Workers')).toBeNull()
    })

    it('renders modal when isOpen is true', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini', 'running-infer')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
      }
      
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={true}
          onToggle={vi.fn()}
        />
      )
      
      // Modal title should be present
      expect(screen.getByText('Active Workers')).toBeTruthy()
    })

    it('calls onToggle(false) when modal close button is clicked', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini', 'running-infer')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
      }
      const onToggle = vi.fn()
      
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={true}
          onToggle={onToggle}
        />
      )
      
      const closeButton = screen.getByTitle('Close')
      fireEvent.click(closeButton)
      expect(onToggle).toHaveBeenCalledWith(false)
    })

    it('shows modal when badge is clicked', () => {
      const runs = [createRun('swebench/qwen/123', 'juanmichelini', 'running-infer')]
      const metadataMap = {
        'swebench/qwen/123': createMetadata({ num_infer_workers: 10 }),
      }
      const onToggle = vi.fn()
      
      render(
        <ActiveWorkersBadge 
          runMetadataMap={metadataMap} 
          runs={runs} 
          isOpen={true}
          onToggle={onToggle}
        />
      )
      
      // Modal should show author breakdown
      expect(screen.getByText('juanmichelini')).toBeTruthy()
      expect(screen.getByText('10 workers')).toBeTruthy()
    })
  })
})