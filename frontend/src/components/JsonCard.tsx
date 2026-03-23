import type { ReactNode } from 'react'

import SectionMenu from './SectionMenu'

interface JsonCardProps {
  title: string
  data: Record<string, unknown> | null | undefined
  icon: string
  isError?: boolean
}

const SDK_COMMIT_BASE_URL = 'https://github.com/OpenHands/software-agent-sdk/commit/'
const EVAL_BRANCH_BASE_URL = 'https://github.com/OpenHands/evaluation/tree/'
const BENCHMARKS_BRANCH_BASE_URL = 'https://github.com/OpenHands/benchmarks/tree/'
const BENCHMARKS_ACTIONS_BASE_URL = 'https://github.com/OpenHands/benchmarks/actions'

const SHA_RE = /^[0-9a-f]{7,40}$/i
const GIT_REFS_HEADS_PREFIX = 'refs/heads/'
const URL_RE = /https?:\/\/[^\s<>"']+|[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}\/[^\s<>"']*/

function findFirstUrl(text: string): { url: string; href: string; start: number; end: number } | null {
  const m = URL_RE.exec(text)
  if (!m) return null
  const url = m[0].replace(/[.,;:!?)\]>]+$/, '')
  const href = /^https?:\/\//.test(url) ? url : `https://${url}`
  return { url, href, start: m.index, end: m.index + url.length }
}

export default function JsonCard({ title, data, icon, isError }: JsonCardProps) {
  const sectionId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  if (data === null || data === undefined) {
    return (
      <div id={sectionId} className="bg-oh-surface border border-oh-border rounded-lg p-4 opacity-50 scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span>{icon}</span>
            <h3 className="text-sm font-medium text-oh-text-muted">{title}</h3>
          </div>
          <SectionMenu id={sectionId} />
        </div>
        <p className="text-xs text-oh-text-muted italic">Not available yet</p>
      </div>
    )
  }

  const borderClass = isError ? 'border-oh-error/50' : 'border-oh-border'
  const bgClass = isError ? 'bg-oh-error/5' : 'bg-oh-surface'

  return (
    <div id={sectionId} className={`${bgClass} border ${borderClass} rounded-lg p-4 scroll-mt-24`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <h3 className="text-sm font-medium text-oh-text">{title}</h3>
        </div>
        <SectionMenu id={sectionId} />
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

function formatValue(key: string, value: unknown): ReactNode {
  if (value === null) return 'null'
  if (value === undefined) return '—'

  const link = getLinkForKeyValue(key, value)
  if (link) {
    return (
      <a className="text-oh-primary hover:underline" href={link.href} target="_blank" rel="noreferrer">
        {link.text}
      </a>
    )
  }

  if (typeof value === 'object') return JSON.stringify(value, null, 2)

  if (typeof value === 'string') {
    const urlMatch = findFirstUrl(value)
    if (urlMatch) {
      return (
        <>
          {value.slice(0, urlMatch.start)}
          <a className="text-oh-primary hover:underline" href={urlMatch.href} target="_blank" rel="noreferrer">
            {urlMatch.url}
          </a>
          {value.slice(urlMatch.end)}
        </>
      )
    }
  }

  return String(value)
}

function stripRefsHeads(branch: string): string {
  return branch.startsWith(GIT_REFS_HEADS_PREFIX) ? branch.slice(GIT_REFS_HEADS_PREFIX.length) : branch
}

function getLinkForKeyValue(key: string, value: unknown): { href: string; text: string } | null {
  if (typeof value !== 'string' || value.trim() === '') return null

  const keyLower = key.toLowerCase()

  if (keyLower.includes('sdk_commit') && SHA_RE.test(value)) {
    return { href: `${SDK_COMMIT_BASE_URL}${value}`, text: value }
  }

  if (keyLower.includes('evaluation_branch') || keyLower.includes('eval_branch')) {
    const branch = stripRefsHeads(value)
    if (!branch) return null
    return { href: `${EVAL_BRANCH_BASE_URL}${branch}`, text: branch }
  }

  if (keyLower.includes('benchmarks_branch')) {
    const branch = stripRefsHeads(value)
    if (!branch) return null
    return { href: `${BENCHMARKS_BRANCH_BASE_URL}${branch}`, text: branch }
  }

  if (keyLower.includes('build_action') && value.startsWith('dispatch-')) {
    return { href: `${BENCHMARKS_ACTIONS_BASE_URL}?query=${encodeURIComponent('branch:' + value)}`, text: value }
  }

  return null
}
