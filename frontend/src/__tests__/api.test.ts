import { describe, it, expect } from 'vitest'
import { getStageStatuses } from '../api'
import type { RunMetadata } from '../api'

function makeMetadata(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    init: null,
    params: null,
    error: null,
    runInferStart: null,
    runInferEnd: null,
    evalInferStart: null,
    evalInferEnd: null,
    ...overrides,
  }
}

describe('getStageStatuses', () => {
  it('returns all pending when no metadata files exist', () => {
    const result = getStageStatuses(makeMetadata())
    expect(result).toEqual({
      init: 'pending',
      runInferStart: 'pending',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks init as active when only init exists', () => {
    const result = getStageStatuses(makeMetadata({ init: { timestamp: '2024-01-01' } }))
    expect(result).toEqual({
      init: 'active',
      runInferStart: 'pending',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks init as completed and runInferStart as active when both exist', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'active',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks through runInferEnd as active', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      runInferEnd: { timestamp: '2024-01-01' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'completed',
      runInferEnd: 'active',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks all as completed when all stages exist', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      runInferEnd: { timestamp: '2024-01-01' },
      evalInferStart: { timestamp: '2024-01-01' },
      evalInferEnd: { timestamp: '2024-01-01' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'completed',
      runInferEnd: 'completed',
      evalInferStart: 'completed',
      evalInferEnd: 'completed',
    })
  })

  it('marks the last active stage as error when error exists', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      error: { message: 'something failed' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'error',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })

  it('marks error on evalInferStart when error exists during eval', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      runInferStart: { timestamp: '2024-01-01' },
      runInferEnd: { timestamp: '2024-01-01' },
      evalInferStart: { timestamp: '2024-01-01' },
      error: { message: 'eval failed' },
    }))
    expect(result).toEqual({
      init: 'completed',
      runInferStart: 'completed',
      runInferEnd: 'completed',
      evalInferStart: 'error',
      evalInferEnd: 'pending',
    })
  })

  it('marks error on init when only init and error exist', () => {
    const result = getStageStatuses(makeMetadata({
      init: { timestamp: '2024-01-01' },
      error: { message: 'init failed' },
    }))
    expect(result).toEqual({
      init: 'error',
      runInferStart: 'pending',
      runInferEnd: 'pending',
      evalInferStart: 'pending',
      evalInferEnd: 'pending',
    })
  })
})
