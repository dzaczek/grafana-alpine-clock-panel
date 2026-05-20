import { PanelMigrationHandler } from '@grafana/data';
import { AlpineClockOptions } from './types';
import { withLegacyPanelDefaults } from './defaults';

export const migrateAlpineClockPanel: PanelMigrationHandler<AlpineClockOptions> = (panel) => {
  return withLegacyPanelDefaults(panel.options ?? {});
};
