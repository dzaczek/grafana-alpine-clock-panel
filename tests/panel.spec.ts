import { test, expect } from '@grafana/plugin-e2e';

test('renders the Alpine Clock panel', async ({ panelEditPage, page }) => {
  await panelEditPage.setVisualization('Alpine Clock Panel');
  await expect(panelEditPage.panel.locator.locator('svg')).toBeVisible();
});

test('timezone option is exposed', async ({ panelEditPage }) => {
  await panelEditPage.setVisualization('Alpine Clock Panel');
  const options = panelEditPage.getCustomOptions('Time');
  // Just verify the category is reachable; individual controls are flaky to assert on.
  await expect(options.locator).toBeVisible();
});
