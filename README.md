# OpenHands Eval Monitor

A lightweight dashboard for monitoring OpenHands evaluation runs. Deployed on Vercel as a thin JavaScript client that reads public metadata from `results.eval.all-hands.dev`.

## Features

- **Date-based navigation** — browse evaluation runs by date (UTC)
- **Run list** — see all runs for a given day, grouped by benchmark
- **Run detail** — view metadata, parameters, and pipeline progress for each run
- **Status tracking** — see whether a run is pending, running inference, running evaluation, completed, or errored
- **Auto-refresh** — quickly refresh run status

## Data Source

The dashboard reads from publicly accessible metadata files:

- `https://results.eval.all-hands.dev/metadata/YYYY-MM-DD.txt` — list of runs for a date
- `https://results.eval.all-hands.dev/{run}/metadata/{file}.json` — individual run metadata

## Development

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on port 12001 with a proxy to `results.eval.all-hands.dev` to avoid CORS issues.

## Build

```bash
cd frontend
npm run build
```

## Deployment

Deployed automatically via Vercel. The `vercel.json` configures:
- Build command and output directory
- API rewrites to proxy requests to the data bucket

### Environment Variables

The following environment variable must be set in Vercel:

- `GITHUB_TOKEN` — GitHub Personal Access Token with `actions:read` permission (required for the "Copy command" feature to fetch workflow parameters)

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
