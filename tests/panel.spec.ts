import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'a538aeff-5a8a-42a5-901c-938d896fdd6f';

test('plugin is registered in Grafana', async ({ page }) => {
  const response = await page.request.get('/api/plugins/dzaczek-alpineclock-panel');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.type).toBe('panel');
});

test('Alpine Clock panel renders on provisioned dashboard', async ({ page }) => {
  await page.goto(`/d/${DASHBOARD_UID}`);
  const panelContent = page.getByTestId('data-testid panel content').first();
  await expect(panelContent).toBeVisible({ timeout: 15000 });
  // Clock is rendered as SVG inside the panel content area
  await expect(panelContent.locator('svg')).toBeVisible();
});
