import { test, expect } from '@playwright/test';

test.skip(
  !process.env.LORAX_E2E,
  'Set LORAX_E2E=1 with backend running on :8080 and data available.'
);

test('presetfeature URL load and toggle syncs URL', async ({ page }) => {
  await page.goto('/1kg_chr2.trees.tsz?presetfeature=1000Genomes_chr2');

  await page.getByTitle('Info & Filters').click();
  await page.getByRole('button', { name: 'Metadata' }).click();

  await expect(page.getByText('Feature presets')).toBeVisible();
  const disableButton = page.getByTitle('Disable preset');
  await expect(disableButton).toBeVisible();
  expect(new URL(page.url()).searchParams.get('presetfeature')).toBe(
    '1000Genomes_chr2'
  );

  await disableButton.click();
  await expect(page.getByTitle('Enable preset')).toBeVisible();
  await page.waitForFunction(
    () => !new URL(window.location.href).searchParams.get('presetfeature')
  );

  await page.getByTitle('Enable preset').click();
  await page.waitForFunction(
    () =>
      new URL(window.location.href).searchParams.get('presetfeature') ===
      '1000Genomes_chr2'
  );
});
