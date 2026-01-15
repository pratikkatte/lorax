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
yarn test             # Run Vitest unit tests (watch mode)
yarn test:run         # Run tests once (no watch)
yarn test:coverage    # Run tests with coverage
yarn test:ui          # Run tests with Vitest UI
yarn test:e2e         # Run Playwright E2E tests (backend must be running on :8080)
yarn test:e2e:headed  # E2E tests in headed mode
yarn test:e2e:debug   # E2E tests with debugger
```

To run a single test file:
```bash
yarn test src/components/Info.test.jsx       # Unit test
yarn test:e2e e2e/landing-page.spec.js       # E2E test
```

### Backend Development (from `packages/backend/` directory)
```bash
pip install -e .             # Install package in editable mode
lorax serve --reload         # Start dev server on http://localhost:8080
lorax serve --open-browser   # Local mode with browser auto-open

# Alternative: direct uvicorn
uvicorn lorax.lorax_app:sio_app --host 0.0.0.0 --port 8080 --reload

# Production with gunicorn
lorax serve --gunicorn --workers 4

# Configuration and cache management
lorax config show            # Display current mode and settings
lorax cache-status           # Show disk cache statistics
lorax cache-clear            # Clear disk cache
```

### Docker
```bash
docker build -t lorax .
docker run -it -p 80:80 lorax
```

## Architecture

### Data Flow
1. User selects a `.trees`, `.tsz` (tskit format), or `.csv` file
2. Backend loads tree sequence via `tskit`/`tszip` into an LRU cache
3. Frontend connects via Socket.IO and requests data through events:
   - `load_file`: Load a tree sequence file
   - `process_postorder_layout`: Get post-order traversal arrays for visible trees
   - `details`: Get node/tree metadata
4. Frontend receives post-order node arrays via PyArrow, reconstructs tree layout using stack-based algorithm
5. Deck.gl renders trees using PostOrderCompositeLayer (PathLayer + ScatterplotLayer)

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
│   ├── TreeLayer.jsx    # Sample node visualization
│   ├── PostOrderCompositeLayer.jsx  # Tree rendering via post-order traversal
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
packages/backend/lorax/
├── lorax_app.py         # FastAPI + Socket.IO app setup
├── routes.py            # HTTP routes (file upload, health checks)
├── sockets.py           # Socket.IO event handlers
├── session_manager.py   # Session management with socket tracking
├── disk_cache.py        # LRU disk cache for GCS downloads
├── context.py           # Global singletons (session_manager, disk_cache_manager)
├── handlers.py          # Tree loading with mtime-validated caching
├── cli.py               # CLI commands (serve, config, cache)
├── modes.py             # Deployment mode detection (local/development/production)
├── constants.py         # Mode-aware app configuration
├── utils.py             # LRUCache, LRUCacheWithMeta
├── loaders/             # Tree data loading
│   ├── loader.py        # Config cache and loading
│   ├── tskit_loader.py  # Tskit/tszip format handling
│   └── csv_loader.py    # CSV format handling
├── metadata/
│   └── loader.py        # Metadata cache and queries
├── tree_graph/
│   └── tree_graph.py    # Batch tree construction
└── cloud/
    └── gcs_utils.py     # GCS download with disk cache integration
```

### Deployment Modes

Backend auto-detects mode based on environment:
- **local**: Conda/desktop use. In-memory sessions, no GCS, 5 TS cache slots.
- **development**: Optional GCS, relaxed limits, 5 TS cache slots.
- **production**: Redis + GCS required, 50GB disk cache, 2 TS cache slots per worker, 5 socket limit per session.

Set explicitly with `LORAX_MODE=production|development|local`.

### Key Patterns

**Session Management**: HTTP cookie (`lorax_sid`) identifies user sessions. Sessions track loaded file path and socket connections. In production, oldest socket is replaced (not rejected) when limit reached.

**Multi-Layer Caching**:
1. **Disk cache** (`disk_cache.py`): 50GB LRU for GCS downloads, shared across workers
2. **Memory cache** (`handlers.py`): Per-worker LRU with mtime validation for tree sequences
3. **Config/metadata caches**: Per-worker LRU for computed data

**Multi-Worker Coordination**: Redis for distributed session storage and download locks. File-based locks as fallback for single-process mode.

**Coordinate System**: Frontend uses `globalBpPerUnit` to convert genomic base pairs to world coordinates. Trees are positioned via 4x4 model matrices encoding scale and translation.

**Bin System**: `useRegions` creates "bins" mapping genomic intervals to visible trees. Each bin has `modelMatrix`, `visible`, `global_index`, and cached `path` data for rendering.

## Environment Variables

### Frontend
- `VITE_API_BASE`: Backend URL (default: `http://localhost:8080`)

### Backend
- `LORAX_MODE`: Deployment mode (`local`/`development`/`production`, auto-detected if not set)
- `REDIS_URL`: Redis connection for distributed sessions (required in production)
- `GCS_BUCKET_NAME` or `BUCKET_NAME`: GCS bucket for file storage
- `IS_VM`: Set to `true` to enable GCS integration
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)
- `TS_CACHE_SIZE`: Tree sequences per worker (default: 2 prod, 5 local)
- `DISK_CACHE_DIR`: Disk cache directory (default: `/tmp/lorax_cache`)
- `DISK_CACHE_MAX_GB`: Max disk cache size (default: 50)
- `MAX_SOCKETS_PER_SESSION`: Connection limit per session (default: 5, enforced in production only)

## Testing Notes

- Unit tests use Vitest with React Testing Library
- E2E tests use Playwright and require backend running on port 8080 (frontend auto-starts)
- E2E tests use `VITE_API_BASE=http://localhost:8080`
- Test files are colocated with source (`.test.jsx` alongside `.jsx`)
- E2E test specs are in `frontend/e2e/`
