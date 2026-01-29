# lorax-app

`lorax-app` is a pip-installable distribution that runs Lorax as a **single-port app**:

- React UI served at `/`
- Backend API served at `/api/*`
- Socket.IO served at `/api/socket.io/`

## Development (monorepo)

This package depends on the backend Python distribution `lorax` (from `packages/backend/`).

### Build + sync UI assets (for wheel builds)

Build the website with `VITE_API_BASE=/api`, then copy the `dist/` output into the Python package:

```bash
npm ci
VITE_API_BASE=/api npm --workspace packages/website run build
python packages/app/scripts/sync_ui_assets.py
```

### Run from source without copying assets

```bash
export LORAX_APP_STATIC_DIR=packages/website/dist
python -m pip install -e packages/backend
python -m pip install -e packages/app
lorax-app
```

