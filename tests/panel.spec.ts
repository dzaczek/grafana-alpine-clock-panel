import { test, expect } from '@grafana/plugin-e2e';

// Grafana 13.0.0 Enterprise has a panel-editor UI regression: the
// 'edit pane configure panel button' testid was added in 13.1+.
// panelEditPage fixture setup times out on 13.0.0 before the test body runs.
test.beforeEach(async ({ grafanaVersion }) => {
  test.skip(grafanaVersion.startsWith('13.0'), 'Grafana 13.0.x panel editor UI regression — fixed in 13.1+');
});

test('renders the Alpine Clock panel', async ({ panelEditPage, page }) => {
  await panelEditPage.setVisualization('Alpine Clock Panel');
  await expect(panelEditPage.panel.locator.locator('svg:not([aria-hidden])')).toBeVisible();
});

test('timezone option is exposed', async ({ panelEditPage }) => {
  await panelEditPage.setVisualization('Alpine Clock Panel');
  const options = panelEditPage.getCustomOptions('Time');
  await expect(options.element).toBeVisible();
});
