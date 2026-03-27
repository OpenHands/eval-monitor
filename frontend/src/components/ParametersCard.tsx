import { useState } from 'react'
import { formatValue } from './JsonCard'
import SectionMenu from './SectionMenu'

interface ParametersCardProps {
  data: Record<string, unknown> | null | undefined
}

// Map params.json keys to workflow input names
const PARAM_MAPPING: Record<string, string> = {
  'benchmark': 'benchmark',
  'sdk_ref': 'sdk_ref',
  'sdk_commit': 'sdk_ref',
  'allow_unreleased_branches': 'allow_unreleased_branches',
  'eval_limit': 'eval_limit',
  'model_ids': 'model_ids',
  'reason': 'reason',
  'eval_branch': 'eval_branch',
  'evaluation_branch': 'eval_branch',
  'benchmarks_branch': 'benchmarks_branch',
  'instance_ids': 'instance_ids',
  'num_infer_workers': 'num_infer_workers',
  'num_eval_workers': 'num_eval_workers',
  'enable_conversation_event_logging': 'enable_conversation_event_logging',
  'max_retries': 'max_retries',
  'tool_preset': 'tool_preset',
  'agent_type': 'agent_type',
  'partial_archive_url': 'partial_archive_url',
}

function generateGhCommand(params: Record<string, unknown>): string {
  const parts = [
    'gh workflow run run-eval.yml',
    '--repo OpenHands/software-agent-sdk',
  ]

  // Process each parameter
  for (const [paramsKey, value] of Object.entries(params)) {
    const workflowInputName = PARAM_MAPPING[paramsKey]
    if (!workflowInputName || value === null || value === undefined) continue

    let valueStr = String(value)
    
    // Strip 'refs/heads/' prefix from branch names
    if (paramsKey.includes('branch') && valueStr.startsWith('refs/heads/')) {
      valueStr = valueStr.slice('refs/heads/'.length)
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      valueStr = value ? 'true' : 'false'
    }

    // Add the parameter to the command
    parts.push(`-f ${workflowInputName}="${valueStr}"`)
  }

  return parts.join(' \\\n  ')
}

export default function ParametersCard({ data }: ParametersCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCommand = async () => {
    if (!data) return

    const command = generateGhCommand(data)
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-oh-primary/10 hover:bg-oh-primary/20 text-oh-primary border border-oh-primary/30 transition-colors cursor-pointer"
            title="Copy gh workflow run command"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
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
