import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchMultiDayRunList, fetchRunMetadata, parseRunSlug, getStageStatus } from './api'
import type { RunMetadata, DayRunGroup, RunListItem } from './api'
import RunListView from './components/RunListView'
import RunDetailView from './components/RunDetailView'
import Header from './components/Header'

function getTodayUTC(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

export function parseSearchParams(search: string, defaultDate: string): { date: string; run: string | null; numDays: number; filterBenchmark: string; filterStatus: string; filterText: string; clusterHealth: boolean; evalTime: boolean; activeWorkers: boolean } {
  const params = new URLSearchParams(search)
  const date = params.get('date') || defaultDate
  const run = params.get('run') || null
  const numDaysParam = parseInt(params.get('days') || '15', 10)
  const numDays = numDaysParam >= 1 && numDaysParam <= 90 ? numDaysParam : 15
  const filterBenchmark = params.get('benchmark') || 'all'
  const filterStatus = params.get('status') || 'all'
  const filterText = params.get('text') || ''
  const clusterHealth = params.get('clusterHealth') === 'true'
  const evalTime = params.get('evalTime') === 'true'
  const activeWorkers = params.get('activeWorkers') === 'true'
  return { date, run, numDays, filterBenchmark, filterStatus, filterText, clusterHealth, evalTime, activeWorkers }
}

export function buildSearchString(date: string, run: string | null, todayDate: string, numDays: number = 3, filterBenchmark: string = 'all', filterStatus: string = 'all', filterText: string = '', clusterHealth: boolean = false, evalTime: boolean = false, activeWorkers: boolean = false): string {
  const params = new URLSearchParams()
  if (date !== todayDate) {
    params.set('date', date)
  }
  if (run) {
    params.set('run', run)
  }
  if (numDays !== 3) {
    params.set('days', String(numDays))
  }
  if (filterBenchmark !== 'all') {
    params.set('benchmark', filterBenchmark)
  }
  if (filterStatus !== 'all') {
    params.set('status', filterStatus)
  }
  if (filterText) {
    params.set('text', filterText)
  }
  if (clusterHealth) {
    params.set('clusterHealth', 'true')
  }
  if (evalTime) {
    params.set('evalTime', 'true')
  }
  if (activeWorkers) {
    params.set('activeWorkers', 'true')
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function parseUrlState() {
  return parseSearchParams(window.location.search, getTodayUTC())
}

function buildUrl(date: string, run: string | null, numDays: number, filterBenchmark: string = 'all', filterStatus: string = 'all', filterText: string = '', clusterHealth: boolean = false, evalTime: boolean = false, activeWorkers: boolean = false): string {
  const qs = buildSearchString(date, run, getTodayUTC(), numDays, filterBenchmark, filterStatus, filterText, clusterHealth, evalTime, activeWorkers)
  return qs || window.location.pathname
}

export default function App() {
  const initialState = parseUrlState()
  const [date, setDate] = useState(initialState.date)
  const [numDays, setNumDays] = useState(initialState.numDays)
  const [filterBenchmark, setFilterBenchmark] = useState(initialState.filterBenchmark)
  const [filterStatus, setFilterStatus] = useState(initialState.filterStatus)
  const [filterText, setFilterText] = useState(initialState.filterText)
  const [clusterHealthOpen, setClusterHealthOpen] = useState(initialState.clusterHealth)
  const [evalTimeOpen, setEvalTimeOpen] = useState(initialState.evalTime)
  const [activeWorkersOpen, setActiveWorkersOpen] = useState(initialState.activeWorkers)

  const [runs, setRuns] = useState<RunListItem[]>([])
  const [dayGroups, setDayGroups] = useState<DayRunGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(initialState.run)
  const [runMetadata, setRunMetadata] = useState<RunMetadata | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  // Metadata map for all runs (used by the list view for status)
  const [runMetadataMap, setRunMetadataMap] = useState<Record<string, RunMetadata>>({})
  const [loadingMetadataList, setLoadingMetadataList] = useState(false)

  // Sync URL when state changes (skip on initial mount)
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      return
    }
    const url = buildUrl(date, selectedRun, numDays, filterBenchmark, filterStatus, filterText, clusterHealthOpen, evalTimeOpen, activeWorkersOpen)
    window.history.pushState({ date, run: selectedRun, numDays, filterBenchmark, filterStatus, filterText, clusterHealth: clusterHealthOpen, evalTime: evalTimeOpen, activeWorkers: activeWorkersOpen }, '', url)
  }, [date, selectedRun, numDays, filterBenchmark, filterStatus, filterText, clusterHealthOpen, evalTimeOpen, activeWorkersOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrlState()
      setDate(state.date)
      setSelectedRun(state.run)
      setNumDays(state.numDays)
      setFilterBenchmark(state.filterBenchmark)
      setFilterStatus(state.filterStatus)
      setFilterText(state.filterText)
      setClusterHealthOpen(state.clusterHealth)
      setEvalTimeOpen(state.evalTime)
      setActiveWorkersOpen(state.activeWorkers)
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
      // JSONL lines for in-progress runs can go stale; re-derive from metadata.
      const stale = allRuns.filter(r =>
        !r.status || r.status === 'pending' || r.status === 'building'
        || r.status === 'running-infer' || r.status === 'running-eval')
      if (stale.length) {
        setLoadingMetadataList(true)
        Promise.all(stale.map(async r => [r.slug, await fetchRunMetadata(r.slug)] as const))
          .then(entries => setRunMetadataMap(Object.fromEntries(entries)))
          .finally(() => setLoadingMetadataList(false))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
      setRuns([])
      setDayGroups([])
    } finally {
      setLoading(false)
    }
  }, [date, numDays])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

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
    setRefreshNonce(n => n + 1)
    if (selectedRun) {
      handleSelectRun(selectedRun)
    } else {
      loadRuns()
    }
  }

  const runSummaries = useMemo(() => runs.map(runItem => {
    const parsed = parseRunSlug(runItem.slug)
    // Use model/runtime from JSONL if available, otherwise parse from path
    const model = runItem.model || parsed.model
    return { slug: runItem.slug, status: runItem.status, triggeredBy: runItem.triggeredBy, triggerReason: runItem.triggerReason, benchmark: parsed.benchmark, jobId: parsed.jobId, model, runtime: runItem.runtime }
  }), [runs])

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
        refreshNonce={refreshNonce}
        clusterHealthOpen={clusterHealthOpen}
        onClusterHealthToggle={setClusterHealthOpen}
        evalTimeOpen={evalTimeOpen}
        onEvalTimeToggle={setEvalTimeOpen}
        activeWorkersOpen={activeWorkersOpen}
        onActiveWorkersToggle={setActiveWorkersOpen}
        runMetadataMap={runMetadataMap}
        runs={runs}
        onSelectRun={handleSelectRun}
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
            key={`${filterStatus}-${filterBenchmark}-${filterText}`}
            runs={runSummaries}
            loading={loading}
            error={error}
            onSelectRun={handleSelectRun}
            runMetadataMap={runMetadataMap}
            loadingMetadataList={loadingMetadataList}
            dayGroups={dayGroups}
            filterBenchmark={filterBenchmark}
            setFilterBenchmark={setFilterBenchmark}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterText={filterText}
            setFilterText={setFilterText}
            showDetail={!!selectedRun}
          />
        )}
      </main>
    </div>
  )
}
