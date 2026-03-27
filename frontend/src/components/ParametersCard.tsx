import { useState, useEffect } from 'react'
import { formatValue } from './JsonCard'
import SectionMenu from './SectionMenu'

interface ParametersCardProps {
  data: Record<string, unknown> | null | undefined
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
  // Remove litellm_proxy/ prefix if present
  let cleaned = modelName.replace(/^litellm_proxy\//, '')
  // For the pattern "provider/Provider-Model", we want "provider-model"
  const parts = cleaned.split('/')
  if (parts.length === 2) {
    // parts[0] is provider (already lowercase)
    // parts[1] is Provider-Model, we need to extract just the model part
    const provider = parts[0]
    const modelPart = parts[1]
    // Check if modelPart starts with the provider name (case-insensitive) followed by dash
    if (modelPart.toLowerCase().startsWith(provider.toLowerCase() + '-')) {
      // Remove the provider prefix (keep original casing of the model part)
      const model = modelPart.substring(provider.length + 1)
      return `${provider}-${model}`.toLowerCase()
    }
    // Fallback: just join with dash and lowercase
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
    console.error('[ParametersCard] Failed to fetch SDK ref:', error)
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
    // Skip null/undefined values
    if (value === null || value === undefined) continue
    
    // Handle special transformations
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
    
    // Check if this is a direct workflow input key
    if (!WORKFLOW_INPUT_KEYS.has(key)) continue
    
    // Convert value to string
    let valueStr: string
    if (typeof value === 'boolean') {
      valueStr = value ? 'true' : 'false'
    } else if (typeof value === 'object') {
      continue // Skip complex objects
    } else {
      valueStr = String(value)
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

  // Output each parameter
  for (const [key, value] of Object.entries(params)) {
    parts.push(`-f ${key}="${value}"`)
  }

  return parts.join(' \\\n  ')
}

export default function ParametersCard({ data }: ParametersCardProps) {
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

  if (data === null || data === undefined) {
    return (
      <div id="parameters" className="bg-oh-surface border border-oh-border rounded-lg p-4 opacity-50 scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <h3 className="text-sm font-medium text-oh-text-muted">Parameters</h3>
          </div>
          <SectionMenu id="parameters" />
        </div>
        <p className="text-xs text-oh-text-muted italic">Not available yet</p>
      </div>
    )
  }

  const sectionId = 'parameters'

  return (
    <div id={sectionId} className="bg-oh-surface border border-oh-border rounded-lg p-4 scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>⚙️</span>
          <h3 className="text-sm font-medium text-oh-text">Parameters</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCommand}
            disabled={!workflowParams || loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              workflowParams && !loading
                ? 'bg-oh-primary/10 hover:bg-oh-primary/20 text-oh-primary border-oh-primary/30 cursor-pointer'
                : 'bg-oh-surface text-oh-text-muted border-oh-border cursor-not-allowed opacity-50'
            }`}
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
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : loading ? (
              <>
                <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy command
              </>
            )}
          </button>
          <SectionMenu id={sectionId} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="border-b border-oh-border/50 last:border-0">
                <td className="py-1.5 pr-4 text-oh-text-muted font-mono text-xs whitespace-nowrap align-top">
                  {key}
                </td>
                <td className="py-1.5 text-oh-text font-mono text-xs break-all">
                  {formatValue(key, value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
