import { PanelPlugin, PanelOptionsEditorBuilder } from '@grafana/data';
import { AlpineClockOptions } from './types';
import { AlpineClockPanel } from './components/AlpineClockPanel';
import { GRAND_CENTRAL_PANEL_DEFAULTS } from './defaults';
import { migrateAlpineClockPanel } from './migrations';
import { alpineClockSuggestionsSupplier } from './suggestions';
import { TIMEZONE_OPTIONS } from './timezones';

const HAND_SHAPE_OPTIONS = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'taper', label: 'Taper' },
  { value: 'lozenge', label: 'Lozenge' },
  { value: 'pointer', label: 'Pointer' },
  { value: 'sword', label: 'Sword (with cross-guard)' },
  { value: 'dauphine', label: 'Dauphine' },
  { value: 'breguet', label: 'Breguet (moon ring)' },
  { value: 'alpha', label: 'Alpha (leaf)' },
  { value: 'syringe', label: 'Syringe (with dot)' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'baton', label: 'Baton (rounded)' },
  { value: 'leaf', label: 'Leaf (Bezier)' },
  { value: 'skeleton', label: 'Skeleton (outline)' },
  { value: 'spade', label: 'Spade' },
];

const COUNTERWEIGHT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'ring', label: 'Ring' },
];

const GM_GAUGE_PLACEMENT_OPTIONS = [
  { value: 'none', label: 'Disabled' },
  { value: 'dial', label: 'Dial background' },
  { value: 'bezel', label: 'Bezel ring' },
];

const GM_GAUGE_STYLE_OPTIONS = [
  { value: 'flat', label: 'Flat overlay' },
  { value: 'mechanical', label: 'Mechanical cutouts' },
];

const MECHANICAL_MOVEMENT_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'skeleton', label: 'Transparent dial + movement' },
];

const MECHANICAL_MOVEMENT_DRIVE_MODE_OPTIONS = [
  { value: 'run', label: 'Run' },
  { value: 'wind', label: 'Wind mainspring' },
  { value: 'set-time', label: 'Set time' },
];

const HOUR_NUMBER_STYLE_OPTIONS = [
  { value: 'arabic', label: 'Arabic numerals' },
  { value: 'roman', label: 'Roman numerals' },
  { value: 'circled-arabic', label: 'Circled Arabic' },
  { value: 'circled-roman', label: 'Circled Roman' },
];

interface HandDefaults {
  color: string;
  length: number;
  tail: number;
  width: number;
  bounceOn: boolean;
  bounceAmp: number;
}

const DEFAULTABLE_EDITOR_METHODS = new Set([
  'addBooleanSwitch',
  'addColorPicker',
  'addNumberInput',
  'addRadio',
  'addSelect',
  'addSliderInput',
  'addTextInput',
]);

function withDefaultValues(
  builder: PanelOptionsEditorBuilder<AlpineClockOptions>,
  defaults: AlpineClockOptions
): PanelOptionsEditorBuilder<AlpineClockOptions> {
  let wrappedBuilder: PanelOptionsEditorBuilder<AlpineClockOptions>;

  wrappedBuilder = new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== 'function' || !DEFAULTABLE_EDITOR_METHODS.has(String(prop))) {
        return value;
      }

      return (config: { path?: string; defaultValue?: unknown }) => {
        const nextConfig =
          config?.path && Object.prototype.hasOwnProperty.call(defaults, config.path)
            ? { ...config, defaultValue: defaults[config.path as keyof AlpineClockOptions] }
            : config;

        value.call(target, nextConfig);
        return wrappedBuilder;
      };
    },
  });

  return wrappedBuilder;
}

/**
 * Register all controls for one hand (length, shape, pivot, counterweight, bounce).
 * Path prefix must match the flat field names in AlpineClockOptions.
 */
function registerHand(
  builder: PanelOptionsEditorBuilder<AlpineClockOptions>,
  category: string,
  prefix: 'hour' | 'minute' | 'second',
  defaults: HandDefaults
) {
  const handPath = `${prefix}Hand`; // e.g. hourHand / minuteHand / secondHand
  const smoothPath = `smooth${prefix === 'hour' ? 'HourHand' : prefix === 'minute' ? 'MinuteHand' : 'SecondHand'}` as const;
  const cwPrefix = `${prefix}Counterweight`;
  const bouncePrefix = `${prefix}Bounce`;
  const cat = [category];

  const b = builder
    .addColorPicker({
      path: `${handPath}Color` as any,
      name: 'Color',
      category: cat,
      defaultValue: defaults.color,
      description: `Fill color of the ${prefix} hand.`,
    })
    .addSliderInput({
      path: `${handPath}Length` as any,
      name: 'Length from pivot to tip (% of radius)',
      category: cat,
      defaultValue: defaults.length,
      settings: { min: 5, max: 120, step: 1 },
      description: `How far the ${prefix} hand reaches from pivot toward the edge, as a percentage of the dial radius.`,
    })
    .addSliderInput({
      path: `${handPath}Tail` as any,
      name: 'Tail from pivot (% of radius)',
      category: cat,
      defaultValue: defaults.tail,
      settings: { min: 0, max: 80, step: 1 },
      description: `Length of the ${prefix} hand extending past the pivot in the opposite direction.`,
    })
    .addSliderInput({
      path: `${handPath}PivotOffset` as any,
      name: 'Pivot offset from center (% of radius)',
      category: cat,
      defaultValue: 0,
      settings: { min: -50, max: 50, step: 1 },
      description: '0 = mounted at dial center. Positive = toward 12, negative = toward 6.',
    })
    .addSliderInput({
      path: `${handPath}Width` as any,
      name: 'Width (px)',
      category: cat,
      defaultValue: defaults.width,
      settings: { min: 1, max: 40, step: 1 },
      description: `Line thickness of the ${prefix} hand in pixels.`,
    })
    .addSelect({
      path: `${handPath}Shape` as any,
      name: 'Shape',
      category: cat,
      defaultValue: 'rect',
      settings: { options: HAND_SHAPE_OPTIONS },
      description: `Silhouette style of the ${prefix} hand (rect, dauphine, sword, arrow, etc.).`,
    });

  // Smooth-motion toggle — only for hour and minute hands.
  // The second hand is always smooth (stop-to-go or continuous 360°/60s).
  if (prefix !== 'second') {
    b.addBooleanSwitch({
      path: smoothPath as any,
      name: 'Smooth motion',
      category: cat,
      defaultValue: prefix === 'hour',
      description: `When enabled, the ${prefix} hand sweeps continuously instead of jumping from tick to tick.`,
    });
  }

  b
    // Per-hand counterweight
    .addSelect({
      path: `${cwPrefix}Shape` as any,
      name: 'Counterweight shape',
      category: cat,
      defaultValue: prefix === 'second' ? 'circle' : 'none',
      settings: { options: COUNTERWEIGHT_OPTIONS },
      description: `Decorative weight shape on the tail side of the ${prefix} hand pivot.`,
    })
    .addSliderInput({
      path: `${cwPrefix}Size` as any,
      name: 'Counterweight size (% of radius)',
      category: cat,
      defaultValue: 10,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => (c as any)[`${cwPrefix}Shape`] !== 'none',
      description: `Diameter of the counterweight disc as a percentage of the dial radius.`,
    })
    .addSliderInput({
      path: `${cwPrefix}Position` as any,
      name: 'Counterweight position along hand (% of radius)',
      category: cat,
      defaultValue: prefix === 'second' ? -23 : -10,
      settings: { min: -80, max: 120, step: 1 },
      description: 'Distance from pivot. Positive = toward tip, negative = toward tail.',
      showIf: (c) => (c as any)[`${cwPrefix}Shape`] !== 'none',
    })
    .addColorPicker({
      path: `${cwPrefix}Color` as any,
      name: 'Counterweight color',
      category: cat,
      defaultValue: defaults.color,
      showIf: (c) => (c as any)[`${cwPrefix}Shape`] !== 'none',
      description: `Fill color of the ${prefix} hand counterweight.`,
    })

    // Per-hand damped bounce on discrete tick
    .addBooleanSwitch({
      path: `${bouncePrefix}` as any,
      name: 'Damped bounce on tick',
      category: cat,
      defaultValue: defaults.bounceOn,
      description: 'After each discrete advance the hand oscillates with heavy-metal inertia.',
    })
    .addNumberInput({
      path: `${bouncePrefix}DurationMs` as any,
      name: 'Bounce duration (ms)',
      category: cat,
      defaultValue: 500,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
      description: 'How long the damped oscillation lasts after each tick, in milliseconds.',
    })
    .addNumberInput({
      path: `${bouncePrefix}AmplitudeDeg` as any,
      name: 'Bounce amplitude (deg)',
      category: cat,
      defaultValue: defaults.bounceAmp,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
      description: 'Initial angular displacement of the oscillation in degrees.',
    })
    .addNumberInput({
      path: `${bouncePrefix}Damping` as any,
      name: 'Damping coefficient',
      category: cat,
      defaultValue: 8,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
      description: 'Damping ratio. Higher values settle faster with less overshoot.',
    })
    .addNumberInput({
      path: `${bouncePrefix}Frequency` as any,
      name: 'Angular frequency (rad/s)',
      category: cat,
      defaultValue: 30,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
      description: 'Natural angular frequency of the damped harmonic oscillator in radians per second.',
    });
}

const SUBDIAL_MODE_OPTIONS = [
  { value: 'analog', label: 'Analog (mini hand)' },
  { value: 'digital', label: 'Digital readout' },
];

const SUBDIAL_LABEL_POSITION_OPTIONS = [
  { value: 'none', label: 'No label' },
  { value: 'inside-top', label: 'Inside (top)' },
  { value: 'inside-bottom', label: 'Inside (bottom)' },
  { value: 'outer-top', label: 'Outer (top)' },
  { value: 'outer-bottom', label: 'Outer (bottom)' },
];

