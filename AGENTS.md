# Repository Guidelines

## Project Structure
- `frontend/` — Vite + React + TypeScript app (all source code)
- `frontend/src/api.ts` — Data fetching layer (uses `/api/` prefix, proxied to bucket)
- `frontend/src/components/` — React components (Header, RunListView, RunDetailView, StatusTimeline, JsonCard)
- `vercel.json` — Vercel deployment config with rewrites for API proxy
- `Makefile` — Common development commands (see below)

## Makefile Commands
Use `make help` to see all available commands. Key commands:

```bash
make install      # Install all npm dependencies
make dev          # Start dev server (http://localhost:5173)
make build        # Build production bundle (output: frontend/dist/)
make test         # Run test suite (vitest)
make lint         # Run ESLint
make format       # Format code with ESLint --fix
make typecheck    # Run TypeScript type checking
make preview      # Preview production build (http://localhost:4173)
make clean        # Remove build artifacts and caches
make clean-all    # Full clean including node_modules
```

## Alternative npm Commands
If you prefer using npm directly:
```bash
cd frontend && npm install    # install deps
cd frontend && npm run dev    # dev server with proxy
cd frontend && npm run build  # production build (tsc + vite)
cd frontend && npm run test   # run tests
cd frontend && npm run lint   # run eslint
```

## Key Architecture Decisions
- **No backend** — pure client-side React app deployed on Vercel
- **CORS workaround** — bucket at `results.eval.all-hands.dev` has no CORS headers; Vercel rewrites proxy `/api/*` → bucket. Vite dev server uses its built-in proxy for the same effect.
- **Data format** — daily run list is a text file (`metadata/YYYY-MM-DD.txt`), individual run metadata is JSON files under `{run}/metadata/`.


## Metadata Rendering Notes
- `frontend/src/components/JsonCard.tsx` renders special GitHub links for certain metadata fields:
  - `sdk_commit` → `https://github.com/OpenHands/software-agent-sdk/commit/<sha>`
  - `evaluation_branch` / `eval_branch` → `https://github.com/OpenHands/evaluation/tree/<branch>` (strips `refs/heads/`)
  - `benchmarks_branch` → `https://github.com/OpenHands/benchmarks/tree/<branch>` (strips `refs/heads/`)

## Export Paths Modal Notes
- `frontend/src/components/ExportPathsModal.tsx` can export both results-bucket file URLs and an `eval_monitor_url` detail-page link for each run.
- `eval_monitor_url` is built from the current monitor URL, preserves existing query params like date/days/filters, and clears any hash before adding `run=<slug>`.

## Laminar Traces Button
- `frontend/src/components/StatusTimeline.tsx` renders a "🔍 Laminar traces" button under the **Run Inference** stage of the Pipeline Progress section.
- The button is shown only after inference has started (`runInferStart` metadata file exists) and when `params.unique_eval_name` is available.
- The URL points to `https://laminar.sh/project/<VITE_LAMINAR_PROJECT_ID>/traces?search=<unique_eval_name>&startDate=<infer_start_timestamp>`, so the trace view is filtered to this run and anchored at the beginning of inference.
- Set the `VITE_LAMINAR_PROJECT_ID` build-time env var (e.g. in Vercel) to the Laminar project that ingests benchmark traces. If unset, the button is hidden.

## Coding Style
- TypeScript strict mode, React functional components with hooks
- Tailwind CSS for styling with custom `oh-*` color theme (defined in `tailwind.config.js`)
- Minimal dependencies — no state management library, no routing library

## Testing
- Test framework: Vitest with React Testing Library
- Test files: `frontend/src/**/*.test.{ts,tsx}`
- Run with `make test` or `cd frontend && npm run test`

## Deployment
- Vercel auto-deploys from the repo
- `vercel.json` specifies build command, output directory, and API rewrites

## Dev Server Ports
- Dev server: http://localhost:5173 (Vite)
- Preview server: http://localhost:4173 (Vite preview)
- Work hosts (production proxies):
  - https://work-1-bhopzzxslmgoxlht.prod-runtime.all-hands.dev/ (port 12000)
  - https://work-2-bhopzzxslmgoxlht.prod-runtime.all-hands.dev/ (port 12001)
