import {
  FieldType,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import {
  GRAND_CENTRAL_PANEL_DEFAULTS,
  withLegacyPanelDefaults,
} from './defaults';
import { AlpineClockOptions } from './types';

type ExampleDefinition = {
  name: string;
  description: string;
  options: AlpineClockOptions;
};

const CLASSIC_SWISS_OPTIONS = withLegacyPanelDefaults({
  dialShape: 'round',
  dialBackground: '#ffffff',
  dialBorderColor: '#111111',
  hourNumberColor: '#111111',
  hourTickColor: '#111111',
  minuteTickColor: '#111111',
  hourHandColor: '#111111',
  minuteHandColor: '#111111',
  secondHandColor: '#c62828',
  hourHandShape: 'rect',
  minuteHandShape: 'rect',
  secondHandShape: 'rect',
});

const VINTAGE_GOLD_OPTIONS = withLegacyPanelDefaults({
  dialBackground: '#f4ecd2',
  dialBorderColor: '#8b5a2b',
  hourNumberColor: '#5a3a1a',
  hourTickColor: '#8b5a2b',
  minuteTickColor: '#8b5a2b',
  hourHandShape: 'breguet',
  minuteHandShape: 'breguet',
  secondHandShape: 'pointer',
  hourHandColor: '#b8860b',
  minuteHandColor: '#b8860b',
  secondHandColor: '#8b5a2b',
  hourNumberFontFamily: 'Georgia, serif',
});

const MINIMAL_BATON_OPTIONS = withLegacyPanelDefaults({
  dialBackground: '#0d0d0d',
  dialBorderColor: '#0d0d0d',
  showHourTicks: false,
  showMinuteTicks: false,
  showSecondTicks: false,
  showHourNumbers: false,
  hourHandShape: 'baton',
  minuteHandShape: 'baton',
  secondHandShape: 'baton',
  hourHandColor: '#ffffff',
  minuteHandColor: '#ffffff',
  secondHandColor: '#00d4ff',
  centerCapColor: '#00d4ff',
});

const SQUARE_SHARP_OPTIONS = withLegacyPanelDefaults({
  dialShape: 'square',
  dialCornerRadius: 8,
  dialBackground: '#1a1a2e',
  dialBorderColor: '#e94560',
  hourNumberColor: '#e94560',
  hourTickColor: '#e94560',
  minuteTickColor: '#533483',
  hourHandShape: 'pointer',
  minuteHandShape: 'pointer',
  secondHandShape: 'pointer',
  hourHandColor: '#e94560',
  minuteHandColor: '#e94560',
  secondHandColor: '#f39c12',
});

export const ALPINE_CLOCK_EXAMPLES: ExampleDefinition[] = [
  {
    name: 'Grand Central Terminal',
    description: 'Classic station clock with warm brass chapter ring and Roman numerals.',
    options: GRAND_CENTRAL_PANEL_DEFAULTS,
  },
  {
    name: 'Classic Swiss',
    description: 'White enamel-style dial with straight black hands and a red seconds hand.',
    options: CLASSIC_SWISS_OPTIONS,
  },
  {
    name: 'Vintage Gold',
    description: 'Cream dial with warm metallic hands and serif numerals.',
    options: VINTAGE_GOLD_OPTIONS,
  },
  {
    name: 'Minimal Baton',
    description: 'Dark minimal face with bright baton hands and no tick clutter.',
    options: MINIMAL_BATON_OPTIONS,
  },
  {
    name: 'Square Sharp',
    description: 'Bold square case with neon-accented hands and numerals.',
    options: SQUARE_SHARP_OPTIONS,
  },
];

export const alpineClockSuggestionsSupplier: VisualizationSuggestionsSupplier<AlpineClockOptions> = (
  dataSummary
) => {
  if (
    dataSummary.hasData &&
    !dataSummary.hasFieldType(FieldType.number) &&
    !dataSummary.hasFieldType(FieldType.time)
  ) {
    return;
  }

  return ALPINE_CLOCK_EXAMPLES.map((example, index) => ({
    name: example.name,
    description: example.description,
    options: example.options,
    score: index === 0 ? VisualizationSuggestionScore.Good : VisualizationSuggestionScore.OK,
  }));
};
