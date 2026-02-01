# Lorax Website

## Development

```bash
yarn dev
```

## Tests

### Unit tests (Vitest)

```bash
yarn test
```

### E2E tests (Playwright)

E2E tests are opt-in and expect a running backend plus the 1000Genomes chr2 dataset.

Prerequisites:
- Backend running on `http://127.0.0.1:8080`
- Vite dev server runs on `http://127.0.0.1:3001` (Playwright starts it automatically)
- Data file available at `/1kg_chr2.trees.tsz` and project metadata matches `1000Genomes`

Run:
```bash
LORAX_E2E=1 yarn test:e2e
```

First-time setup (installs Playwright browsers):
```bash
npx playwright install
```
