import { useState, useEffect } from 'react'

interface CopyCommandButtonProps {
  data: Record<string, unknown> | null | undefined
  className?: string
}

// Workflow input parameter keys (from run-eval.yml)
const WORKFLOW_INPUT_KEYS = new Set([
  'benchmark',
  'sdk_ref',
  'allow_unreleased_branches',
  'eval_limit',
  'model_ids',
  'reason',
  'eval_branch',
  'benchmarks_branch',
  'instance_ids',
  'num_infer_workers',
  'num_eval_workers',
  'enable_conversation_event_logging',
  'max_retries',
  'tool_preset',
  'agent_type',
  'partial_archive_url',
])

// Extract model_ids from model_name (e.g. "litellm_proxy/minimax/MiniMax-M2.5" → "minimax-m2.5")
function extractModelIds(modelName: string): string {
  let cleaned = modelName.replace(/^litellm_proxy\//, '')
  const parts = cleaned.split('/')
  if (parts.length === 2) {
    const provider = parts[0]
    const modelPart = parts[1]
    if (modelPart.toLowerCase().startsWith(provider.toLowerCase() + '-')) {
      const model = modelPart.substring(provider.length + 1)
      return `${provider}-${model}`.toLowerCase()
    }
    return `${provider}-${modelPart}`.toLowerCase()
  }
  return modelName.toLowerCase()
}

// Strip refs/heads/ prefix from branch names
function stripRefsPrefix(branch: string): string {
  return branch.replace(/^refs\/heads\//, '')
}

async function fetchSdkRef(runId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/OpenHands/software-agent-sdk/actions/runs/${runId}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.head_branch || null
  } catch (error) {
    console.error('[CopyCommandButton] Failed to fetch SDK ref:', error)
    return null
  }
}

async function extractWorkflowInputs(data: Record<string, unknown>): Promise<Record<string, string>> {
  const inputs: Record<string, string> = {}
  
  // Fetch sdk_ref from the workflow run if we have the run ID
  const runId = data.sdk_workflow_run_id as string | undefined
  if (runId) {
    const sdkRef = await fetchSdkRef(runId)
    if (sdkRef) {
      inputs['sdk_ref'] = sdkRef
    }
  }
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    
    if (key === 'model_name' && typeof value === 'string') {
      inputs['model_ids'] = extractModelIds(value)
      continue
    }
    
    if (key === 'trigger_reason' && typeof value === 'string') {
      inputs['reason'] = value
      continue
    }
    
    if (key === 'evaluation_branch' && typeof value === 'string') {
      inputs['eval_branch'] = stripRefsPrefix(value)
      continue
    }
    
    if (!WORKFLOW_INPUT_KEYS.has(key)) continue
    
    let valueStr: string
    if (typeof value === 'boolean') {
      valueStr = value ? 'true' : 'false'
    } else if (typeof value === 'object') {
      continue
    } else {
      valueStr = String(value)
      // Convert "N/A" to empty string
      if (valueStr === 'N/A') {
        valueStr = ''
      }
    }
    
    inputs[key] = valueStr
  }
  
  return inputs
}

function generateGhCommand(params: Record<string, string>): string {
  const parts = [
    'gh workflow run run-eval.yml',
    '--repo OpenHands/software-agent-sdk',
  ]

  for (const [key, value] of Object.entries(params)) {
    parts.push(`-f ${key}="${value}"`)
  }

  return parts.join(' \\\n  ')
}

export default function CopyCommandButton({ data, className = '' }: CopyCommandButtonProps) {
  const [copied, setCopied] = useState(false)
  const [workflowParams, setWorkflowParams] = useState<Record<string, string> | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadWorkflowInputs = async () => {
      if (!data) {
        setWorkflowParams(null)
        return
      }
      
      setLoading(true)
      const inputs = await extractWorkflowInputs(data)
      setWorkflowParams(Object.keys(inputs).length > 0 ? inputs : null)
      setLoading(false)
    }
    
    loadWorkflowInputs()
  }, [data])

  const handleCopyCommand = async () => {
    if (!workflowParams) return

    const command = generateGhCommand(workflowParams)
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopyCommand}
      disabled={!workflowParams || loading}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        workflowParams && !loading
          ? 'bg-oh-primary/10 hover:bg-oh-primary/20 text-oh-primary border-oh-primary/30 cursor-pointer'
          : 'bg-oh-surface text-oh-text-muted border-oh-border cursor-not-allowed opacity-50'
      } ${className}`}
      title={
        loading
          ? 'Loading workflow parameters...'
          : workflowParams
          ? 'Copy gh workflow run command'
          : 'No workflow inputs found in parameters'
      }
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : loading ? (
        <>
          <svg className="w-3 h-3 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </>
      ) : (
        <>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy command
        </>
      )}
    </button>
  )
}
