# Repository Guidelines

## Project Structure
- `frontend/` — Vite + React + TypeScript app (all source code)
- `frontend/src/api.ts` — Data fetching layer (uses `/api/` prefix, proxied to bucket)
- `frontend/src/components/` — React components (Header, RunListView, RunDetailView, StatusTimeline, JsonCard)
- `vercel.json` — Vercel deployment config with rewrites for API proxy

## Build & Dev Commands
```bash
cd frontend && npm install    # install deps
cd frontend && npm run dev    # dev server with proxy
cd frontend && npm run build  # production build (tsc + vite)
```

## Key Architecture Decisions
- **No backend** — pure client-side React app deployed on Vercel
- **CORS workaround** — bucket at `results.eval.all-hands.dev` has no CORS headers; Vercel rewrites proxy `/api/*` → bucket. Vite dev server uses its built-in proxy for the same effect.
- **Data format** — daily run list is a text file (`metadata/YYYY-MM-DD.txt`), individual run metadata is JSON files under `{run}/metadata/`.

## Coding Style
- TypeScript strict mode, React functional components with hooks
- Tailwind CSS for styling with custom `oh-*` color theme (defined in `tailwind.config.js`)
- Minimal dependencies — no state management library, no routing library

## Deployment
- Vercel auto-deploys from the repo
- `vercel.json` specifies build command, output directory, and API rewrites
