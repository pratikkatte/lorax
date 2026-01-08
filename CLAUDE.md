# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lorax** is a web-based tool for interactive exploration and visualization of Ancestral Recombination Graphs (ARGs). It consists of:
- **Frontend**: React + Vite application with deck.gl for WebGL-based tree visualization
- **Backend**: Python FastAPI server with Socket.IO for real-time communication

## Commands

### Frontend Development (from `frontend/` directory)
```bash
yarn install          # Install dependencies
yarn dev              # Start dev server on http://localhost:5173
yarn build            # Production build to dist/
yarn lint             # ESLint check
yarn test             # Run Vitest unit tests
yarn test:run         # Run tests once (no watch)
yarn test:coverage    # Run tests with coverage
yarn test:e2e         # Run Playwright E2E tests (requires backend running)
yarn test:e2e:headed  # E2E tests in headed mode
```

### Backend Development (from root directory)
```bash
pip install -r requirements.txt
uvicorn lorax.lorax_app:sio_app --host 0.0.0.0 --port 8080 --reload
```

### Docker
```bash
docker build -t lorax .
docker run -it -p 80:80 lorax
```

## Architecture

### Data Flow
1. User selects a `.trees`, `.tsz` (tskit format), or `.csv` file
2. Backend loads tree sequence via `tskit`/`tszip` into an LRU cache (`handlers.py`)
3. Frontend connects via Socket.IO and requests data through events:
   - `load_file`: Load a tree sequence file
   - `query_edges`: Fetch edges for genomic interval
   - `process_layout`: Compute tree layout on backend
   - `details`: Get node/tree metadata
4. Frontend web worker (`localBackendWorker.js`) processes tree data and caches edges
5. Deck.gl renders trees using custom layers

### Frontend Structure
```
frontend/src/
├── App.jsx              # Router setup
├── Lorax.jsx            # Main visualization wrapper
├── LoraxViewer.jsx      # Viewer with sidebar panels
├── Deck.jsx             # DeckGL canvas with views
├── hooks/
│   ├── useConnect.jsx   # Socket.IO + worker connection management
│   ├── useView.jsx      # Viewport state and zoom handling
│   ├── useRegions.jsx   # Genomic region binning logic
│   ├── useLayers.jsx    # Deck.gl layer composition
│   ├── useConfig.jsx    # Tree config state
│   └── useAnimatedBins.jsx  # Smooth tree transitions
├── layers/
│   ├── TreeLayer.jsx    # Main tree visualization (PathLayer + ScatterplotLayer)
│   ├── EdgeCompositeLayer.jsx  # Edge rendering with backend layout
│   ├── GenomeGridLayer.jsx     # Genomic coordinate axis
│   └── TimeGridLayer.jsx       # Time/coalescent axis
├── webworkers/
│   └── localBackendWorker.js   # Offscreen tree processing
└── components/
    ├── LandingPage.jsx  # File selection interface
    ├── Info.jsx         # Tree/node details sidebar
    └── Settings.jsx     # Display settings
```

### Backend Structure
```
lorax/
├── lorax_app.py    # FastAPI + Socket.IO server, session management
├── handlers.py     # Tree loading, LRU cache, layout computation, query handlers
├── manager.py      # WebSocket client management (unused in current Socket.IO setup)
├── constants.py    # Session and socket configuration constants
├── viz/
│   └── trees_to_taxonium.py  # CSV/Newick tree processing
└── utils/
    └── gcs_utils.py  # Google Cloud Storage helpers (production)
```

### Key Patterns

**Session Management**: HTTP cookie (`lorax_sid`) identifies user sessions. Sessions track loaded file path. Supports Redis for multi-process deployments or in-memory for single-process.

**Tree Caching**: `_ts_cache` (LRU, max=1) holds loaded tskit tree sequences. `_config_cache` (LRU, max=2) holds computed configurations.

**Coordinate System**: Frontend uses `globalBpPerUnit` to convert genomic base pairs to world coordinates. Trees are positioned via 4x4 model matrices encoding scale and translation.

**Bin System**: `useRegions` creates "bins" mapping genomic intervals to visible trees. Each bin has `modelMatrix`, `visible`, `global_index`, and cached `path` data for rendering.

## Environment Variables

- `VITE_API_BASE`: Backend URL for frontend (default: `http://localhost:8080`)
- `REDIS_URL`: Redis connection for distributed sessions (optional)
- `BUCKET_NAME`: GCS bucket for production file storage
- `IS_VM`: Set to enable GCS integration
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)

## Testing Notes

- Unit tests use Vitest with React Testing Library
- E2E tests require both frontend (`yarn dev`) and backend running
- E2E tests use `VITE_API_BASE=http://localhost:8080`
- Test files are colocated with source (`.test.jsx` alongside `.jsx`)
