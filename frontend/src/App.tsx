import { useState, useEffect, useCallback } from 'react'
import { fetchMultiDayRunList, fetchRunMetadata, parseRunSlug, getStageStatus } from './api'
import type { RunMetadata, DayRunGroup } from './api'
import RunListView from './components/RunListView'
import RunDetailView from './components/RunDetailView'
import Header from './components/Header'

function getTodayUTC(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

export function parseSearchParams(search: string, defaultDate: string): { date: string; run: string | null; numDays: number } {
  const params = new URLSearchParams(search)
  const date = params.get('date') || defaultDate
  const run = params.get('run') || null
  const numDaysParam = parseInt(params.get('days') || '2', 10)
  const numDays = numDaysParam >= 1 && numDaysParam <= 7 ? numDaysParam : 2
  return { date, run, numDays }
}

export function buildSearchString(date: string, run: string | null, todayDate: string, numDays: number = 2): string {
  const params = new URLSearchParams()
  if (date !== todayDate) {
    params.set('date', date)
  }
  if (run) {
    params.set('run', run)
  }
  if (numDays !== 2) {
    params.set('days', String(numDays))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function parseUrlState(): { date: string; run: string | null; numDays: number } {
  return parseSearchParams(window.location.search, getTodayUTC())
}

function buildUrl(date: string, run: string | null, numDays: number): string {
  const qs = buildSearchString(date, run, getTodayUTC(), numDays)
  return qs || window.location.pathname
}

export default function App() {
  const [date, setDate] = useState(() => parseUrlState().date)
  const [numDays, setNumDays] = useState(() => parseUrlState().numDays)
  const [runs, setRuns] = useState<string[]>([])
  const [dayGroups, setDayGroups] = useState<DayRunGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(() => parseUrlState().run)
  const [runMetadata, setRunMetadata] = useState<RunMetadata | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(false)

  // Metadata map for all runs (used by the list view for status)
  const [runMetadataMap, setRunMetadataMap] = useState<Record<string, RunMetadata>>({})
  const [loadingMetadataList, setLoadingMetadataList] = useState(false)

  // Sync URL when date, selectedRun, or numDays changes (skip on initial mount)
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      return
    }
    const url = buildUrl(date, selectedRun, numDays)
    window.history.pushState({ date, run: selectedRun, numDays }, '', url)
  }, [date, selectedRun, numDays]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrlState()
      setDate(state.date)
      setSelectedRun(state.run)
      setNumDays(state.numDays)
      if (!state.run) {
        setRunMetadata(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRunMetadataMap({})
    try {
      const groups = await fetchMultiDayRunList(date, numDays)
      setDayGroups(groups)
      const allRuns = groups.flatMap(g => g.runs)
      setRuns(allRuns)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
      setRuns([])
      setDayGroups([])
    } finally {
      setLoading(false)
    }
  }, [date, numDays])

  // Fetch metadata for all runs to show status in the list
  const loadAllMetadata = useCallback(async (runSlugs: string[]) => {
    if (runSlugs.length === 0) return
    setLoadingMetadataList(true)
    const batchSize = 10
    for (let i = 0; i < runSlugs.length; i += batchSize) {
      const batch = runSlugs.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async slug => {
          try {
            const metadata = await fetchRunMetadata(slug)
            return { slug, metadata }
          } catch {
            return { slug, metadata: null }
          }
        })
      )
      const batchMap: Record<string, RunMetadata> = {}
      results.forEach(({ slug, metadata }) => {
        if (metadata) batchMap[slug] = metadata
      })
      setRunMetadataMap(prev => ({ ...prev, ...batchMap }))
    }
    setLoadingMetadataList(false)
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  // When runs are loaded, fetch all their metadata
  useEffect(() => {
    if (runs.length > 0 && !selectedRun) {
      loadAllMetadata(runs)
    }
  }, [runs, selectedRun, loadAllMetadata])

  // If we have a run from URL but haven't loaded its metadata yet, fetch it
  useEffect(() => {
    if (selectedRun && !runMetadata && !loadingMetadata) {
      setLoadingMetadata(true)
      const cached = runMetadataMap[selectedRun]
      if (cached) {
        setRunMetadata(cached)
        setLoadingMetadata(false)
      } else {
        fetchRunMetadata(selectedRun)
          .then(metadata => setRunMetadata(metadata))
          .catch(() => setRunMetadata(null))
          .finally(() => setLoadingMetadata(false))
      }
    }
  }, [selectedRun]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectRun = async (slug: string) => {
    setSelectedRun(slug)
    setLoadingMetadata(true)
    // Use cached metadata if available
    const cached = runMetadataMap[slug]
    if (cached) {
      setRunMetadata(cached)
      setLoadingMetadata(false)
    } else {
      setRunMetadata(null)
      try {
        const metadata = await fetchRunMetadata(slug)
        setRunMetadata(metadata)
      } catch {
        setRunMetadata(null)
      } finally {
        setLoadingMetadata(false)
      }
    }
  }

  const handleBack = () => {
    setSelectedRun(null)
    setRunMetadata(null)
  }

  const handleRefresh = () => {
    if (selectedRun) {
      handleSelectRun(selectedRun)
    } else {
      loadRuns()
    }
  }

  const runSummaries = runs.map(slug => {
    const parsed = parseRunSlug(slug)
    return { slug, ...parsed }
  })

  return (
    <div className="min-h-screen bg-oh-bg">
      <Header
        date={date}
        onDateChange={setDate}
        onRefresh={handleRefresh}
        selectedRun={selectedRun}
        onBack={handleBack}
        numDays={numDays}
        onNumDaysChange={setNumDays}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedRun ? (
          <RunDetailView
            slug={selectedRun}
            metadata={runMetadata}
            loading={loadingMetadata}
            status={runMetadata ? getStageStatus(runMetadata) : 'pending'}
          />
        ) : (
          <RunListView
            runs={runSummaries}
            loading={loading}
            error={error}
            onSelectRun={handleSelectRun}
            runMetadataMap={runMetadataMap}
            loadingMetadataList={loadingMetadataList}
            dayGroups={dayGroups}
          />
        )}
      </main>
    </div>
  )
}
