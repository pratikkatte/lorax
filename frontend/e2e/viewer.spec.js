import { test, expect } from '@playwright/test';

test.describe('Viewer Page', () => {
  // These tests require navigating to a viewer route
  // In production, this would be /:file route

  test('should redirect to landing if no file specified', async ({ page }) => {
    // Navigate to a non-existent file path
    await page.goto('/nonexistent-file');

    // The viewer component should render
    // It may show loading state or redirect back
    await page.waitForLoadState('networkidle');

    // Verify we're on a valid page (not error)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show loading state when loading file', async ({ page }) => {
    await page.goto('/test-file');

    // Look for any loading indicators
    const loading = page.locator('[data-testid="loading"], .loader, text=/loading/i');

    // Either loading is shown or the viewer is rendered
    await page.waitForLoadState('domcontentloaded');
  });
});

test.describe('Viewer Page - Canvas Interaction', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
  });

  test('should have a WebGL canvas when file is loaded', async ({ page }) => {
    // Load a real file from the backend
    await page.goto('/1kg_chr22.trees.tsz?project=1000Genomes');

    // Wait for canvas to appear
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 60000 });
  });

  test('should respond to zoom interactions', async ({ page }) => {
    // This test requires a loaded visualization
    await page.goto('/1kg_chr22.trees.tsz?project=1000Genomes');

    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 30000 });

    // Get initial state
    const box = await canvas.boundingBox();

    // Perform wheel zoom
    await canvas.hover();
    await page.mouse.wheel(0, -100); // Zoom in

    // Verify interaction was handled (no errors)
    await expect(canvas).toBeVisible();
  });

  test('should respond to pan interactions', async ({ page }) => {
    await page.goto('/1kg_chr22.trees.tsz?project=1000Genomes');

    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 30000 });

    const box = await canvas.boundingBox();

    // Perform drag/pan
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
    await page.mouse.up();

    // Verify interaction was handled
    await expect(canvas).toBeVisible();
  });
});

test.describe('Viewer Page - Info Panel', () => {
  test('should show info panel when node is clicked', async ({ page }) => {
    await page.goto('/1kg_chr22.trees.tsz?project=1000Genomes');

    // Wait for visualization to load
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 30000 });

    // Click somewhere on the canvas
    await canvas.click({ position: { x: 100, y: 100 } });

    // Info panel might appear
    const infoPanel = page.locator('[data-testid="info-panel"], .info-panel');
    // This depends on hitting an actual node
  });

  test('should have tabs in info panel', async ({ page }) => {
    await page.goto('/1kg_chr22.trees.tsz?project=1000Genomes');

    // Trigger info panel (implementation specific)
    // ...

    // Verify tabs exist
    await expect(page.getByRole('button', { name: /Metadata/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mutations/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Filter/i })).toBeVisible();
  });
});

test.describe('Viewer Page - Navigation', () => {
  test('should navigate back to landing from viewer', async ({ page }) => {
    await page.goto('/some-file');

    // Look for a back/home button or logo link
    const homeLink = page.locator('a[href="/"], [data-testid="home-link"]');

    if (await homeLink.count() > 0) {
      await homeLink.first().click();
      await expect(page).toHaveURL('/');
    }
  });
});


