import { useState } from 'react'

interface CopyCommandButtonProps {
  data: Record<string, unknown> | null | undefined
  className?: string
}

// Strip refs/heads/ prefix from branch names
function stripRefsPrefix(branch: string): string {
  return branch.replace(/^refs\/heads\//, '')
}

// Convert value to string, N/A or null/undefined becomes ""
function valueToString(value: unknown): string {
  if (value === null || value === undefined || value === 'N/A') {
    return ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

function extractWorkflowInputs(data: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {}

  // benchmark
  params['benchmark'] = valueToString(data.benchmark)

  // sdk_ref (value from sdk_commit field)
  params['sdk_ref'] = valueToString(data.sdk_commit)

  // allow_unreleased_branches (always true)
  params['allow_unreleased_branches'] = 'true'

  // eval_limit
  params['eval_limit'] = valueToString(data.eval_limit)

  // model_ids (must exist in params, don't extract from model_name)
  params['model_ids'] = valueToString(data.model_id)

  // reason (from trigger_reason)
  params['reason'] = valueToString(data.trigger_reason)

  // eval_branch (from evaluation_branch, strip refs/heads/)
  if (data.evaluation_branch && typeof data.evaluation_branch === 'string') {
    params['eval_branch'] = stripRefsPrefix(data.evaluation_branch)
  } else {
    params['eval_branch'] = ''
  }

  // benchmarks_branch
  if (data.benchmarks_branch && typeof data.benchmarks_branch === 'string') {
    params['benchmarks_branch'] = stripRefsPrefix(data.benchmarks_branch)
  } else {
    params['benchmarks_branch'] = ''
  }

  // extensions_branch (strip refs/heads/)
  if (data.extensions_branch && typeof data.extensions_branch === 'string') {
    params['extensions_branch'] = stripRefsPrefix(data.extensions_branch)
  } else {
    params['extensions_branch'] = ''
  }

  // instance_ids
  params['instance_ids'] = valueToString(data.instance_ids)

  // num_infer_workers
  params['num_infer_workers'] = valueToString(data.num_infer_workers)

  // num_eval_workers
  params['num_eval_workers'] = valueToString(data.num_eval_workers)

  // enable_conversation_event_logging (use data value or default to true)
  const eventLoggingValue = valueToString(data.enable_conversation_event_logging)
  params['enable_conversation_event_logging'] = eventLoggingValue || 'true'

  // max_retries (use data value or default to 3)
  const maxRetriesValue = valueToString(data.max_retries)
  params['max_retries'] = maxRetriesValue || '3'

  // tool_preset (use data value or default to 'default')
  const toolPresetValue = valueToString(data.tool_preset)
  params['tool_preset'] = toolPresetValue || 'default'

  // agent_type
  params['agent_type'] = valueToString(data.agent_type)

  // partial_archive_url
  params['partial_archive_url'] = valueToString(data.partial_archive_url)

  return params
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

  // Don't render if no data or no model_id (older runs don't have model_id)
  if (!data || !data.model_id) {
    return null
  }

  const workflowParams = extractWorkflowInputs(data)

  const handleCopyCommand = async () => {
    const command = generateGhCommand(workflowParams)
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopyCommand}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors bg-oh-primary/10 hover:bg-oh-primary/20 text-oh-primary border-oh-primary/30 cursor-pointer ${className}`}
      title="Copy gh workflow run command"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
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
