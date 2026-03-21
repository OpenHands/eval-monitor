import SectionMenu from './SectionMenu'

interface JsonCardProps {
  title: string
  data: Record<string, unknown> | null | undefined
  icon: string
  isError?: boolean
}

export default function JsonCard({ title, data, icon, isError }: JsonCardProps) {
  const sectionId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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
                  {formatValue(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
