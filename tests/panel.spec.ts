import { test, expect } from '@grafana/plugin-e2e';

test('renders the Alpine Clock panel', async ({ panelEditPage, page }) => {
  await panelEditPage.setVisualization('Alpine Clock Panel');
  // Exclude aria-hidden icon SVGs; target only the clock canvas
  await expect(panelEditPage.panel.locator.locator('svg:not([aria-hidden])')).toBeVisible();
});

test('timezone option is exposed', async ({ panelEditPage }) => {
  await panelEditPage.setVisualization('Alpine Clock Panel');
  const options = panelEditPage.getCustomOptions('Time');
  await expect(options.element).toBeVisible();
});
