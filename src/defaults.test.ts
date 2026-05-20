import fs from 'fs';
import path from 'path';
import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';
import {
  GRAND_CENTRAL_PANEL_DEFAULTS,
  LEGACY_PANEL_DEFAULTS,
  PANEL_OPTION_COUNT,
  withLegacyPanelDefaults,
} from './defaults';
import { migrateAlpineClockPanel } from './migrations';
import { ALPINE_CLOCK_EXAMPLES, alpineClockSuggestionsSupplier } from './suggestions';

describe('panel defaults', () => {
  it('keeps the legacy and grand central defaults fully materialized', () => {
    expect(Object.keys(LEGACY_PANEL_DEFAULTS)).toHaveLength(PANEL_OPTION_COUNT);
    expect(Object.keys(GRAND_CENTRAL_PANEL_DEFAULTS)).toHaveLength(PANEL_OPTION_COUNT);
    expect(LEGACY_PANEL_DEFAULTS.subdial1ScaleStartAngle).toBe(0);
    expect(LEGACY_PANEL_DEFAULTS.subdial1ScaleSweepAngle).toBe(360);
  });

  it('matches the Grand Central dashboard overrides exactly on top of the legacy defaults', () => {
    const grandCentralDashboard = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../provisioning/dashboards/grand-central.json'), 'utf8')
    );

    expect(GRAND_CENTRAL_PANEL_DEFAULTS).toEqual(
      withLegacyPanelDefaults(grandCentralDashboard.panels[0].options)
    );
  });

  it('uses the Grand Central defaults for newly created panels', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { plugin } = require('./module');

    expect(plugin.defaults).toEqual(GRAND_CENTRAL_PANEL_DEFAULTS);

    warnSpy.mockRestore();
  });
});

describe('panel migration', () => {
  it('fills sparse legacy panels with the pre-grand-central defaults', () => {
    const migrated = migrateAlpineClockPanel({
      id: 7,
      type: 'dzaczek-alpineclock-panel',
      options: {
        dialBackground: '#0d0d0d',
        secondHandColor: '#00d4ff',
        showHourTicks: false,
      } as any,
      fieldConfig: { defaults: {}, overrides: [] },
    });

    expect(migrated).toEqual(
      withLegacyPanelDefaults({
        dialBackground: '#0d0d0d',
        secondHandColor: '#00d4ff',
        showHourTicks: false,
      })
    );
  });
});

describe('example suggestions', () => {
  it('freezes every example to a full option set', () => {
    for (const example of ALPINE_CLOCK_EXAMPLES) {
      expect(Object.keys(example.options)).toHaveLength(PANEL_OPTION_COUNT);
    }
  });

  it('returns fixed examples for empty or metric-friendly data', () => {
    const noDataSuggestions = alpineClockSuggestionsSupplier(getPanelDataSummary([]));
    const metricSuggestions = alpineClockSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [3, 2, 1] },
          ],
        }),
      ])
    );

    expect(noDataSuggestions).toHaveLength(ALPINE_CLOCK_EXAMPLES.length);
    expect(metricSuggestions).toHaveLength(ALPINE_CLOCK_EXAMPLES.length);
  });

  it('hides examples for incompatible non-time, non-number data', () => {
    const suggestions = alpineClockSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [{ name: 'state', type: FieldType.string, values: ['ok', 'warn'] }],
        }),
      ])
    );

    expect(suggestions).toBeUndefined();
  });
});