const SUBDIAL_REDUCER_OPTIONS = [
  { value: 'last', label: 'Last' },
  { value: 'lastNotNull', label: 'Last (not null)' },
  { value: 'first', label: 'First' },
  { value: 'mean', label: 'Mean' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
];

/**
 * Register all controls for one chronograph subdial. Uses flat path names
 * subdial1Foo / subdial2Foo / ... because Grafana's default editor builder
 * doesn't support repeatable/grouped options.
 */
function registerSubdial(
  builder: PanelOptionsEditorBuilder<AlpineClockOptions>,
  n: 1 | 2 | 3 | 4,
  defaults: {
    distance: number;
    angle: number;
    label: string;
    handColor: string;
  }
) {
  const cat = [`Subdial ${n}`];
  const en = (c: AlpineClockOptions) => (c as any)[`subdial${n}Enabled`];
  builder
    .addBooleanSwitch({
      path: `subdial${n}Enabled` as any,
      name: `Enable subdial ${n}`,
      category: cat,
      defaultValue: false,
      description: 'Chronograph totalizer that can display a metric as a mini analog dial or a digital readout.',
    })
    .addSliderInput({
      path: `subdial${n}Distance` as any,
      name: 'Distance from center (% of radius)',
      category: cat,
      defaultValue: defaults.distance,
      settings: { min: 0, max: 100, step: 1 },
      showIf: en,
      description: 'Radial distance of the subdial center from the main dial center.',
    })
    .addSliderInput({
      path: `subdial${n}Angle` as any,
      name: 'Angle (deg, 0 = up)',
      category: cat,
      defaultValue: defaults.angle,
      settings: { min: 0, max: 360, step: 1 },
      showIf: en,
      description: "Angular position of the subdial on the main dial. 0° = 12 o'clock.",
    })
    .addSliderInput({
      path: `subdial${n}Size` as any,
      name: 'Diameter (% of radius)',
      category: cat,
      defaultValue: 30,
      settings: { min: 5, max: 100, step: 1 },
      showIf: en,
      description: 'Outer diameter of the subdial as a percentage of the main dial radius.',
    })
    .addRadio({
      path: `subdial${n}Mode` as any,
      name: 'Display mode',
      category: cat,
      defaultValue: 'analog',
      settings: { options: SUBDIAL_MODE_OPTIONS },
      showIf: en,
      description: 'Analog draws a mini hand on a small scale; digital shows a numeric readout.',
    })
    .addColorPicker({
      path: `subdial${n}BgColor` as any,
      name: 'Background',
      category: cat,
      defaultValue: '#f4ecd2',
      showIf: en,
      description: 'Fill color of the subdial face.',
    })
    .addColorPicker({
      path: `subdial${n}BorderColor` as any,
      name: 'Border color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: en,
      description: 'Color of the subdial outer ring.',
    })
    .addSliderInput({
      path: `subdial${n}BorderWidth` as any,
      name: 'Border width (px)',
      category: cat,
      defaultValue: 1,
      settings: { min: 0, max: 10, step: 1 },
      showIf: en,
      description: 'Thickness of the subdial outer ring in pixels.',
    })
    .addNumberInput({
      path: `subdial${n}Min` as any,
      name: 'Min value',
      category: cat,
      defaultValue: 0,
      showIf: en,
      description: 'Value that maps to the start of the subdial scale.',
    })
    .addNumberInput({
      path: `subdial${n}Max` as any,
      name: 'Max value',
      category: cat,
      defaultValue: 100,
      showIf: en,
      description: 'Value that maps to the end of the subdial scale.',
    })
    .addSliderInput({
      path: `subdial${n}ScaleStartAngle` as any,
      name: 'Scale start (deg, 0 = up)',
      category: cat,
      defaultValue: 0,
      settings: { min: 0, max: 360, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description:
        "Clock angle where the subdial scale starts. 0° = 12 o'clock, 90° = 3 o'clock, 180° = 6 o'clock.",
    })
    .addSliderInput({
      path: `subdial${n}ScaleSweepAngle` as any,
      name: 'Scale sweep (deg)',
      category: cat,
      defaultValue: 360,
      settings: { min: 10, max: 360, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description:
        'Angular range covered by the scale between min and max. Example: 270° gives a classic gauge-style sweep.',
    })
    .addTextInput({
      path: `subdial${n}Label` as any,
      name: 'Label',
      category: cat,
      defaultValue: defaults.label,
      showIf: en,
      description: 'Short text label displayed on or near the subdial (e.g. MEM, CPU).',
    })
    .addSelect({
      path: `subdial${n}LabelPosition` as any,
      name: 'Label position',
      category: cat,
      defaultValue: 'inside-bottom',
      settings: { options: SUBDIAL_LABEL_POSITION_OPTIONS },
      showIf: en,
      description: 'Where the label sits relative to the subdial face.',
    })
    .addColorPicker({
      path: `subdial${n}LabelColor` as any,
      name: 'Label color',
      category: cat,
      defaultValue: '#2a2a2a',
      showIf: en,
      description: 'Text color of the subdial label.',
    })
    .addSliderInput({
      path: `subdial${n}LabelFontSize` as any,
      name: 'Label font size (% of subdial radius)',
      category: cat,
      defaultValue: 14,
      settings: { min: 4, max: 40, step: 1 },
      showIf: en,
      description: 'Font size of the label text relative to the subdial radius.',
    })
    .addTextInput({
      path: `subdial${n}Unit` as any,
      name: 'Unit',
      category: cat,
      defaultValue: '',
      showIf: en,
      description: 'Unit suffix displayed after the value (e.g. %, GB, rpm).',
    })
    .addColorPicker({
      path: `subdial${n}HandColor` as any,
      name: 'Hand color',
      category: cat,
      defaultValue: defaults.handColor,
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description: 'Color of the analog subdial indicator hand.',
    })
    .addSliderInput({
      path: `subdial${n}HandWidth` as any,
      name: 'Hand width (% of subdial radius)',
      category: cat,
      defaultValue: 6,
      settings: { min: 1, max: 30, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description: 'Line thickness of the analog subdial hand relative to the subdial radius.',
    })
    .addSliderInput({
      path: `subdial${n}TickCount` as any,
      name: 'Tick count',
      category: cat,
      defaultValue: 12,
      settings: { min: 0, max: 60, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description: 'Number of evenly spaced tick marks around the subdial scale.',
    })
    .addColorPicker({
      path: `subdial${n}TickColor` as any,
      name: 'Tick color',
      category: cat,
      defaultValue: '#2a2a2a',
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description: 'Color of the subdial tick marks.',
    })
    .addBooleanSwitch({
      path: `subdial${n}ShowNumbers` as any,
      name: 'Show min/mid/max numbers',
      category: cat,
      defaultValue: true,
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
      description: 'Display the min, midpoint, and max values along the subdial scale.',
    })
    .addColorPicker({
      path: `subdial${n}NumberColor` as any,
      name: 'Number color',
      category: cat,
      defaultValue: '#2a2a2a',
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog' && (c as any)[`subdial${n}ShowNumbers`],
      description: 'Color of the min/mid/max number labels on the subdial.',
    })
    .addSliderInput({
      path: `subdial${n}NumberFontSize` as any,
      name: 'Number font size (% of subdial radius)',
      category: cat,
      defaultValue: 16,
      settings: { min: 4, max: 40, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog' && (c as any)[`subdial${n}ShowNumbers`],
      description: 'Font size of the scale numbers relative to the subdial radius.',
    })
    .addColorPicker({
      path: `subdial${n}DigitalColor` as any,
      name: 'Digital text color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'digital',
      description: 'Color of the numeric readout text in digital mode.',
    })
    .addSliderInput({
      path: `subdial${n}DigitalFontSize` as any,
      name: 'Digital font size (% of subdial radius)',
      category: cat,
      defaultValue: 40,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'digital',
      description: 'Font size of the digital readout relative to the subdial radius.',
    })
    .addNumberInput({
      path: `subdial${n}Decimals` as any,
      name: 'Decimal places',
      category: cat,
      defaultValue: 0,
      showIf: en,
      description: 'Number of decimal digits shown in digital mode or when formatting the value.',
    })
    .addTextInput({
      path: `subdial${n}FieldName` as any,
      name: 'Field name',
      category: cat,
      defaultValue: '',
      description: 'Name of the numeric field to read. Empty = first numeric field in the first series.',
      showIf: en,
    })
    .addSelect({
      path: `subdial${n}Reducer` as any,
      name: 'Reducer',
      category: cat,
      defaultValue: 'lastNotNull',
      settings: { options: SUBDIAL_REDUCER_OPTIONS },
      showIf: en,
      description: 'Aggregation applied to the data series (last, mean, min, max, sum, etc.).',
    })
    .addTextInput({
      path: `subdial${n}QueryRefId` as any,
      name: 'Query ref ID',
      category: cat,
      defaultValue: '',
      description: 'Only look inside frames whose refId matches (e.g. "A"). Empty = any frame.',
      showIf: en,
    })
    .addNumberInput({
      path: `subdial${n}Scale` as any,
      name: 'Value scale (multiplier)',
      category: cat,
      defaultValue: 1,
      description: 'Final value = raw × scale + offset (applied before min/max and formatting).',
      showIf: en,
    })
    .addNumberInput({
      path: `subdial${n}Offset` as any,
      name: 'Value offset',
      category: cat,
      defaultValue: 0,
      showIf: en,
      description: 'Constant added to the scaled value. Applied after scale, before min/max clamping.',
    })
    .addRadio({
      path: `subdial${n}ThresholdMode` as any,
      name: 'Thresholds affect',
      category: cat,
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: 'Off' },
          { value: 'value', label: 'Hand / text' },
          { value: 'background', label: 'Background' },
          { value: 'both', label: 'Both' },
        ],
      },
      showIf: en,
      description: 'How threshold crossings are visualized: hand/text color, background color, or both.',
    })
    .addNumberInput({
      path: `subdial${n}Threshold1` as any,
      name: 'Threshold 1 value',
      category: cat,
      defaultValue: 70,
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
      description: 'Warning threshold value. Crossing this activates the threshold-1 color.',
    })
    .addColorPicker({
      path: `subdial${n}Threshold1Color` as any,
      name: 'Threshold 1 color',
      category: cat,
      defaultValue: '#e6b800',
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
      description: 'Color applied when the value crosses threshold 1 (warning zone).',
    })
    .addNumberInput({
      path: `subdial${n}Threshold2` as any,
      name: 'Threshold 2 value',
      category: cat,
      defaultValue: 90,
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
      description: 'Critical threshold value. Crossing this activates the threshold-2 color.',
    })
    .addColorPicker({
      path: `subdial${n}Threshold2Color` as any,
      name: 'Threshold 2 color',
      category: cat,
      defaultValue: '#d14343',
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
      description: 'Color applied when the value crosses threshold 2 (critical zone).',
    });
}

/**
 * Register the "Global Metric" gauge overlaid on the main dial. It is one
 * big hand scaled across `gmMin..gmMax`, optional fill arc, optional scale
 * ring, and an optional value readout (window / center / counterweight).
 */
function registerGlobalMetric(builder: PanelOptionsEditorBuilder<AlpineClockOptions>) {
  const cat = ['Global metric'];
  const indicatorCat = ['Global metric', 'Indicator'];
  const readoutCat = ['Global metric', 'Readout'];
  const gaugeCat = ['Global metric', 'Gauge'];
  const en = (c: AlpineClockOptions) => c.gmEnabled;
  const gaugeEn = (c: AlpineClockOptions) => en(c) && c.gmGaugePlacement !== 'none';

  builder
    .addBooleanSwitch({
      path: 'gmEnabled',
      name: 'Enable global metric hand',
      category: cat,
      defaultValue: false,
      description: 'Master toggle for the global metric system. Enables data binding, sweep, arc, threshold and scale ring options.',
    })
    .addBooleanSwitch({
      path: 'gmShowHand',
      name: 'Show indicator hand',
      category: ['Global metric', 'Indicator'],
      defaultValue: true,
      showIf: en,
      description: 'Display the large fourth hand that sweeps across the dial to indicate the current metric value.',
    })

    // Data binding
    .addTextInput({
      path: 'gmFieldName',
      name: 'Field name',
      category: cat,
      defaultValue: '',
      description: 'Numeric field to read. Empty = first numeric field in the first matching frame.',
      showIf: en,
    })
    .addSelect({
      path: 'gmReducer',
      name: 'Reducer',
      category: cat,
      defaultValue: 'lastNotNull',
      settings: { options: SUBDIAL_REDUCER_OPTIONS },
      showIf: en,
    description: 'Aggregation applied to the data series before mapping to the gauge angle.',
    })
    .addTextInput({
      path: 'gmQueryRefId',
      name: 'Query ref ID',
      category: cat,
      defaultValue: '',
      description: 'Only read frames whose refId matches. Empty = any.',
      showIf: en,
    })
    .addNumberInput({
      path: 'gmScale',
      name: 'Value scale (multiplier)',
      category: cat,
      defaultValue: 1,
      showIf: en,
    description: 'Multiplier applied to the raw value before offset, min/max clamping, and display.',
    })
    .addNumberInput({
      path: 'gmOffset',
      name: 'Value offset',
      category: cat,
      defaultValue: 0,
      showIf: en,
    description: 'Constant added after scaling, before min/max clamping.',
    })
    .addNumberInput({
      path: 'gmMin',
      name: 'Min value',
      category: cat,
      defaultValue: 0,
      showIf: en,
    description: 'Value that maps to the start of the gauge sweep arc.',
    })
    .addNumberInput({
      path: 'gmMax',
      name: 'Max value',
      category: cat,
      defaultValue: 100,
      showIf: en,
    description: 'Value that maps to the end of the gauge sweep arc.',
    })
    .addNumberInput({
      path: 'gmDecimals',
      name: 'Decimal places',
      category: cat,
      defaultValue: 1,
      showIf: en,
    description: 'Number of decimal places shown when the value is displayed.',
    })
    .addTextInput({
      path: 'gmUnit',
      name: 'Unit',
      category: cat,
      defaultValue: '',
      showIf: en,
    description: 'Unit suffix appended to the numeric value (e.g. %, GB/s, rpm).',
    })

    // Sweep geometry
    .addSliderInput({
      path: 'gmStartAngle',
      name: 'Sweep start angle (deg, 0 = 12 o\'clock)',
      category: cat,
      defaultValue: -135,
      settings: { min: -360, max: 360, step: 1 },
      showIf: en,
    description: "Angle where the gauge arc begins. 0° = 12 o'clock, positive = clockwise.",
    })
    .addSliderInput({
      path: 'gmSweepAngle',
      name: 'Sweep span (deg from min to max)',
      category: cat,
      defaultValue: 270,
      settings: { min: 30, max: 360, step: 1 },
      showIf: en,
    description: 'Angular span of the gauge arc from min to max value, in degrees.',
    })
    .addBooleanSwitch({
      path: 'gmSmooth',
      name: 'Smooth value transitions',
      category: cat,
      defaultValue: true,
      showIf: en,
      description: 'When enabled, the hand animates smoothly between value changes instead of jumping.',
    })
    .addSliderInput({
      path: 'gmSmoothDuration',
      name: 'Smooth transition duration (s)',
      category: cat,
      defaultValue: 1.0,
      settings: { min: 0.1, max: 60, step: 0.1 },
      showIf: (c) => en(c) && c.gmSmooth,
      description: 'How many seconds the global metric hand takes to travel from its current angle to the new target value.',
    })

    // Hand geometry (Indicator subcategory)
    .addColorPicker({
      path: 'gmHandColor',
      name: 'Hand color',
      category: indicatorCat,
      defaultValue: '#d94e1f',
      showIf: en,
    description: 'Color of the global metric indicator hand.',
    })
    .addSliderInput({
      path: 'gmHandLength',
      name: 'Hand length (% of radius)',
      category: indicatorCat,
      defaultValue: 78,
      settings: { min: 5, max: 120, step: 1 },
      showIf: en,
    description: 'Distance from the pivot to the hand tip, as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'gmHandTail',
      name: 'Hand tail (% of radius)',
      category: indicatorCat,
      defaultValue: 15,
      settings: { min: 0, max: 80, step: 1 },
      showIf: en,
    description: 'Length of the hand extending behind the pivot, as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'gmHandPivotOffset',
      name: 'Pivot offset (% of radius)',
      category: indicatorCat,
      defaultValue: 0,
      settings: { min: -50, max: 50, step: 1 },
      showIf: en,
    description: 'Shifts the hand pivot away from the dial center. 0 = centered.',
    })
    .addSliderInput({
      path: 'gmHandWidth',
      name: 'Hand width (px)',
      category: indicatorCat,
      defaultValue: 6,
      settings: { min: 1, max: 40, step: 1 },
      showIf: en,
    description: 'Line thickness of the global metric hand in pixels.',
    })
    .addSelect({
      path: 'gmHandShape',
      name: 'Hand shape',
      category: indicatorCat,
      defaultValue: 'pointer',
      settings: { options: HAND_SHAPE_OPTIONS },
      showIf: en,
    description: 'Silhouette style of the global metric hand.',
    })

    // Counterweight
    .addSelect({
      path: 'gmCounterweightShape',
      name: 'Counterweight shape',
      category: indicatorCat,
      defaultValue: 'circle',
      settings: { options: COUNTERWEIGHT_OPTIONS },
      showIf: en,
    description: 'Decorative weight shape on the tail side of the global metric hand pivot.',
    })
    .addSliderInput({
      path: 'gmCounterweightSize',
      name: 'Counterweight size (% of radius)',
      category: indicatorCat,
      defaultValue: 12,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => en(c) && c.gmCounterweightShape !== 'none',
    description: 'Diameter of the global metric counterweight as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'gmCounterweightPosition',
      name: 'Counterweight position (% of radius)',
      category: indicatorCat,
      defaultValue: -15,
      settings: { min: -80, max: 120, step: 1 },
      showIf: (c) => en(c) && c.gmCounterweightShape !== 'none',
    description: 'Distance of the counterweight from the pivot. Positive = toward tip, negative = toward tail.',
    })
    .addColorPicker({
      path: 'gmCounterweightColor',
      name: 'Counterweight color',
      category: indicatorCat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && c.gmCounterweightShape !== 'none',
    description: 'Fill color of the global metric hand counterweight.',
    })

    // Fill arc
    .addRadio({
      path: 'gmFillMode',
      name: 'Fill mode',
      category: cat,
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: 'None' },
          { value: 'arc', label: 'Arc fill only' },
          { value: 'handColor', label: 'Threshold → hand color' },
          { value: 'both', label: 'Arc + hand color' },
        ],
      },
      showIf: en,
    description: 'How the sweep arc is filled: none, arc band, threshold-driven hand color, or both.',
    })
    .addSliderInput({
      path: 'gmArcInnerRadius',
      name: 'Arc inner radius (% of radius)',
      category: cat,
      defaultValue: 72,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    description: 'Inner radius of the fill arc band as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'gmArcOuterRadius',
      name: 'Arc outer radius (% of radius)',
      category: cat,
      defaultValue: 88,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    description: 'Outer radius of the fill arc band as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'gmArcColor',
      name: 'Arc color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    description: 'Fill color of the arc band between the inner and outer radii.',
    })
    .addSliderInput({
      path: 'gmArcOpacity',
      name: 'Arc opacity (%)',
      category: cat,
      defaultValue: 60,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    description: 'Opacity of the arc fill as a percentage.',
    })

    // Thresholds
    .addRadio({
      path: 'gmThresholdMode',
      name: 'Thresholds affect',
      category: cat,
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: 'None' },
          { value: 'value', label: 'Hand + value color' },
          { value: 'background', label: 'Arc color' },
          { value: 'both', label: 'Both' },
        ],
      },
      showIf: en,
    description: 'How threshold crossings are shown visually: hand/value color, arc fill color, or both.',
    })
    .addNumberInput({
      path: 'gmThreshold1',
      name: 'Threshold 1',
      category: cat,
      defaultValue: 60,
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    description: 'Warning threshold value. Crossing this activates the threshold-1 color.',
    })
    .addColorPicker({
      path: 'gmThreshold1Color',
      name: 'Threshold 1 color',
      category: cat,
      defaultValue: '#f4b400',
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    description: 'Color applied when the value crosses the warning threshold.',
    })
    .addNumberInput({
      path: 'gmThreshold2',
      name: 'Threshold 2',
      category: cat,
      defaultValue: 85,
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    description: 'Critical threshold value. Crossing this activates the threshold-2 color.',
    })
    .addColorPicker({
      path: 'gmThreshold2Color',
      name: 'Threshold 2 color',
      category: cat,
      defaultValue: '#d14343',
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    description: 'Color applied when the value crosses the critical threshold.',
    })

    // Scale ring
    .addRadio({
      path: 'gmScaleMode',
      name: 'Scale ring',
      category: cat,
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: 'None' },
          { value: 'ring', label: 'Extra ring of numbers' },
          { value: 'replaceHours', label: 'Replace hour indices' },
        ],
      },
      showIf: en,
    description: 'Extra ring of numeric labels: none, independent scale ring, or replace hour numerals.',
    })
    .addSliderInput({
      path: 'gmScaleRadius',
      name: 'Scale ring radius (% of radius)',
      category: cat,
      defaultValue: 62,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Radial position of the scale ring as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'gmScaleTickCount',
      name: 'Scale tick count',
      category: cat,
      defaultValue: 10,
      settings: { min: 2, max: 60, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Number of major tick marks and labels on the scale ring.',
    })
    .addSliderInput({
      path: 'gmScaleTickLength',
      name: 'Scale tick length (% of radius)',
      category: cat,
      defaultValue: 4,
      settings: { min: 0, max: 30, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Length of scale ring ticks as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'gmScaleTickColor',
      name: 'Scale tick color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Color of the scale ring tick marks.',
    })
    .addColorPicker({
      path: 'gmScaleNumberColor',
      name: 'Scale number color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Color of the scale ring number labels.',
    })
    .addSliderInput({
      path: 'gmScaleNumberFontSize',
      name: 'Scale number font size (% of radius)',
      category: cat,
      defaultValue: 7,
      settings: { min: 2, max: 20, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Font size of scale ring numbers as a percentage of the dial radius.',
    })
    .addTextInput({
      path: 'gmScaleNumberFontFamily',
      name: 'Scale number font family',
      category: cat,
      defaultValue: 'Arial, sans-serif',
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'CSS font-family for scale ring numbers.',
    })
    .addNumberInput({
      path: 'gmScaleDecimals',
      name: 'Scale number decimals',
      category: cat,
      defaultValue: 0,
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    description: 'Number of decimal places for scale ring labels.',
    })

    // Value display (Readout subcategory)
    .addRadio({
      path: 'gmValueDisplay',
      name: 'Value display',
      category: readoutCat,
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: 'Hidden' },
          { value: 'window', label: 'Window on dial' },
          { value: 'center', label: 'Center of dial' },
          { value: 'counterweight', label: 'On counterweight' },
        ],
      },
      showIf: en,
    description: 'Where to show the current metric value: hidden, in a window, at center, or on the counterweight.',
    })
    .addRadio({
      path: 'gmValueWindowPosition',
      name: 'Window position',
      category: readoutCat,
      defaultValue: 'bottom',
      settings: {
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Placement of the value window on the dial (top, bottom, left, right).',
    })
    .addSliderInput({
      path: 'gmValueWindowDistance',
      name: 'Window distance from center (% of radius)',
      category: readoutCat,
      defaultValue: 45,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Radial distance of the value window center from the dial center.',
    })
    .addSliderInput({
      path: 'gmValueWindowWidth',
      name: 'Window width (px)',
      category: readoutCat,
      defaultValue: 70,
      settings: { min: 10, max: 400, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Width of the value window in pixels.',
    })
    .addSliderInput({
      path: 'gmValueWindowHeight',
      name: 'Window height (px)',
      category: readoutCat,
      defaultValue: 28,
      settings: { min: 10, max: 200, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Height of the value window in pixels.',
    })
    .addColorPicker({
      path: 'gmValueTextColor',
      name: 'Value text color',
      category: readoutCat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && c.gmValueDisplay !== 'none',
    description: 'Color of the numeric value text.',
    })
    .addColorPicker({
      path: 'gmValueBgColor',
      name: 'Value background',
      category: readoutCat,
      defaultValue: '#ffffff',
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Background color of the value window.',
    })
    .addColorPicker({
      path: 'gmValueBorderColor',
      name: 'Value border color',
      category: readoutCat,
      defaultValue: '#1a1a1a',
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Border color of the value window.',
    })
    .addSliderInput({
      path: 'gmValueBorderWidth',
      name: 'Value border width (px)',
      category: readoutCat,
      defaultValue: 1,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Border thickness of the value window in pixels.',
    })
    .addTextInput({
      path: 'gmValueFontFamily',
      name: 'Value font family',
      category: readoutCat,
      defaultValue: 'Menlo, Monaco, Consolas, monospace',
      showIf: (c) => en(c) && c.gmValueDisplay !== 'none',
    description: 'CSS font-family for the value display text.',
    })
    .addSliderInput({
      path: 'gmValueFontSize',
      name: 'Value font size (px)',
      category: readoutCat,
      defaultValue: 16,
      settings: { min: 4, max: 200, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay !== 'none',
    description: 'Font size of the value text. In window mode this is px; in center mode it is % of radius.',
    })
    .addSliderInput({
      path: 'gmValueCornerRadius',
      name: 'Value corner radius (px)',
      category: readoutCat,
      defaultValue: 4,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    description: 'Rounding radius of the value window corners in pixels.',
    })

    // Gauge track (Gauge subcategory)
    .addRadio({
      path: 'gmGaugePlacement',
      name: 'Segmented gauge placement',
      category: gaugeCat,
      defaultValue: 'none',
      description: 'Semi-circular segmented gauge tied to the global metric. Can sit subtly on the dial or wrap the bezel.',
      settings: { options: GM_GAUGE_PLACEMENT_OPTIONS },
      showIf: en,
    })
    .addRadio({
      path: 'gmGaugeStyle',
      name: 'Gauge presentation',
      category: gaugeCat,
      defaultValue: 'flat',
      description: 'Mechanical cutouts use a date-wheel style cylinder for the value and recessed drum-bars for the chart.',
      settings: { options: GM_GAUGE_STYLE_OPTIONS },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeOpacity',
      name: 'Gauge opacity (%)',
      category: gaugeCat,
      defaultValue: 30,
      settings: { min: 0, max: 100, step: 1 },
      showIf: gaugeEn,
    description: 'Overall opacity of the segmented gauge as a percentage.',
    })
    .addSliderInput({
      path: 'gmGaugeStartAngle',
      name: 'Gauge start angle (deg, 0 = 12 o\'clock)',
      category: gaugeCat,
      defaultValue: 225,
      settings: { min: -360, max: 360, step: 1 },
      showIf: gaugeEn,
    description: "Angle where the segmented gauge arc begins. 0° = 12 o'clock.",
    })
    .addSliderInput({
      path: 'gmGaugeSweepAngle',
      name: 'Gauge sweep span (deg)',
      category: gaugeCat,
      defaultValue: 180,
      settings: { min: 30, max: 360, step: 1 },
      showIf: gaugeEn,
    description: 'Angular span of the segmented gauge arc in degrees (typically 180 for a half-circle).',
    })
    .addSliderInput({
      path: 'gmGaugeInnerRadius',
      name: 'Gauge inner radius (% of placement radius)',
      category: gaugeCat,
      defaultValue: 58,
      settings: { min: 0, max: 140, step: 1 },
      showIf: gaugeEn,
    description: 'Inner radius of the gauge segments as a percentage of the placement base radius.',
    })
    .addSliderInput({
      path: 'gmGaugeOuterRadius',
      name: 'Gauge outer radius (% of placement radius)',
      category: gaugeCat,
      defaultValue: 74,
      settings: { min: 0, max: 160, step: 1 },
      showIf: gaugeEn,
    description: 'Outer radius of the gauge segments as a percentage of the placement base radius.',
    })
    .addSliderInput({
      path: 'gmGaugeLabelRadius',
      name: 'Label radius (% of placement radius)',
      category: gaugeCat,
      defaultValue: 84,
      settings: { min: 0, max: 180, step: 1 },
      showIf: gaugeEn,
    description: 'Radial position of gauge scale labels as a percentage of the placement base radius.',
    })
    .addSliderInput({
      path: 'gmGaugeSegmentCount',
      name: 'Segment count',
      category: gaugeCat,
      defaultValue: 30,
      settings: { min: 3, max: 120, step: 1 },
      showIf: gaugeEn,
    description: 'Total number of segments in the gauge arc. More segments = finer resolution.',
    })
    .addSliderInput({
      path: 'gmGaugeSegmentGap',
      name: 'Segment gap (% of segment)',
      category: gaugeCat,
      defaultValue: 32,
      settings: { min: 0, max: 90, step: 1 },
      showIf: gaugeEn,
    description: "Gap between adjacent segments as a percentage of each segment's width.",
    })
    .addColorPicker({
      path: 'gmGaugeActiveColor1',
      name: 'Active gradient start',
      category: gaugeCat,
      defaultValue: '#f3c54b',
      showIf: gaugeEn,
    description: 'Start color of the active segment gradient (low end of the value range).',
    })
    .addColorPicker({
      path: 'gmGaugeActiveColor2',
      name: 'Active gradient end',
      category: gaugeCat,
      defaultValue: '#ff6b5f',
      showIf: gaugeEn,
    description: 'End color of the active segment gradient (high end of the value range).',
    })
    .addColorPicker({
      path: 'gmGaugeInactiveColor',
      name: 'Inactive segment color',
      category: gaugeCat,
      defaultValue: '#3a3f47',
      showIf: gaugeEn,
    description: 'Color of segments that are beyond the current value.',
    })
    .addBooleanSwitch({
      path: 'gmGaugeRimEnabled',
      name: 'Show inactive outer rim',
      category: gaugeCat,
      defaultValue: true,
      showIf: gaugeEn,
    description: 'Draw a thin outer rim behind the gauge segments.',
    })
    .addColorPicker({
      path: 'gmGaugeRimColor1',
      name: 'Outer rim start color',
      category: gaugeCat,
      defaultValue: '#9cd8d8',
      showIf: (c) => gaugeEn(c) && c.gmGaugeRimEnabled,
    description: 'Start color of the outer rim gradient.',
    })
    .addColorPicker({
      path: 'gmGaugeRimColor2',
      name: 'Outer rim end color',
      category: gaugeCat,
      defaultValue: '#ff8a3d',
      showIf: (c) => gaugeEn(c) && c.gmGaugeRimEnabled,
    description: 'End color of the outer rim gradient.',
    })
    .addSliderInput({
      path: 'gmGaugeRimWidth',
      name: 'Outer rim width (px)',
      category: gaugeCat,
      defaultValue: 2,
      settings: { min: 0, max: 12, step: 0.5 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeRimEnabled,
    description: 'Thickness of the outer rim in pixels.',
    })
    .addTextInput({
      path: 'gmGaugeLabelValues',
      name: 'Scale labels (comma-separated)',
      category: gaugeCat,
      defaultValue: '10,30,60,90',
      description: 'Values placed outside the arc. Leave empty to hide.',
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeLabelColor',
      name: 'Label color',
      category: gaugeCat,
      defaultValue: '#d0d5db',
      showIf: gaugeEn,
    description: 'Color of the gauge scale label text.',
    })
    .addTextInput({
      path: 'gmGaugeLabelFontFamily',
      name: 'Label font family',
      category: gaugeCat,
      defaultValue: 'Arial, sans-serif',
      showIf: gaugeEn,
    description: 'CSS font-family for gauge labels.',
    })
    .addSliderInput({
      path: 'gmGaugeLabelFontSize',
      name: 'Label font size (% of placement radius)',
      category: gaugeCat,
      defaultValue: 6,
      settings: { min: 2, max: 20, step: 0.5 },
      showIf: gaugeEn,
    description: 'Font size of gauge labels as a percentage of the placement base radius.',
    })
    .addBooleanSwitch({
      path: 'gmGaugeShowValue',
      name: 'Show centered split value',
      category: gaugeCat,
      defaultValue: true,
      showIf: gaugeEn,
    description: 'Display the current numeric value centered inside the gauge arc.',
    })
    .addColorPicker({
      path: 'gmGaugeValueColor',
      name: 'Value color',
      category: gaugeCat,
      defaultValue: '#ffffff',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    description: 'Color of the centered gauge value text.',
    })
    .addTextInput({
      path: 'gmGaugeValueFontFamily',
      name: 'Value font family',
      category: gaugeCat,
      defaultValue: 'Arial, sans-serif',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    description: 'CSS font-family for the centered gauge value.',
    })
    .addSliderInput({
      path: 'gmGaugeValueFontSize',
      name: 'Value font size (px)',
      category: gaugeCat,
      defaultValue: 36,
      settings: { min: 6, max: 160, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    description: 'Font size of the centered gauge value in pixels.',
    })
    .addSliderInput({
      path: 'gmGaugeValueYOffset',
      name: 'Value vertical offset (% of placement radius)',
      category: gaugeCat,
      defaultValue: 12,
      settings: { min: -100, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    description: 'Vertical offset of the centered value as a percentage of the placement base radius.',
    })
    .addColorPicker({
      path: 'gmGaugeUnitColor',
      name: 'Unit color',
      category: gaugeCat,
      defaultValue: '#d0d5db',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    description: 'Color of the unit label displayed below the centered value.',
    })
    .addSliderInput({
      path: 'gmGaugeUnitFontSize',
      name: 'Unit font size (px)',
      category: gaugeCat,
      defaultValue: 16,
      settings: { min: 4, max: 80, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    description: 'Font size of the unit label in pixels.',
    })
    .addBooleanSwitch({
      path: 'gmGaugeShowSparkline',
      name: 'Show sparkline',
      category: gaugeCat,
      defaultValue: false,
      showIf: gaugeEn,
    description: 'Draw a small sparkline chart inside the gauge arc showing recent value history.',
    })
    .addColorPicker({
      path: 'gmGaugeSparklineColor',
      name: 'Sparkline stroke color',
      category: gaugeCat,
      defaultValue: '#ff6b5f',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Stroke color of the sparkline.',
    })
    .addColorPicker({
      path: 'gmGaugeSparklineFillColor',
      name: 'Sparkline fill color',
      category: gaugeCat,
      defaultValue: '#ff6b5f',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Fill color under the sparkline curve.',
    })
    .addSliderInput({
      path: 'gmGaugeSparklineOpacity',
      name: 'Sparkline fill opacity (%)',
      category: gaugeCat,
      defaultValue: 35,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Opacity of the sparkline fill as a percentage.',
    })
    .addSliderInput({
      path: 'gmGaugeSparklineWidth',
      name: 'Sparkline width (% of placement radius)',
      category: gaugeCat,
      defaultValue: 82,
      settings: { min: 10, max: 160, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Width of the sparkline area as a percentage of the placement base radius.',
    })
    .addSliderInput({
      path: 'gmGaugeSparklineHeight',
      name: 'Sparkline height (% of placement radius)',
      category: gaugeCat,
      defaultValue: 20,
      settings: { min: 2, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Height of the sparkline area as a percentage of the placement base radius.',
    })
    .addSliderInput({
      path: 'gmGaugeSparklineYOffset',
      name: 'Sparkline vertical offset (% of placement radius)',
      category: gaugeCat,
      defaultValue: 42,
      settings: { min: -100, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Vertical offset of the sparkline from center, as a percentage of the placement base radius.',
    })
    .addSliderInput({
      path: 'gmGaugeSparklineStrokeWidth',
      name: 'Sparkline stroke width (px)',
      category: gaugeCat,
      defaultValue: 2,
      settings: { min: 0.5, max: 10, step: 0.5 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    description: 'Stroke width of the sparkline in pixels.',
    });
}

function registerMechanicalMovement(builder: PanelOptionsEditorBuilder<AlpineClockOptions>) {
  const cat = ['Mechanical movement'];
  const en = (c: AlpineClockOptions) => c.mechanicalMovementMode === 'skeleton';

  builder
    .addRadio({
      path: 'mechanicalMovementMode',
      name: 'Movement style',
      category: cat,
      defaultValue: 'off',
      description:
        'Separate transparent-dial watch movement style, independent from the global metric gauge. It looks best on clean dials without metric overlays and with minimal subdials/windows.',
      settings: { options: MECHANICAL_MOVEMENT_MODE_OPTIONS },
    })
    .addSliderInput({
      path: 'mechanicalMovementOpacity',
      name: 'Movement opacity (%)',
      category: cat,
      defaultValue: 78,
      settings: { min: 0, max: 100, step: 1 },
      showIf: en,
    description: 'Overall opacity of the mechanical movement layer as a percentage.',
    })
    .addSliderInput({
      path: 'mechanicalMovementDialOpacity',
      name: 'Transparent dial tint opacity (%)',
      category: cat,
      defaultValue: 16,
      settings: { min: 0, max: 100, step: 1 },
      showIf: en,
    description: 'Tint opacity of the transparent dial overlay as a percentage.',
    })
    .addRadio({
      path: 'mechanicalMovementDriveMode',
      name: 'Mechanism mode',
      category: cat,
      defaultValue: 'run',
      description:
        'Run keeps the train alive from the escapement, wind engages the crown and ratchet, and set time drives the minute works while freezing the escapement.',
      settings: { options: MECHANICAL_MOVEMENT_DRIVE_MODE_OPTIONS },
      showIf: en,
    })
    .addSliderInput({
      path: 'mechanicalMovementCrownSpeed',
      name: 'Crown speed (turns/min)',
      category: cat,
      defaultValue: 18,
      settings: { min: 1, max: 60, step: 1 },
      showIf: (c) => en(c) && c.mechanicalMovementDriveMode !== 'run',
      description: 'Speed of the crown rotation in turns per minute during wind or set-time modes.',
    })
    .addColorPicker({
      path: 'mechanicalMovementMetalColor',
      name: 'Wheel metal color',
      category: cat,
      defaultValue: '#b9a27c',
      showIf: en,
    description: 'Base color for the metal wheels and gears.',
    })
    .addColorPicker({
      path: 'mechanicalMovementBridgeColor',
      name: 'Bridge / plate color',
      category: cat,
      defaultValue: '#635141',
      showIf: en,
    description: 'Color of the bridge plates that hold the movement together.',
    })
    .addColorPicker({
      path: 'mechanicalMovementJewelColor',
      name: 'Jewel accent color',
      category: cat,
      defaultValue: '#cb5a6a',
      showIf: en,
    description: 'Accent color for the synthetic ruby jewels in the movement.',
    });
}

function registerPanelOptions(builder: PanelOptionsEditorBuilder<AlpineClockOptions>) {
  builder
    // Time
    .addSelect({
      path: 'timezone',
      name: 'Timezone',
      category: ['Time'],
      defaultValue: '',
      description: 'IANA timezone name. Empty = browser local.',
      settings: { options: TIMEZONE_OPTIONS },
    })
    .addBooleanSwitch({
      path: 'useQueryTime',
      name: 'Use time from query',
      category: ['Time'],
      defaultValue: false,
      description: 'If enabled, display latest timestamp from first data frame.',
    })
    .addBooleanSwitch({
      path: 'stopToGo',
      name: 'Stop-to-go second hand',
      category: ['Time'],
      defaultValue: true,
      description: 'Second hand sweeps a full revolution in <60 s then pauses at 12.',
    })
    .addNumberInput({
      path: 'sweepMs',
      name: 'Sweep duration (ms)',
      category: ['Time'],
      defaultValue: 58500,
      showIf: (c) => c.stopToGo,
    description: 'Duration of the second-hand sweep phase in milliseconds. Remaining time up to 60 s is the pause.',
    })
    .addNumberInput({
      path: 'pauseMs',
      name: 'Pause duration (ms)',
      category: ['Time'],
      defaultValue: 1500,
      showIf: (c) => c.stopToGo,
    description: "How long the second hand rests at 12 o'clock between sweeps, in milliseconds.",
    })

    // Dial
    .addSelect({
      path: 'dialShape',
      name: 'Shape',
      category: ['Dial'],
      defaultValue: 'round',
      settings: {
        options: [
          { value: 'round', label: 'Round' },
          { value: 'oval-h', label: 'Oval (horizontal)' },
          { value: 'oval-v', label: 'Oval (vertical)' },
          { value: 'square', label: 'Square' },
          { value: 'rect-h', label: 'Rectangle (horizontal)' },
          { value: 'rect-v', label: 'Rectangle (vertical)' },
          { value: 'hex-flat', label: 'Hexagon (flat top)' },
          { value: 'hex-point', label: 'Hexagon (pointy top)' },
        ],
      },
    description: 'Overall silhouette of the clock face — circle, oval, square, rectangle, or hexagon.',
    })
    .addSliderInput({
      path: 'dialWidthFactor',
      name: 'Width factor (% of panel)',
      category: ['Dial'],
      defaultValue: 95,
      settings: { min: 10, max: 100, step: 1 },
    description: 'How much of the available panel width the dial occupies, as a percentage.',
    })
    .addSliderInput({
      path: 'dialHeightFactor',
      name: 'Height factor (% of panel)',
      category: ['Dial'],
      defaultValue: 95,
      settings: { min: 10, max: 100, step: 1 },
    description: 'How much of the available panel height the dial occupies, as a percentage.',
    })
    .addSliderInput({
      path: 'dialCornerRadius',
      name: 'Corner radius (px)',
      category: ['Dial'],
      defaultValue: 0,
      settings: { min: 0, max: 120, step: 1 },
      showIf: (c) => c.dialShape === 'square' || c.dialShape === 'rect-h' || c.dialShape === 'rect-v',
    description: 'Rounding radius for square or rectangular dial shapes, in pixels.',
    })
    .addColorPicker({
      path: 'dialBackground',
      name: 'Background color',
      category: ['Dial'],
      defaultValue: '#ffffff',
    description: 'Fill color of the dial face.',
    })
    .addColorPicker({
      path: 'dialBorderColor',
      name: 'Border color',
      category: ['Dial'],
      defaultValue: '#1a1a1a',
    description: 'Color of the dial outline.',
    })
    .addSliderInput({
      path: 'dialBorderWidth',
      name: 'Border width',
      category: ['Dial'],
      defaultValue: 0,
      settings: { min: 0, max: 20, step: 1 },
    description: 'Thickness of the dial outline in pixels. 0 = no border.',
    })
    .addRadio({
      path: 'dialFillMode',
      name: 'Fill mode',
      category: ['Dial'],
      defaultValue: 'solid',
      settings: {
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'linear', label: 'Linear gradient' },
          { value: 'radial', label: 'Radial gradient' },
        ],
      },
    description: 'Solid fills the dial with one color. Linear/radial blend toward a second color.',
    })
    .addColorPicker({
      path: 'dialColor2',
      name: 'Gradient second color',
      category: ['Dial'],
      defaultValue: '#333333',
      showIf: (c) => c.dialFillMode !== 'solid' && !c.dialGradientFade,
    description: 'Second color for the gradient fill. Ignored when fade-to-transparent is enabled.',
    })
    .addBooleanSwitch({
      path: 'dialGradientFade',
      name: 'Fade to transparent',
      category: ['Dial'],
      defaultValue: false,
      description: 'Outer colour becomes transparent instead of the second colour.',
      showIf: (c) => c.dialFillMode !== 'solid',
    })
    .addSliderInput({
      path: 'dialGradientAngle',
      name: 'Gradient angle (deg)',
      category: ['Dial'],
      defaultValue: 180,
      settings: { min: 0, max: 360, step: 1 },
      showIf: (c) => c.dialFillMode === 'linear',
    description: 'Direction of the linear gradient in degrees (0 = up, 90 = right).',
    })
    .addSliderInput({
      path: 'dialGradientCenterX',
      name: 'Radial center X (%)',
      category: ['Dial'],
      defaultValue: 50,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    description: 'Horizontal position of the radial gradient center, as a percentage of the dial width.',
    })
    .addSliderInput({
      path: 'dialGradientCenterY',
      name: 'Radial center Y (%)',
      category: ['Dial'],
      defaultValue: 50,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    description: 'Vertical position of the radial gradient center, as a percentage of the dial height.',
    })
    .addSliderInput({
      path: 'dialGradientInnerStop',
      name: 'Radial inner stop (%)',
      category: ['Dial'],
      defaultValue: 0,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    description: 'Radius where the solid core ends and the radial gradient begins, as a percentage.',
    })
    .addSliderInput({
      path: 'dialGradientOuterStop',
      name: 'Radial outer stop (%)',
      category: ['Dial'],
      defaultValue: 100,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    description: 'Radius where the radial gradient reaches full second color, as a percentage.',
    });

  builder

    // Chapter ring — decorative inner ring (Grand Central / station clock style)
    .addBooleanSwitch({
      path: 'showChapterRing',
      name: 'Show chapter ring',
      category: ['Chapter ring'],
      defaultValue: false,
      description: 'A thin decorative ring between the dial edge and the bezel, typical of station and terminal clocks like Grand Central.',
    })
    .addColorPicker({
      path: 'chapterRingColor',
      name: 'Chapter ring color',
      category: ['Chapter ring'],
      defaultValue: '#b8965a',
      showIf: (c) => c.showChapterRing,
      description: 'Color of the chapter ring. Warm brass or gold for classic station clocks, silver or black for modern.',
    })
    .addSliderInput({
      path: 'chapterRingWidth',
      name: 'Chapter ring width (px)',
      category: ['Chapter ring'],
      defaultValue: 2.5,
      settings: { min: 0.5, max: 8, step: 0.5 },
      showIf: (c) => c.showChapterRing,
      description: 'Thickness of the chapter ring in pixels. 2-3 px gives a refined station clock look.',
    })

    // Bezel (lunette)
    .addBooleanSwitch({
      path: 'showBezel',
      name: 'Show bezel',
      category: ['Bezel'],
      defaultValue: false,
      description: 'Outer ring around the dial that can carry its own numbers and ticks (lunette).',
    })
    .addSliderInput({
      path: 'bezelThickness',
      name: 'Thickness (% of radius)',
      category: ['Bezel'],
      defaultValue: 12,
      settings: { min: 2, max: 40, step: 1 },
      showIf: (c) => c.showBezel,
    description: 'Width of the bezel ring as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'bezelBackground',
      name: 'Background',
      category: ['Bezel'],
      defaultValue: '#2a2a2a',
      showIf: (c) => c.showBezel,
    description: 'Fill color of the bezel ring.',
    })
    .addColorPicker({
      path: 'bezelBorderColor',
      name: 'Border color',
      category: ['Bezel'],
      defaultValue: '#000000',
      showIf: (c) => c.showBezel,
    description: 'Color of the bezel outer edge stroke.',
    })
    .addSliderInput({
      path: 'bezelBorderWidth',
      name: 'Border width (px)',
      category: ['Bezel'],
      defaultValue: 1,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showBezel,
    description: 'Thickness of the bezel outer edge stroke in pixels.',
    })
    .addSelect({
      path: 'bezelNumbersMode',
      name: 'Numbers mode',
      category: ['Bezel'],
      defaultValue: '12',
      settings: {
        options: [
          { value: 'none', label: 'None' },
          { value: '12', label: '1–12 (every hour)' },
          { value: '24', label: '00–23 (24 hour)' },
          { value: '60', label: '00, 05, 10 … 55' },
          { value: '60-all', label: '0, 1, 2 … 59' },
        ],
      },
      showIf: (c) => c.showBezel,
    description: 'Which numbers are drawn on the bezel: 1–12, 00–23, minute markers, or none.',
    })
    .addSliderInput({
      path: 'bezelRotationOffset',
      name: 'Rotation offset (deg)',
      category: ['Bezel'],
      defaultValue: 0,
      settings: { min: -180, max: 180, step: 1 },
      showIf: (c) => c.showBezel,
    description: 'Rotates the entire bezel scale by this many degrees. Useful for dive-watch style tracking.',
    })
    .addColorPicker({
      path: 'bezelNumberColor',
      name: 'Number color',
      category: ['Bezel'],
      defaultValue: '#ffffff',
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    description: 'Color of the bezel number text.',
    })
    .addTextInput({
      path: 'bezelNumberFontFamily',
      name: 'Font family',
      category: ['Bezel'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    description: 'CSS font-family for bezel numbers.',
    })
    .addSliderInput({
      path: 'bezelNumberFontSize',
      name: 'Number font size (% of radius)',
      category: ['Bezel'],
      defaultValue: 7,
      settings: { min: 2, max: 25, step: 1 },
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    description: 'Font size of bezel numbers as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'bezelNumberRadius',
      name: 'Number position in ring (% of thickness)',
      category: ['Bezel'],
      defaultValue: 50,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    description: 'Radial position of bezel numbers within the bezel ring. 0 = inner edge, 100 = outer edge.',
    })
    .addBooleanSwitch({
      path: 'bezelNumberUpright',
      name: 'Numbers always upright',
      category: ['Bezel'],
      defaultValue: true,
      description: 'Off = numbers rotate along the ring (tangential).',
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    })
    .addBooleanSwitch({
      path: 'showBezelTicks',
      name: 'Show ticks',
      category: ['Bezel'],
      defaultValue: true,
      showIf: (c) => c.showBezel,
    description: 'Draw tick marks along the bezel ring.',
    })
    .addColorPicker({
      path: 'bezelTickColor',
      name: 'Tick color',
      category: ['Bezel'],
      defaultValue: '#ffffff',
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Color of the bezel tick marks.',
    })
    .addNumberInput({
      path: 'bezelTickStepDeg',
      name: 'Minor tick step (deg)',
      category: ['Bezel'],
      defaultValue: 6,
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Angular spacing between minor bezel ticks in degrees.',
    })
    .addSliderInput({
      path: 'bezelTickLength',
      name: 'Minor tick length (px)',
      category: ['Bezel'],
      defaultValue: 4,
      settings: { min: 1, max: 40, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Length of minor bezel ticks in pixels.',
    })
    .addSliderInput({
      path: 'bezelTickWidth',
      name: 'Minor tick width (px)',
      category: ['Bezel'],
      defaultValue: 1,
      settings: { min: 1, max: 10, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Thickness of minor bezel ticks in pixels.',
    })
    .addNumberInput({
      path: 'bezelMajorTickStepDeg',
      name: 'Major tick step (deg)',
      category: ['Bezel'],
      defaultValue: 30,
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Angular spacing between major bezel ticks in degrees.',
    })
    .addSliderInput({
      path: 'bezelMajorTickLength',
      name: 'Major tick length (px)',
      category: ['Bezel'],
      defaultValue: 8,
      settings: { min: 1, max: 40, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Length of major bezel ticks in pixels.',
    })
    .addSliderInput({
      path: 'bezelMajorTickWidth',
      name: 'Major tick width (px)',
      category: ['Bezel'],
      defaultValue: 2,
      settings: { min: 1, max: 10, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    description: 'Thickness of major bezel ticks in pixels.',
    })

    // Hour marks
    .addBooleanSwitch({
      path: 'showHourTicks',
      name: 'Show hour ticks',
      category: ['Hour marks'],
      defaultValue: true,
    description: 'Draw hour markers on the dial (1–12 positions).',
    })
    .addColorPicker({
      path: 'hourTickColor',
      name: 'Tick color',
      category: ['Hour marks'],
      defaultValue: '#000000',
      showIf: (c) => c.showHourTicks,
    description: 'Color of the hour tick marks.',
    })
    .addSliderInput({
      path: 'hourTickLength',
      name: 'Tick length (% of radius)',
      category: ['Hour marks'],
      defaultValue: 18,
      settings: { min: 1, max: 40, step: 1 },
      showIf: (c) => c.showHourTicks,
    description: 'Length of hour tick marks as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'hourTickWidth',
      name: 'Tick width (px)',
      category: ['Hour marks'],
      defaultValue: 8,
      settings: { min: 1, max: 30, step: 1 },
      showIf: (c) => c.showHourTicks,
    description: 'Thickness of hour tick marks in pixels.',
    })
    .addSliderInput({
      path: 'hourTickHeight',
      name: '3D height — shadow cast (px)',
      category: ['Hour marks'],
      defaultValue: 0,
      settings: { min: 0, max: 30, step: 0.5 },
      showIf: (c) => c.showHourTicks,
      description: 'Simulates 3D elevation — casts a shadow using the virtual sun (enable "Cast hand shadows" in Virtual sun section).',
    })
    .addBooleanSwitch({
      path: 'showHourNumbers',
      name: 'Show hour numbers',
      category: ['Hour marks'],
      defaultValue: false,
    description: 'Display hour numerals (1–12) on the dial.',
    })
    .addSelect({
      path: 'hourNumberStyle',
      name: 'Number style',
      category: ['Hour marks'],
      defaultValue: 'arabic',
      settings: { options: HOUR_NUMBER_STYLE_OPTIONS },
      showIf: (c) => c.showHourNumbers,
    description: 'Numeral format: Arabic (1,2,3…), Roman (I,II,III…), or circled variants.',
    })
    .addColorPicker({
      path: 'hourNumberColor',
      name: 'Number color',
      category: ['Hour marks'],
      defaultValue: '#000000',
      showIf: (c) => c.showHourNumbers,
    description: 'Color of the hour numeral text.',
    })
    .addSliderInput({
      path: 'hourNumberFontSize',
      name: 'Number size (% of radius)',
      category: ['Hour marks'],
      defaultValue: 14,
      settings: { min: 4, max: 30, step: 1 },
      showIf: (c) => c.showHourNumbers,
    description: 'Font size of hour numerals as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'hourNumberRadius',
      name: 'Number distance from center (% of radius)',
      category: ['Hour marks'],
      defaultValue: 78,
      settings: { min: 20, max: 100, step: 1 },
      showIf: (c) => c.showHourNumbers,
    description: 'Radial distance of hour numerals from the dial center, as a percentage of radius.',
    })
    .addTextInput({
      path: 'hourNumberFontFamily',
      name: 'Font family',
      category: ['Hour marks'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showHourNumbers,
    description: 'CSS font-family for hour numerals.',
    })

    // Minute marks
    .addBooleanSwitch({
      path: 'showMinuteTicks',
      name: 'Show minute ticks',
      category: ['Minute marks'],
      defaultValue: true,
    description: 'Draw minute markers on the dial (60 positions).',
    })
    .addColorPicker({
      path: 'minuteTickColor',
      name: 'Tick color',
      category: ['Minute marks'],
      defaultValue: '#000000',
      showIf: (c) => c.showMinuteTicks,
    description: 'Color of the minute tick marks.',
    })
    .addSliderInput({
      path: 'minuteTickLength',
      name: 'Tick length (% of radius)',
      category: ['Minute marks'],
      defaultValue: 6,
      settings: { min: 1, max: 25, step: 1 },
      showIf: (c) => c.showMinuteTicks,
    description: 'Length of minute tick marks as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'minuteTickWidth',
      name: 'Tick width (px)',
      category: ['Minute marks'],
      defaultValue: 3,
      settings: { min: 1, max: 15, step: 1 },
      showIf: (c) => c.showMinuteTicks,
    description: 'Thickness of minute tick marks in pixels.',
    })
    .addSliderInput({
      path: 'minuteTickHeight',
      name: '3D height — shadow cast (px)',
      category: ['Minute marks'],
      defaultValue: 0,
      settings: { min: 0, max: 20, step: 0.5 },
      showIf: (c) => c.showMinuteTicks,
      description: 'Simulates 3D elevation — casts a shadow using the virtual sun.',
    })
    .addBooleanSwitch({
      path: 'showMinuteNumbers',
      name: 'Show minute numbers',
      category: ['Minute marks'],
      defaultValue: false,
    description: 'Display minute numerals on the dial.',
    })
    .addColorPicker({
      path: 'minuteNumberColor',
      name: 'Number color',
      category: ['Minute marks'],
      defaultValue: '#555555',
      showIf: (c) => c.showMinuteNumbers,
    description: 'Color of the minute numeral text.',
    })
    .addSliderInput({
      path: 'minuteNumberFontSize',
      name: 'Number size (% of radius)',
      category: ['Minute marks'],
      defaultValue: 7,
      settings: { min: 3, max: 20, step: 1 },
      showIf: (c) => c.showMinuteNumbers,
    description: 'Font size of minute numerals as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'minuteNumberRadius',
      name: 'Number distance from center (% of radius)',
      category: ['Minute marks'],
      defaultValue: 60,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => c.showMinuteNumbers,
    description: 'Radial distance of minute numerals from the dial center.',
    })

    // Second marks
    .addBooleanSwitch({
      path: 'showSecondTicks',
      name: 'Show second ticks',
      category: ['Second marks'],
      defaultValue: false,
    description: 'Draw sub-second markers on the dial.',
    })
    .addColorPicker({
      path: 'secondTickColor',
      name: 'Tick color',
      category: ['Second marks'],
      defaultValue: '#888888',
      showIf: (c) => c.showSecondTicks,
    description: 'Color of the second tick marks.',
    })
    .addSliderInput({
      path: 'secondTickLength',
      name: 'Tick length (% of radius)',
      category: ['Second marks'],
      defaultValue: 4,
      settings: { min: 1, max: 20, step: 1 },
      showIf: (c) => c.showSecondTicks,
    description: 'Length of second tick marks as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'secondTickWidth',
      name: 'Tick width (px)',
      category: ['Second marks'],
      defaultValue: 1,
      settings: { min: 1, max: 10, step: 1 },
      showIf: (c) => c.showSecondTicks,
    description: 'Thickness of second tick marks in pixels.',
    })
    .addSliderInput({
      path: 'secondTickHeight',
      name: '3D height — shadow cast (px)',
      category: ['Second marks'],
      defaultValue: 0,
      settings: { min: 0, max: 15, step: 0.5 },
      showIf: (c) => c.showSecondTicks,
      description: 'Simulates 3D elevation — casts a shadow using the virtual sun.',
    })
    .addBooleanSwitch({
      path: 'showSecondNumbers',
      name: 'Show second numbers',
      category: ['Second marks'],
      defaultValue: false,
    description: 'Display second numerals on the dial.',
    })
    .addColorPicker({
      path: 'secondNumberColor',
      name: 'Number color',
      category: ['Second marks'],
      defaultValue: '#888888',
      showIf: (c) => c.showSecondNumbers,
    description: 'Color of the second numeral text.',
    })
    .addSliderInput({
      path: 'secondNumberFontSize',
      name: 'Number size (% of radius)',
      category: ['Second marks'],
      defaultValue: 5,
      settings: { min: 2, max: 20, step: 1 },
      showIf: (c) => c.showSecondNumbers,
    description: 'Font size of second numerals as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'secondNumberRadius',
      name: 'Number distance from center (% of radius)',
      category: ['Second marks'],
      defaultValue: 45,
      settings: { min: 5, max: 100, step: 1 },
      showIf: (c) => c.showSecondNumbers,
    description: 'Radial distance of second numerals from the dial center.',
    });

  // Hands — registered symmetrically
  registerHand(builder, 'Hour hand', 'hour', {
    color: '#000000',
    length: 60,
    tail: 15,
    width: 12,
    bounceOn: false,
    bounceAmp: -2.4,
  });
  registerHand(builder, 'Minute hand', 'minute', {
    color: '#000000',
    length: 90,
    tail: 20,
    width: 7,
    bounceOn: true,
    bounceAmp: -2.4,
  });
  registerHand(builder, 'Second hand', 'second', {
    color: '#d40000',
    length: 90,
    tail: 30,
    width: 3,
    bounceOn: false,
    bounceAmp: -3,
  });

  builder
    .addColorPicker({
      path: 'centerCapColor',
      name: 'Color',
      category: ['Center cap'],
      defaultValue: '#000000',
    description: 'Color of the center cap that covers the hand pivot point.',
    })
    .addSliderInput({
      path: 'centerCapSize',
      name: 'Size (% of radius)',
      category: ['Center cap'],
      defaultValue: 5,
      settings: { min: 0, max: 20, step: 1 },
    description: 'Radius of the center cap as a percentage of the dial radius. 0 = hidden.',
    });

  // Virtual sun / shadow
  builder
    .addBooleanSwitch({
      path: 'showSunShadow',
      name: 'Cast hand shadows',
      category: ['Virtual sun'],
      defaultValue: false,
      description: 'A virtual sun orbits the dial once per 24 h and casts a shadow behind the hands. Direction and length change with time of day.',
    })
    .addColorPicker({
      path: 'sunShadowColor',
      name: 'Shadow color',
      category: ['Virtual sun'],
      defaultValue: '#000000',
      showIf: (c) => c.showSunShadow,
    description: 'Color of the cast shadow (typically black or a dark tone).',
    })
    .addSliderInput({
      path: 'sunShadowOpacity',
      name: 'Shadow opacity (%)',
      category: ['Virtual sun'],
      defaultValue: 45,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showSunShadow,
    description: 'Opacity of the shadow as a percentage. 0 = invisible, 100 = fully opaque.',
    })
    .addSliderInput({
      path: 'sunShadowBlur',
      name: 'Shadow blur (px)',
      category: ['Virtual sun'],
      defaultValue: 2.5,
      settings: { min: 0, max: 20, step: 0.5 },
      showIf: (c) => c.showSunShadow,
    description: 'Gaussian blur radius of the shadow in pixels. Higher = softer shadow edges.',
    })
    .addSliderInput({
      path: 'sunShadowMinDistance',
      name: 'Min shadow length at noon (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 1,
      settings: { min: 0, max: 30, step: 1 },
      showIf: (c) => c.showSunShadow,
    description: 'Shadow length when the sun is at its highest (noon), as a percentage of radius.',
    })
    .addSliderInput({
      path: 'sunShadowMaxDistance',
      name: 'Max shadow length at horizon (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 6,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => c.showSunShadow,
    description: 'Shadow length when the sun is near the horizon, as a percentage of radius.',
    })
    .addRadio({
      path: 'sunNightBehavior',
      name: 'At night (sun below horizon)',
      category: ['Virtual sun'],
      defaultValue: 'fade',
      settings: {
        options: [
          { value: 'hide', label: 'Hide shadow' },
          { value: 'fade', label: 'Fade with elevation' },
          { value: 'keep', label: 'Keep full strength' },
        ],
      },
      showIf: (c) => c.showSunShadow,
    description: 'What happens to the shadow when the sun is below the horizon: hide, fade with elevation, or keep.',
    })
    .addBooleanSwitch({
      path: 'showSun',
      name: 'Draw sun indicator',
      category: ['Virtual sun'],
      defaultValue: false,
      description: 'Small glowing dot on the dial at the current sun position.',
      showIf: (c) => c.showSunShadow,
    })
    .addColorPicker({
      path: 'sunColor',
      name: 'Sun color',
      category: ['Virtual sun'],
      defaultValue: '#ffcc33',
      showIf: (c) => c.showSunShadow && c.showSun,
    description: 'Color of the visible sun indicator dot.',
    })
    .addSliderInput({
      path: 'sunSize',
      name: 'Sun size (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 4,
      settings: { min: 1, max: 20, step: 1 },
      showIf: (c) => c.showSunShadow && c.showSun,
    description: 'Diameter of the sun indicator as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'sunOrbitRadius',
      name: 'Sun orbit radius (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 80,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => c.showSunShadow && c.showSun,
    description: 'Distance of the sun indicator from the dial center, as a percentage of radius.',
    });

  registerMechanicalMovement(builder);

  // Chronograph subdials — 4 totalizers, each with its own category
  registerSubdial(builder, 1, { distance: 40, angle: 90, label: 'A', handColor: '#d94e1f' });
  registerSubdial(builder, 2, { distance: 40, angle: 180, label: 'B', handColor: '#d94e1f' });
  registerSubdial(builder, 3, { distance: 40, angle: 270, label: 'C', handColor: '#d94e1f' });
  registerSubdial(builder, 4, { distance: 40, angle: 0, label: 'D', handColor: '#d94e1f' });

  registerGlobalMetric(builder);

  const POSITION_OPTIONS = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ];

  // Day-of-week window
  builder
    .addBooleanSwitch({
      path: 'showDayWindow',
      name: 'Show day window',
      category: ['Day window'],
      defaultValue: false,
      description: 'Rectangular cutout with inner shadow showing the day of the week.',
    })
    .addSelect({
      path: 'dayWindowPosition',
      name: 'Position',
      category: ['Day window'],
      defaultValue: 'top',
      settings: { options: POSITION_OPTIONS },
      showIf: (c) => c.showDayWindow,
    description: 'Placement of the day window on the dial (top, bottom, left, right).',
    })
    .addSliderInput({
      path: 'dayWindowDistance',
      name: 'Distance from center (% of radius)',
      category: ['Day window'],
      defaultValue: 55,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showDayWindow,
    description: 'Radial distance of the day window center from the dial center, as a percentage of radius.',
    })
    .addSliderInput({
      path: 'dayWindowWidth',
      name: 'Width (% of radius)',
      category: ['Day window'],
      defaultValue: 40,
      settings: { min: 5, max: 100, step: 1 },
      showIf: (c) => c.showDayWindow,
    description: 'Width of the day window as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'dayWindowHeight',
      name: 'Height (% of radius)',
      category: ['Day window'],
      defaultValue: 15,
      settings: { min: 3, max: 60, step: 1 },
      showIf: (c) => c.showDayWindow,
    description: 'Height of the day window as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'dayWindowCornerRadius',
      name: 'Corner radius (px)',
      category: ['Day window'],
      defaultValue: 3,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => c.showDayWindow,
    description: 'Rounding radius of the window corners in pixels.',
    })
    .addColorPicker({
      path: 'dayWindowBgColor',
      name: 'Background',
      category: ['Day window'],
      defaultValue: '#f4ecd2',
      showIf: (c) => c.showDayWindow,
    description: 'Background fill color of the day window.',
    })
    .addColorPicker({
      path: 'dayWindowTextColor',
      name: 'Text color',
      category: ['Day window'],
      defaultValue: '#2a2a2a',
      showIf: (c) => c.showDayWindow,
    description: 'Text color of the day name.',
    })
    .addSelect({
      path: 'dayWindowFormat',
      name: 'Format',
      category: ['Day window'],
      defaultValue: 'dddd',
      settings: {
        options: [
          { value: 'dddd', label: 'MONDAY' },
          { value: 'ddd', label: 'MON' },
          { value: 'dd', label: 'MO' },
        ],
      },
      showIf: (c) => c.showDayWindow,
    description: 'Day display format: full name (MONDAY), abbreviated (MON), or two-letter (MO).',
    })
    .addBooleanSwitch({
      path: 'dayWindowUppercase',
      name: 'Uppercase',
      category: ['Day window'],
      defaultValue: true,
      showIf: (c) => c.showDayWindow,
    description: 'Force the day text to uppercase.',
    })
    .addTextInput({
      path: 'dayWindowFontFamily',
      name: 'Font family',
      category: ['Day window'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showDayWindow,
    description: 'CSS font-family for the day window text.',
    })
    .addSliderInput({
      path: 'dayWindowFontSize',
      name: 'Font size (% of radius)',
      category: ['Day window'],
      defaultValue: 9,
      settings: { min: 2, max: 30, step: 1 },
      showIf: (c) => c.showDayWindow,
    description: 'Font size of the day text as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'dayWindowBorderColor',
      name: 'Border color',
      category: ['Day window'],
      defaultValue: '#1a1a1a',
      showIf: (c) => c.showDayWindow,
    description: 'Border color of the day window.',
    })
    .addSliderInput({
      path: 'dayWindowBorderWidth',
      name: 'Border width (px)',
      category: ['Day window'],
      defaultValue: 0,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showDayWindow,
    description: 'Border thickness of the day window in pixels.',
    })
    .addBooleanSwitch({
      path: 'dayWindowCurved',
      name: 'Curved (arc cutout)',
      category: ['Day window'],
      defaultValue: false,
      description: 'Render the window as an arc segment so the text follows the dial curvature — as if a day-of-week ring were rotating beneath.',
      showIf: (c) => c.showDayWindow,
    })
    .addSliderInput({
      path: 'dayWindowArcSpan',
      name: 'Arc span (deg)',
      category: ['Day window'],
      defaultValue: 70,
      settings: { min: 10, max: 180, step: 1 },
      showIf: (c) => c.showDayWindow && c.dayWindowCurved,
    description: 'Angular span of the curved window arc in degrees.',
    });

  // Day-of-month window
  builder
    .addBooleanSwitch({
      path: 'showDateWindow',
      name: 'Show date window',
      category: ['Date window'],
      defaultValue: false,
      description: 'Small cutout showing day of month (e.g. "15").',
    })
    .addSelect({
      path: 'dateWindowPosition',
      name: 'Position',
      category: ['Date window'],
      defaultValue: 'bottom',
      settings: { options: POSITION_OPTIONS },
      showIf: (c) => c.showDateWindow,
    description: 'Placement of the date window on the dial (top, bottom, left, right).',
    })
    .addSliderInput({
      path: 'dateWindowDistance',
      name: 'Distance from center (% of radius)',
      category: ['Date window'],
      defaultValue: 40,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showDateWindow,
    description: 'Radial distance of the date window center from the dial center, as a percentage of radius.',
    })
    .addSliderInput({
      path: 'dateWindowWidth',
      name: 'Width (% of radius)',
      category: ['Date window'],
      defaultValue: 18,
      settings: { min: 3, max: 80, step: 1 },
      showIf: (c) => c.showDateWindow,
    description: 'Width of the date window as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'dateWindowHeight',
      name: 'Height (% of radius)',
      category: ['Date window'],
      defaultValue: 15,
      settings: { min: 3, max: 60, step: 1 },
      showIf: (c) => c.showDateWindow,
    description: 'Height of the date window as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'dateWindowCornerRadius',
      name: 'Corner radius (px)',
      category: ['Date window'],
      defaultValue: 3,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => c.showDateWindow,
    description: 'Rounding radius of the date window corners in pixels.',
    })
    .addColorPicker({
      path: 'dateWindowBgColor',
      name: 'Background',
      category: ['Date window'],
      defaultValue: '#f4ecd2',
      showIf: (c) => c.showDateWindow,
    description: 'Background fill color of the date window.',
    })
    .addColorPicker({
      path: 'dateWindowTextColor',
      name: 'Text color',
      category: ['Date window'],
      defaultValue: '#d94e1f',
      showIf: (c) => c.showDateWindow,
    description: 'Text color of the date numeral.',
    })
    .addTextInput({
      path: 'dateWindowFontFamily',
      name: 'Font family',
      category: ['Date window'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showDateWindow,
    description: 'CSS font-family for the date window text.',
    })
    .addSliderInput({
      path: 'dateWindowFontSize',
      name: 'Font size (% of radius)',
      category: ['Date window'],
      defaultValue: 12,
      settings: { min: 2, max: 30, step: 1 },
      showIf: (c) => c.showDateWindow,
    description: 'Font size of the date numeral as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'dateWindowBorderColor',
      name: 'Border color',
      category: ['Date window'],
      defaultValue: '#1a1a1a',
      showIf: (c) => c.showDateWindow,
    description: 'Border color of the date window.',
    })
    .addSliderInput({
      path: 'dateWindowBorderWidth',
      name: 'Border width (px)',
      category: ['Date window'],
      defaultValue: 0,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showDateWindow,
    description: 'Border thickness of the date window in pixels.',
    })
    .addBooleanSwitch({
      path: 'dateWindowCurved',
      name: 'Curved (arc cutout)',
      category: ['Date window'],
      defaultValue: false,
      showIf: (c) => c.showDateWindow,
    description: 'Render the date window as an arc segment following the dial curvature.',
    })
    .addSliderInput({
      path: 'dateWindowArcSpan',
      name: 'Arc span (deg)',
      category: ['Date window'],
      defaultValue: 40,
      settings: { min: 10, max: 180, step: 1 },
      showIf: (c) => c.showDateWindow && c.dateWindowCurved,
    description: 'Angular span of the curved date window arc in degrees.',
    });

  // Vertical rolling date strip
  builder
    .addBooleanSwitch({
      path: 'showRollingDate',
      name: 'Show rolling date',
      category: ['Rolling date'],
      defaultValue: false,
      description: 'Vertical three-row slot: previous / current / next day.',
    })
    .addSelect({
      path: 'rollingDatePosition',
      name: 'Position',
      category: ['Rolling date'],
      defaultValue: 'right',
      settings: { options: POSITION_OPTIONS },
      showIf: (c) => c.showRollingDate,
    description: 'Placement of the rolling date strip on the dial (top, bottom, left, right).',
    })
    .addSliderInput({
      path: 'rollingDateDistance',
      name: 'Distance from center (% of radius)',
      category: ['Rolling date'],
      defaultValue: 45,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showRollingDate,
    description: 'Radial distance of the rolling date center from the dial center, as a percentage of radius.',
    })
    .addSliderInput({
      path: 'rollingDateWidth',
      name: 'Width (% of radius)',
      category: ['Rolling date'],
      defaultValue: 22,
      settings: { min: 5, max: 80, step: 1 },
      showIf: (c) => c.showRollingDate,
    description: 'Width of the rolling date strip as a percentage of the dial radius.',
    })
    .addSliderInput({
      path: 'rollingDateHeight',
      name: 'Height (% of radius)',
      category: ['Rolling date'],
      defaultValue: 38,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => c.showRollingDate,
    description: 'Height of the rolling date strip as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'rollingDateBgColor',
      name: 'Background',
      category: ['Rolling date'],
      defaultValue: '#2a2a2a',
      showIf: (c) => c.showRollingDate,
    description: 'Background fill color of the rolling date window.',
    })
    .addColorPicker({
      path: 'rollingDateTextColor',
      name: 'Text color',
      category: ['Rolling date'],
      defaultValue: '#f4ecd2',
      showIf: (c) => c.showRollingDate,
    description: 'Text color for the previous and next day numbers.',
    })
    .addColorPicker({
      path: 'rollingDateHighlightColor',
      name: 'Current-day highlight',
      category: ['Rolling date'],
      defaultValue: '#3a3a3a',
      showIf: (c) => c.showRollingDate,
    description: 'Background highlight color for the current day row.',
    })
    .addTextInput({
      path: 'rollingDateFontFamily',
      name: 'Font family',
      category: ['Rolling date'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showRollingDate,
    description: 'CSS font-family for the rolling date text.',
    })
    .addSliderInput({
      path: 'rollingDateFontSize',
      name: 'Font size (% of radius)',
      category: ['Rolling date'],
      defaultValue: 14,
      settings: { min: 4, max: 40, step: 1 },
      showIf: (c) => c.showRollingDate,
    description: 'Font size of the date numbers as a percentage of the dial radius.',
    })
    .addColorPicker({
      path: 'rollingDateBorderColor',
      name: 'Border color',
      category: ['Rolling date'],
      defaultValue: '#1a1a1a',
      showIf: (c) => c.showRollingDate,
    description: 'Border color of the rolling date window.',
    })
    .addSliderInput({
      path: 'rollingDateBorderWidth',
      name: 'Border width (px)',
      category: ['Rolling date'],
      defaultValue: 0,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showRollingDate,
    description: 'Border thickness of the rolling date window in pixels.',
    });

  return builder;
}

export const plugin = new PanelPlugin<AlpineClockOptions>(AlpineClockPanel)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  .setDefaults(GRAND_CENTRAL_PANEL_DEFAULTS)
  .setMigrationHandler(migrateAlpineClockPanel)
  .setSuggestionsSupplier(alpineClockSuggestionsSupplier)
  .setPanelOptions((builder) => registerPanelOptions(withDefaultValues(builder, GRAND_CENTRAL_PANEL_DEFAULTS)));
