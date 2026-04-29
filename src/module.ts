import { PanelPlugin, PanelOptionsEditorBuilder } from '@grafana/data';
import { AlpineClockOptions } from './types';
import { AlpineClockPanel } from './components/AlpineClockPanel';
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

  builder
    .addColorPicker({
      path: `${handPath}Color` as any,
      name: 'Color',
      category: cat,
      defaultValue: defaults.color,
    })
    .addSliderInput({
      path: `${handPath}Length` as any,
      name: 'Length from pivot to tip (% of radius)',
      category: cat,
      defaultValue: defaults.length,
      settings: { min: 5, max: 120, step: 1 },
    })
    .addSliderInput({
      path: `${handPath}Tail` as any,
      name: 'Tail from pivot (% of radius)',
      category: cat,
      defaultValue: defaults.tail,
      settings: { min: 0, max: 80, step: 1 },
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
    })
    .addSelect({
      path: `${handPath}Shape` as any,
      name: 'Shape',
      category: cat,
      defaultValue: 'rect',
      settings: { options: HAND_SHAPE_OPTIONS },
    })
    .addBooleanSwitch({
      path: smoothPath as any,
      name: 'Smooth motion',
      category: cat,
      defaultValue: prefix === 'hour',
    })

    // Per-hand counterweight
    .addSelect({
      path: `${cwPrefix}Shape` as any,
      name: 'Counterweight shape',
      category: cat,
      defaultValue: prefix === 'second' ? 'circle' : 'none',
      settings: { options: COUNTERWEIGHT_OPTIONS },
    })
    .addSliderInput({
      path: `${cwPrefix}Size` as any,
      name: 'Counterweight size (% of radius)',
      category: cat,
      defaultValue: 10,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => (c as any)[`${cwPrefix}Shape`] !== 'none',
    })
    .addSliderInput({
      path: `${cwPrefix}Position` as any,
      name: 'Counterweight position along hand (% of radius)',
      category: cat,
      defaultValue: prefix === 'second' ? 65 : -10,
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
    })
    .addNumberInput({
      path: `${bouncePrefix}AmplitudeDeg` as any,
      name: 'Bounce amplitude (deg)',
      category: cat,
      defaultValue: defaults.bounceAmp,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
    })
    .addNumberInput({
      path: `${bouncePrefix}Damping` as any,
      name: 'Damping coefficient',
      category: cat,
      defaultValue: 8,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
    })
    .addNumberInput({
      path: `${bouncePrefix}Frequency` as any,
      name: 'Angular frequency (rad/s)',
      category: cat,
      defaultValue: 30,
      showIf: (c) => (c as any)[bouncePrefix] && !(c as any)[smoothPath],
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
    })
    .addSliderInput({
      path: `subdial${n}Angle` as any,
      name: 'Angle (deg, 0 = up)',
      category: cat,
      defaultValue: defaults.angle,
      settings: { min: 0, max: 360, step: 1 },
      showIf: en,
    })
    .addSliderInput({
      path: `subdial${n}Size` as any,
      name: 'Diameter (% of radius)',
      category: cat,
      defaultValue: 30,
      settings: { min: 5, max: 100, step: 1 },
      showIf: en,
    })
    .addRadio({
      path: `subdial${n}Mode` as any,
      name: 'Display mode',
      category: cat,
      defaultValue: 'analog',
      settings: { options: SUBDIAL_MODE_OPTIONS },
      showIf: en,
    })
    .addColorPicker({
      path: `subdial${n}BgColor` as any,
      name: 'Background',
      category: cat,
      defaultValue: '#f4ecd2',
      showIf: en,
    })
    .addColorPicker({
      path: `subdial${n}BorderColor` as any,
      name: 'Border color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: en,
    })
    .addSliderInput({
      path: `subdial${n}BorderWidth` as any,
      name: 'Border width (px)',
      category: cat,
      defaultValue: 1,
      settings: { min: 0, max: 10, step: 1 },
      showIf: en,
    })
    .addNumberInput({
      path: `subdial${n}Min` as any,
      name: 'Min value',
      category: cat,
      defaultValue: 0,
      showIf: en,
    })
    .addNumberInput({
      path: `subdial${n}Max` as any,
      name: 'Max value',
      category: cat,
      defaultValue: 100,
      showIf: en,
    })
    .addTextInput({
      path: `subdial${n}Label` as any,
      name: 'Label',
      category: cat,
      defaultValue: defaults.label,
      showIf: en,
    })
    .addSelect({
      path: `subdial${n}LabelPosition` as any,
      name: 'Label position',
      category: cat,
      defaultValue: 'inside-bottom',
      settings: { options: SUBDIAL_LABEL_POSITION_OPTIONS },
      showIf: en,
    })
    .addColorPicker({
      path: `subdial${n}LabelColor` as any,
      name: 'Label color',
      category: cat,
      defaultValue: '#2a2a2a',
      showIf: en,
    })
    .addSliderInput({
      path: `subdial${n}LabelFontSize` as any,
      name: 'Label font size (% of subdial radius)',
      category: cat,
      defaultValue: 14,
      settings: { min: 4, max: 40, step: 1 },
      showIf: en,
    })
    .addTextInput({
      path: `subdial${n}Unit` as any,
      name: 'Unit',
      category: cat,
      defaultValue: '',
      showIf: en,
    })
    .addColorPicker({
      path: `subdial${n}HandColor` as any,
      name: 'Hand color',
      category: cat,
      defaultValue: defaults.handColor,
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
    })
    .addSliderInput({
      path: `subdial${n}HandWidth` as any,
      name: 'Hand width (% of subdial radius)',
      category: cat,
      defaultValue: 6,
      settings: { min: 1, max: 30, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
    })
    .addSliderInput({
      path: `subdial${n}TickCount` as any,
      name: 'Tick count',
      category: cat,
      defaultValue: 12,
      settings: { min: 0, max: 60, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
    })
    .addColorPicker({
      path: `subdial${n}TickColor` as any,
      name: 'Tick color',
      category: cat,
      defaultValue: '#2a2a2a',
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
    })
    .addBooleanSwitch({
      path: `subdial${n}ShowNumbers` as any,
      name: 'Show min/mid/max numbers',
      category: cat,
      defaultValue: true,
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog',
    })
    .addColorPicker({
      path: `subdial${n}NumberColor` as any,
      name: 'Number color',
      category: cat,
      defaultValue: '#2a2a2a',
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog' && (c as any)[`subdial${n}ShowNumbers`],
    })
    .addSliderInput({
      path: `subdial${n}NumberFontSize` as any,
      name: 'Number font size (% of subdial radius)',
      category: cat,
      defaultValue: 16,
      settings: { min: 4, max: 40, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'analog' && (c as any)[`subdial${n}ShowNumbers`],
    })
    .addColorPicker({
      path: `subdial${n}DigitalColor` as any,
      name: 'Digital text color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'digital',
    })
    .addSliderInput({
      path: `subdial${n}DigitalFontSize` as any,
      name: 'Digital font size (% of subdial radius)',
      category: cat,
      defaultValue: 40,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => en(c) && (c as any)[`subdial${n}Mode`] === 'digital',
    })
    .addNumberInput({
      path: `subdial${n}Decimals` as any,
      name: 'Decimal places',
      category: cat,
      defaultValue: 0,
      showIf: en,
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
    })
    .addNumberInput({
      path: `subdial${n}Threshold1` as any,
      name: 'Threshold 1 value',
      category: cat,
      defaultValue: 70,
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
    })
    .addColorPicker({
      path: `subdial${n}Threshold1Color` as any,
      name: 'Threshold 1 color',
      category: cat,
      defaultValue: '#e6b800',
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
    })
    .addNumberInput({
      path: `subdial${n}Threshold2` as any,
      name: 'Threshold 2 value',
      category: cat,
      defaultValue: 90,
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
    })
    .addColorPicker({
      path: `subdial${n}Threshold2Color` as any,
      name: 'Threshold 2 color',
      category: cat,
      defaultValue: '#d14343',
      showIf: (c) => en(c) && (c as any)[`subdial${n}ThresholdMode`] !== 'none',
    });
}

/**
 * Register the "Global Metric" gauge overlaid on the main dial. It is one
 * big hand scaled across `gmMin..gmMax`, optional fill arc, optional scale
 * ring, and an optional value readout (window / center / counterweight).
 */
function registerGlobalMetric(builder: PanelOptionsEditorBuilder<AlpineClockOptions>) {
  const cat = ['Global metric'];
  const en = (c: AlpineClockOptions) => c.gmEnabled;
  const gaugeCat = ['Global metric', 'Segmented gauge'];
  const gaugeEn = (c: AlpineClockOptions) => en(c) && c.gmGaugePlacement !== 'none';

  builder
    .addBooleanSwitch({
      path: 'gmEnabled',
      name: 'Enable global metric hand',
      category: cat,
      defaultValue: false,
      description: 'A large fourth hand overlaid on the whole clock that points at a metric value.',
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
    })
    .addNumberInput({
      path: 'gmOffset',
      name: 'Value offset',
      category: cat,
      defaultValue: 0,
      showIf: en,
    })
    .addNumberInput({
      path: 'gmMin',
      name: 'Min value',
      category: cat,
      defaultValue: 0,
      showIf: en,
    })
    .addNumberInput({
      path: 'gmMax',
      name: 'Max value',
      category: cat,
      defaultValue: 100,
      showIf: en,
    })
    .addNumberInput({
      path: 'gmDecimals',
      name: 'Decimal places',
      category: cat,
      defaultValue: 1,
      showIf: en,
    })
    .addTextInput({
      path: 'gmUnit',
      name: 'Unit',
      category: cat,
      defaultValue: '',
      showIf: en,
    })

    // Sweep geometry
    .addSliderInput({
      path: 'gmStartAngle',
      name: 'Sweep start angle (deg, 0 = 12 o\'clock)',
      category: cat,
      defaultValue: -135,
      settings: { min: -360, max: 360, step: 1 },
      showIf: en,
    })
    .addSliderInput({
      path: 'gmSweepAngle',
      name: 'Sweep span (deg from min to max)',
      category: cat,
      defaultValue: 270,
      settings: { min: 30, max: 360, step: 1 },
      showIf: en,
    })
    .addBooleanSwitch({
      path: 'gmSmooth',
      name: 'Smooth value transitions',
      category: cat,
      defaultValue: true,
      showIf: en,
    })

    // Hand geometry
    .addColorPicker({
      path: 'gmHandColor',
      name: 'Hand color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: en,
    })
    .addSliderInput({
      path: 'gmHandLength',
      name: 'Hand length (% of radius)',
      category: cat,
      defaultValue: 78,
      settings: { min: 5, max: 120, step: 1 },
      showIf: en,
    })
    .addSliderInput({
      path: 'gmHandTail',
      name: 'Hand tail (% of radius)',
      category: cat,
      defaultValue: 15,
      settings: { min: 0, max: 80, step: 1 },
      showIf: en,
    })
    .addSliderInput({
      path: 'gmHandPivotOffset',
      name: 'Pivot offset (% of radius)',
      category: cat,
      defaultValue: 0,
      settings: { min: -50, max: 50, step: 1 },
      showIf: en,
    })
    .addSliderInput({
      path: 'gmHandWidth',
      name: 'Hand width (px)',
      category: cat,
      defaultValue: 6,
      settings: { min: 1, max: 40, step: 1 },
      showIf: en,
    })
    .addSelect({
      path: 'gmHandShape',
      name: 'Hand shape',
      category: cat,
      defaultValue: 'pointer',
      settings: { options: HAND_SHAPE_OPTIONS },
      showIf: en,
    })

    // Counterweight
    .addSelect({
      path: 'gmCounterweightShape',
      name: 'Counterweight shape',
      category: cat,
      defaultValue: 'circle',
      settings: { options: COUNTERWEIGHT_OPTIONS },
      showIf: en,
    })
    .addSliderInput({
      path: 'gmCounterweightSize',
      name: 'Counterweight size (% of radius)',
      category: cat,
      defaultValue: 12,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => en(c) && c.gmCounterweightShape !== 'none',
    })
    .addSliderInput({
      path: 'gmCounterweightPosition',
      name: 'Counterweight position (% of radius)',
      category: cat,
      defaultValue: -15,
      settings: { min: -80, max: 120, step: 1 },
      showIf: (c) => en(c) && c.gmCounterweightShape !== 'none',
    })
    .addColorPicker({
      path: 'gmCounterweightColor',
      name: 'Counterweight color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && c.gmCounterweightShape !== 'none',
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
    })
    .addSliderInput({
      path: 'gmArcInnerRadius',
      name: 'Arc inner radius (% of radius)',
      category: cat,
      defaultValue: 72,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    })
    .addSliderInput({
      path: 'gmArcOuterRadius',
      name: 'Arc outer radius (% of radius)',
      category: cat,
      defaultValue: 88,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    })
    .addColorPicker({
      path: 'gmArcColor',
      name: 'Arc color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
    })
    .addSliderInput({
      path: 'gmArcOpacity',
      name: 'Arc opacity (%)',
      category: cat,
      defaultValue: 60,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && (c.gmFillMode === 'arc' || c.gmFillMode === 'both'),
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
    })
    .addNumberInput({
      path: 'gmThreshold1',
      name: 'Threshold 1',
      category: cat,
      defaultValue: 60,
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    })
    .addColorPicker({
      path: 'gmThreshold1Color',
      name: 'Threshold 1 color',
      category: cat,
      defaultValue: '#f4b400',
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    })
    .addNumberInput({
      path: 'gmThreshold2',
      name: 'Threshold 2',
      category: cat,
      defaultValue: 85,
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
    })
    .addColorPicker({
      path: 'gmThreshold2Color',
      name: 'Threshold 2 color',
      category: cat,
      defaultValue: '#d14343',
      showIf: (c) => en(c) && c.gmThresholdMode !== 'none',
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
    })
    .addSliderInput({
      path: 'gmScaleRadius',
      name: 'Scale ring radius (% of radius)',
      category: cat,
      defaultValue: 62,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addSliderInput({
      path: 'gmScaleTickCount',
      name: 'Scale tick count',
      category: cat,
      defaultValue: 10,
      settings: { min: 2, max: 60, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addSliderInput({
      path: 'gmScaleTickLength',
      name: 'Scale tick length (% of radius)',
      category: cat,
      defaultValue: 4,
      settings: { min: 0, max: 30, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addColorPicker({
      path: 'gmScaleTickColor',
      name: 'Scale tick color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addColorPicker({
      path: 'gmScaleNumberColor',
      name: 'Scale number color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addSliderInput({
      path: 'gmScaleNumberFontSize',
      name: 'Scale number font size (% of radius)',
      category: cat,
      defaultValue: 7,
      settings: { min: 2, max: 20, step: 1 },
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addTextInput({
      path: 'gmScaleNumberFontFamily',
      name: 'Scale number font family',
      category: cat,
      defaultValue: 'Arial, sans-serif',
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })
    .addNumberInput({
      path: 'gmScaleDecimals',
      name: 'Scale number decimals',
      category: cat,
      defaultValue: 0,
      showIf: (c) => en(c) && c.gmScaleMode !== 'none',
    })

    // Value display
    .addRadio({
      path: 'gmValueDisplay',
      name: 'Value display',
      category: cat,
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
    })
    .addRadio({
      path: 'gmValueWindowPosition',
      name: 'Window position',
      category: cat,
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
    })
    .addSliderInput({
      path: 'gmValueWindowDistance',
      name: 'Window distance from center (% of radius)',
      category: cat,
      defaultValue: 45,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })
    .addSliderInput({
      path: 'gmValueWindowWidth',
      name: 'Window width (px)',
      category: cat,
      defaultValue: 70,
      settings: { min: 10, max: 400, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })
    .addSliderInput({
      path: 'gmValueWindowHeight',
      name: 'Window height (px)',
      category: cat,
      defaultValue: 28,
      settings: { min: 10, max: 200, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })
    .addColorPicker({
      path: 'gmValueTextColor',
      name: 'Value text color',
      category: cat,
      defaultValue: '#d94e1f',
      showIf: (c) => en(c) && c.gmValueDisplay !== 'none',
    })
    .addColorPicker({
      path: 'gmValueBgColor',
      name: 'Value background',
      category: cat,
      defaultValue: '#ffffff',
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })
    .addColorPicker({
      path: 'gmValueBorderColor',
      name: 'Value border color',
      category: cat,
      defaultValue: '#1a1a1a',
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })
    .addSliderInput({
      path: 'gmValueBorderWidth',
      name: 'Value border width (px)',
      category: cat,
      defaultValue: 1,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })
    .addTextInput({
      path: 'gmValueFontFamily',
      name: 'Value font family',
      category: cat,
      defaultValue: 'Menlo, Monaco, Consolas, monospace',
      showIf: (c) => en(c) && c.gmValueDisplay !== 'none',
    })
    .addSliderInput({
      path: 'gmValueFontSize',
      name: 'Value font size (px)',
      category: cat,
      defaultValue: 16,
      settings: { min: 4, max: 200, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay !== 'none',
    })
    .addSliderInput({
      path: 'gmValueCornerRadius',
      name: 'Value corner radius (px)',
      category: cat,
      defaultValue: 4,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => en(c) && c.gmValueDisplay === 'window',
    })

    // Segmented gauge track
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
    })
    .addSliderInput({
      path: 'gmGaugeStartAngle',
      name: 'Gauge start angle (deg, 0 = 12 o\'clock)',
      category: gaugeCat,
      defaultValue: 225,
      settings: { min: -360, max: 360, step: 1 },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeSweepAngle',
      name: 'Gauge sweep span (deg)',
      category: gaugeCat,
      defaultValue: 180,
      settings: { min: 30, max: 360, step: 1 },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeInnerRadius',
      name: 'Gauge inner radius (% of placement radius)',
      category: gaugeCat,
      defaultValue: 58,
      settings: { min: 0, max: 140, step: 1 },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeOuterRadius',
      name: 'Gauge outer radius (% of placement radius)',
      category: gaugeCat,
      defaultValue: 74,
      settings: { min: 0, max: 160, step: 1 },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeLabelRadius',
      name: 'Label radius (% of placement radius)',
      category: gaugeCat,
      defaultValue: 84,
      settings: { min: 0, max: 180, step: 1 },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeSegmentCount',
      name: 'Segment count',
      category: gaugeCat,
      defaultValue: 30,
      settings: { min: 3, max: 120, step: 1 },
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeSegmentGap',
      name: 'Segment gap (% of segment)',
      category: gaugeCat,
      defaultValue: 32,
      settings: { min: 0, max: 90, step: 1 },
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeActiveColor1',
      name: 'Active gradient start',
      category: gaugeCat,
      defaultValue: '#f3c54b',
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeActiveColor2',
      name: 'Active gradient end',
      category: gaugeCat,
      defaultValue: '#ff6b5f',
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeInactiveColor',
      name: 'Inactive segment color',
      category: gaugeCat,
      defaultValue: '#3a3f47',
      showIf: gaugeEn,
    })
    .addBooleanSwitch({
      path: 'gmGaugeRimEnabled',
      name: 'Show inactive outer rim',
      category: gaugeCat,
      defaultValue: true,
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeRimColor1',
      name: 'Outer rim start color',
      category: gaugeCat,
      defaultValue: '#9cd8d8',
      showIf: (c) => gaugeEn(c) && c.gmGaugeRimEnabled,
    })
    .addColorPicker({
      path: 'gmGaugeRimColor2',
      name: 'Outer rim end color',
      category: gaugeCat,
      defaultValue: '#ff8a3d',
      showIf: (c) => gaugeEn(c) && c.gmGaugeRimEnabled,
    })
    .addSliderInput({
      path: 'gmGaugeRimWidth',
      name: 'Outer rim width (px)',
      category: gaugeCat,
      defaultValue: 2,
      settings: { min: 0, max: 12, step: 0.5 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeRimEnabled,
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
    })
    .addTextInput({
      path: 'gmGaugeLabelFontFamily',
      name: 'Label font family',
      category: gaugeCat,
      defaultValue: 'Arial, sans-serif',
      showIf: gaugeEn,
    })
    .addSliderInput({
      path: 'gmGaugeLabelFontSize',
      name: 'Label font size (% of placement radius)',
      category: gaugeCat,
      defaultValue: 6,
      settings: { min: 2, max: 20, step: 0.5 },
      showIf: gaugeEn,
    })
    .addBooleanSwitch({
      path: 'gmGaugeShowValue',
      name: 'Show centered split value',
      category: gaugeCat,
      defaultValue: true,
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeValueColor',
      name: 'Value color',
      category: gaugeCat,
      defaultValue: '#ffffff',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    })
    .addTextInput({
      path: 'gmGaugeValueFontFamily',
      name: 'Value font family',
      category: gaugeCat,
      defaultValue: 'Arial, sans-serif',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    })
    .addSliderInput({
      path: 'gmGaugeValueFontSize',
      name: 'Value font size (px)',
      category: gaugeCat,
      defaultValue: 36,
      settings: { min: 6, max: 160, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    })
    .addSliderInput({
      path: 'gmGaugeValueYOffset',
      name: 'Value vertical offset (% of placement radius)',
      category: gaugeCat,
      defaultValue: 12,
      settings: { min: -100, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    })
    .addColorPicker({
      path: 'gmGaugeUnitColor',
      name: 'Unit color',
      category: gaugeCat,
      defaultValue: '#d0d5db',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    })
    .addSliderInput({
      path: 'gmGaugeUnitFontSize',
      name: 'Unit font size (px)',
      category: gaugeCat,
      defaultValue: 16,
      settings: { min: 4, max: 80, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowValue,
    })
    .addBooleanSwitch({
      path: 'gmGaugeShowSparkline',
      name: 'Show sparkline',
      category: gaugeCat,
      defaultValue: false,
      showIf: gaugeEn,
    })
    .addColorPicker({
      path: 'gmGaugeSparklineColor',
      name: 'Sparkline stroke color',
      category: gaugeCat,
      defaultValue: '#ff6b5f',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    })
    .addColorPicker({
      path: 'gmGaugeSparklineFillColor',
      name: 'Sparkline fill color',
      category: gaugeCat,
      defaultValue: '#ff6b5f',
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    })
    .addSliderInput({
      path: 'gmGaugeSparklineOpacity',
      name: 'Sparkline fill opacity (%)',
      category: gaugeCat,
      defaultValue: 35,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    })
    .addSliderInput({
      path: 'gmGaugeSparklineWidth',
      name: 'Sparkline width (% of placement radius)',
      category: gaugeCat,
      defaultValue: 82,
      settings: { min: 10, max: 160, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    })
    .addSliderInput({
      path: 'gmGaugeSparklineHeight',
      name: 'Sparkline height (% of placement radius)',
      category: gaugeCat,
      defaultValue: 20,
      settings: { min: 2, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    })
    .addSliderInput({
      path: 'gmGaugeSparklineYOffset',
      name: 'Sparkline vertical offset (% of placement radius)',
      category: gaugeCat,
      defaultValue: 42,
      settings: { min: -100, max: 100, step: 1 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
    })
    .addSliderInput({
      path: 'gmGaugeSparklineStrokeWidth',
      name: 'Sparkline stroke width (px)',
      category: gaugeCat,
      defaultValue: 2,
      settings: { min: 0.5, max: 10, step: 0.5 },
      showIf: (c) => gaugeEn(c) && c.gmGaugeShowSparkline,
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
    })
    .addSliderInput({
      path: 'mechanicalMovementDialOpacity',
      name: 'Transparent dial tint opacity (%)',
      category: cat,
      defaultValue: 16,
      settings: { min: 0, max: 100, step: 1 },
      showIf: en,
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
      showIf: en,
    })
    .addColorPicker({
      path: 'mechanicalMovementMetalColor',
      name: 'Wheel metal color',
      category: cat,
      defaultValue: '#b9a27c',
      showIf: en,
    })
    .addColorPicker({
      path: 'mechanicalMovementBridgeColor',
      name: 'Bridge / plate color',
      category: cat,
      defaultValue: '#635141',
      showIf: en,
    })
    .addColorPicker({
      path: 'mechanicalMovementJewelColor',
      name: 'Jewel accent color',
      category: cat,
      defaultValue: '#cb5a6a',
      showIf: en,
    });
}

export const plugin = new PanelPlugin<AlpineClockOptions>(AlpineClockPanel).setPanelOptions((builder) => {
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
    })
    .addNumberInput({
      path: 'pauseMs',
      name: 'Pause duration (ms)',
      category: ['Time'],
      defaultValue: 1500,
      showIf: (c) => c.stopToGo,
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
    })
    .addSliderInput({
      path: 'dialWidthFactor',
      name: 'Width factor (% of panel)',
      category: ['Dial'],
      defaultValue: 95,
      settings: { min: 10, max: 100, step: 1 },
    })
    .addSliderInput({
      path: 'dialHeightFactor',
      name: 'Height factor (% of panel)',
      category: ['Dial'],
      defaultValue: 95,
      settings: { min: 10, max: 100, step: 1 },
    })
    .addSliderInput({
      path: 'dialCornerRadius',
      name: 'Corner radius (px)',
      category: ['Dial'],
      defaultValue: 0,
      settings: { min: 0, max: 120, step: 1 },
      showIf: (c) => c.dialShape === 'square' || c.dialShape === 'rect-h' || c.dialShape === 'rect-v',
    })
    .addColorPicker({
      path: 'dialBackground',
      name: 'Background color',
      category: ['Dial'],
      defaultValue: '#ffffff',
    })
    .addColorPicker({
      path: 'dialBorderColor',
      name: 'Border color',
      category: ['Dial'],
      defaultValue: '#1a1a1a',
    })
    .addSliderInput({
      path: 'dialBorderWidth',
      name: 'Border width',
      category: ['Dial'],
      defaultValue: 0,
      settings: { min: 0, max: 20, step: 1 },
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
    })
    .addColorPicker({
      path: 'dialColor2',
      name: 'Second color',
      category: ['Dial'],
      defaultValue: '#333333',
      showIf: (c) => c.dialFillMode !== 'solid' && !c.dialGradientFade,
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
    })
    .addSliderInput({
      path: 'dialGradientCenterX',
      name: 'Radial center X (%)',
      category: ['Dial'],
      defaultValue: 50,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    })
    .addSliderInput({
      path: 'dialGradientCenterY',
      name: 'Radial center Y (%)',
      category: ['Dial'],
      defaultValue: 50,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    })
    .addSliderInput({
      path: 'dialGradientInnerStop',
      name: 'Radial inner stop (%)',
      category: ['Dial'],
      defaultValue: 0,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    })
    .addSliderInput({
      path: 'dialGradientOuterStop',
      name: 'Radial outer stop (%)',
      category: ['Dial'],
      defaultValue: 100,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.dialFillMode === 'radial',
    });

  registerMechanicalMovement(builder);

  builder

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
    })
    .addColorPicker({
      path: 'bezelBackground',
      name: 'Background',
      category: ['Bezel'],
      defaultValue: '#2a2a2a',
      showIf: (c) => c.showBezel,
    })
    .addColorPicker({
      path: 'bezelBorderColor',
      name: 'Border color',
      category: ['Bezel'],
      defaultValue: '#000000',
      showIf: (c) => c.showBezel,
    })
    .addSliderInput({
      path: 'bezelBorderWidth',
      name: 'Border width (px)',
      category: ['Bezel'],
      defaultValue: 1,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showBezel,
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
    })
    .addSliderInput({
      path: 'bezelRotationOffset',
      name: 'Rotation offset (deg)',
      category: ['Bezel'],
      defaultValue: 0,
      settings: { min: -180, max: 180, step: 1 },
      showIf: (c) => c.showBezel,
    })
    .addColorPicker({
      path: 'bezelNumberColor',
      name: 'Number color',
      category: ['Bezel'],
      defaultValue: '#ffffff',
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    })
    .addTextInput({
      path: 'bezelNumberFontFamily',
      name: 'Font family',
      category: ['Bezel'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    })
    .addSliderInput({
      path: 'bezelNumberFontSize',
      name: 'Number font size (% of radius)',
      category: ['Bezel'],
      defaultValue: 7,
      settings: { min: 2, max: 25, step: 1 },
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
    })
    .addSliderInput({
      path: 'bezelNumberRadius',
      name: 'Number position in ring (% of thickness)',
      category: ['Bezel'],
      defaultValue: 50,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showBezel && c.bezelNumbersMode !== 'none',
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
    })
    .addColorPicker({
      path: 'bezelTickColor',
      name: 'Tick color',
      category: ['Bezel'],
      defaultValue: '#ffffff',
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })
    .addNumberInput({
      path: 'bezelTickStepDeg',
      name: 'Minor tick step (deg)',
      category: ['Bezel'],
      defaultValue: 6,
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })
    .addSliderInput({
      path: 'bezelTickLength',
      name: 'Minor tick length (px)',
      category: ['Bezel'],
      defaultValue: 4,
      settings: { min: 1, max: 40, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })
    .addSliderInput({
      path: 'bezelTickWidth',
      name: 'Minor tick width (px)',
      category: ['Bezel'],
      defaultValue: 1,
      settings: { min: 1, max: 10, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })
    .addNumberInput({
      path: 'bezelMajorTickStepDeg',
      name: 'Major tick step (deg)',
      category: ['Bezel'],
      defaultValue: 30,
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })
    .addSliderInput({
      path: 'bezelMajorTickLength',
      name: 'Major tick length (px)',
      category: ['Bezel'],
      defaultValue: 8,
      settings: { min: 1, max: 40, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })
    .addSliderInput({
      path: 'bezelMajorTickWidth',
      name: 'Major tick width (px)',
      category: ['Bezel'],
      defaultValue: 2,
      settings: { min: 1, max: 10, step: 1 },
      showIf: (c) => c.showBezel && c.showBezelTicks,
    })

    // Hour indices
    .addBooleanSwitch({
      path: 'showHourTicks',
      name: 'Show hour ticks',
      category: ['Hour indices'],
      defaultValue: true,
    })
    .addColorPicker({
      path: 'hourTickColor',
      name: 'Tick color',
      category: ['Hour indices'],
      defaultValue: '#000000',
      showIf: (c) => c.showHourTicks,
    })
    .addSliderInput({
      path: 'hourTickLength',
      name: 'Tick length (% of radius)',
      category: ['Hour indices'],
      defaultValue: 18,
      settings: { min: 1, max: 40, step: 1 },
      showIf: (c) => c.showHourTicks,
    })
    .addSliderInput({
      path: 'hourTickWidth',
      name: 'Tick width (px)',
      category: ['Hour indices'],
      defaultValue: 8,
      settings: { min: 1, max: 30, step: 1 },
      showIf: (c) => c.showHourTicks,
    })
    .addSliderInput({
      path: 'hourTickHeight',
      name: 'Index height / shadow length (px)',
      category: ['Hour indices'],
      defaultValue: 0,
      settings: { min: 0, max: 30, step: 0.5 },
      showIf: (c) => c.showHourTicks,
      description: 'Simulates 3D elevation — casts a shadow using the virtual sun (enable "Cast hand shadows" in Virtual sun section).',
    })
    .addBooleanSwitch({
      path: 'showHourNumbers',
      name: 'Show hour numbers',
      category: ['Hour indices'],
      defaultValue: false,
    })
    .addSelect({
      path: 'hourNumberStyle',
      name: 'Number style',
      category: ['Hour indices'],
      defaultValue: 'arabic',
      settings: { options: HOUR_NUMBER_STYLE_OPTIONS },
      showIf: (c) => c.showHourNumbers,
    })
    .addColorPicker({
      path: 'hourNumberColor',
      name: 'Number color',
      category: ['Hour indices'],
      defaultValue: '#000000',
      showIf: (c) => c.showHourNumbers,
    })
    .addSliderInput({
      path: 'hourNumberFontSize',
      name: 'Number size (% of radius)',
      category: ['Hour indices'],
      defaultValue: 14,
      settings: { min: 4, max: 30, step: 1 },
      showIf: (c) => c.showHourNumbers,
    })
    .addSliderInput({
      path: 'hourNumberRadius',
      name: 'Number distance from center (% of radius)',
      category: ['Hour indices'],
      defaultValue: 78,
      settings: { min: 20, max: 100, step: 1 },
      showIf: (c) => c.showHourNumbers,
    })
    .addTextInput({
      path: 'hourNumberFontFamily',
      name: 'Font family',
      category: ['Hour indices'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showHourNumbers,
    })

    // Minute indices
    .addBooleanSwitch({
      path: 'showMinuteTicks',
      name: 'Show minute ticks',
      category: ['Minute indices'],
      defaultValue: true,
    })
    .addColorPicker({
      path: 'minuteTickColor',
      name: 'Tick color',
      category: ['Minute indices'],
      defaultValue: '#000000',
      showIf: (c) => c.showMinuteTicks,
    })
    .addSliderInput({
      path: 'minuteTickLength',
      name: 'Tick length (% of radius)',
      category: ['Minute indices'],
      defaultValue: 6,
      settings: { min: 1, max: 25, step: 1 },
      showIf: (c) => c.showMinuteTicks,
    })
    .addSliderInput({
      path: 'minuteTickWidth',
      name: 'Tick width (px)',
      category: ['Minute indices'],
      defaultValue: 3,
      settings: { min: 1, max: 15, step: 1 },
      showIf: (c) => c.showMinuteTicks,
    })
    .addSliderInput({
      path: 'minuteTickHeight',
      name: 'Index height / shadow length (px)',
      category: ['Minute indices'],
      defaultValue: 0,
      settings: { min: 0, max: 20, step: 0.5 },
      showIf: (c) => c.showMinuteTicks,
      description: 'Simulates 3D elevation — casts a shadow using the virtual sun.',
    })
    .addBooleanSwitch({
      path: 'showMinuteNumbers',
      name: 'Show minute numbers',
      category: ['Minute indices'],
      defaultValue: false,
    })
    .addColorPicker({
      path: 'minuteNumberColor',
      name: 'Number color',
      category: ['Minute indices'],
      defaultValue: '#555555',
      showIf: (c) => c.showMinuteNumbers,
    })
    .addSliderInput({
      path: 'minuteNumberFontSize',
      name: 'Number size (% of radius)',
      category: ['Minute indices'],
      defaultValue: 7,
      settings: { min: 3, max: 20, step: 1 },
      showIf: (c) => c.showMinuteNumbers,
    })
    .addSliderInput({
      path: 'minuteNumberRadius',
      name: 'Number distance from center (% of radius)',
      category: ['Minute indices'],
      defaultValue: 60,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => c.showMinuteNumbers,
    })

    // Second indices
    .addBooleanSwitch({
      path: 'showSecondTicks',
      name: 'Show second ticks',
      category: ['Second indices'],
      defaultValue: false,
    })
    .addColorPicker({
      path: 'secondTickColor',
      name: 'Tick color',
      category: ['Second indices'],
      defaultValue: '#888888',
      showIf: (c) => c.showSecondTicks,
    })
    .addSliderInput({
      path: 'secondTickLength',
      name: 'Tick length (% of radius)',
      category: ['Second indices'],
      defaultValue: 4,
      settings: { min: 1, max: 20, step: 1 },
      showIf: (c) => c.showSecondTicks,
    })
    .addSliderInput({
      path: 'secondTickWidth',
      name: 'Tick width (px)',
      category: ['Second indices'],
      defaultValue: 1,
      settings: { min: 1, max: 10, step: 1 },
      showIf: (c) => c.showSecondTicks,
    })
    .addSliderInput({
      path: 'secondTickHeight',
      name: 'Index height / shadow length (px)',
      category: ['Second indices'],
      defaultValue: 0,
      settings: { min: 0, max: 15, step: 0.5 },
      showIf: (c) => c.showSecondTicks,
      description: 'Simulates 3D elevation — casts a shadow using the virtual sun.',
    })
    .addBooleanSwitch({
      path: 'showSecondNumbers',
      name: 'Show second numbers',
      category: ['Second indices'],
      defaultValue: false,
    })
    .addColorPicker({
      path: 'secondNumberColor',
      name: 'Number color',
      category: ['Second indices'],
      defaultValue: '#888888',
      showIf: (c) => c.showSecondNumbers,
    })
    .addSliderInput({
      path: 'secondNumberFontSize',
      name: 'Number size (% of radius)',
      category: ['Second indices'],
      defaultValue: 5,
      settings: { min: 2, max: 20, step: 1 },
      showIf: (c) => c.showSecondNumbers,
    })
    .addSliderInput({
      path: 'secondNumberRadius',
      name: 'Number distance from center (% of radius)',
      category: ['Second indices'],
      defaultValue: 45,
      settings: { min: 5, max: 100, step: 1 },
      showIf: (c) => c.showSecondNumbers,
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
    })
    .addSliderInput({
      path: 'centerCapSize',
      name: 'Size (% of radius)',
      category: ['Center cap'],
      defaultValue: 5,
      settings: { min: 0, max: 20, step: 1 },
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
    })
    .addSliderInput({
      path: 'sunShadowOpacity',
      name: 'Shadow opacity (%)',
      category: ['Virtual sun'],
      defaultValue: 45,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showSunShadow,
    })
    .addSliderInput({
      path: 'sunShadowBlur',
      name: 'Shadow blur (px)',
      category: ['Virtual sun'],
      defaultValue: 2.5,
      settings: { min: 0, max: 20, step: 0.5 },
      showIf: (c) => c.showSunShadow,
    })
    .addSliderInput({
      path: 'sunShadowMinDistance',
      name: 'Min shadow length at noon (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 1,
      settings: { min: 0, max: 30, step: 1 },
      showIf: (c) => c.showSunShadow,
    })
    .addSliderInput({
      path: 'sunShadowMaxDistance',
      name: 'Max shadow length at horizon (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 6,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => c.showSunShadow,
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
    })
    .addSliderInput({
      path: 'sunSize',
      name: 'Sun size (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 4,
      settings: { min: 1, max: 20, step: 1 },
      showIf: (c) => c.showSunShadow && c.showSun,
    })
    .addSliderInput({
      path: 'sunOrbitRadius',
      name: 'Sun orbit radius (% of radius)',
      category: ['Virtual sun'],
      defaultValue: 80,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => c.showSunShadow && c.showSun,
    });

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
    })
    .addSliderInput({
      path: 'dayWindowDistance',
      name: 'Distance from center (% of radius)',
      category: ['Day window'],
      defaultValue: 55,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showDayWindow,
    })
    .addSliderInput({
      path: 'dayWindowWidth',
      name: 'Width (% of radius)',
      category: ['Day window'],
      defaultValue: 40,
      settings: { min: 5, max: 100, step: 1 },
      showIf: (c) => c.showDayWindow,
    })
    .addSliderInput({
      path: 'dayWindowHeight',
      name: 'Height (% of radius)',
      category: ['Day window'],
      defaultValue: 15,
      settings: { min: 3, max: 60, step: 1 },
      showIf: (c) => c.showDayWindow,
    })
    .addSliderInput({
      path: 'dayWindowCornerRadius',
      name: 'Corner radius (px)',
      category: ['Day window'],
      defaultValue: 3,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => c.showDayWindow,
    })
    .addColorPicker({
      path: 'dayWindowBgColor',
      name: 'Background',
      category: ['Day window'],
      defaultValue: '#f4ecd2',
      showIf: (c) => c.showDayWindow,
    })
    .addColorPicker({
      path: 'dayWindowTextColor',
      name: 'Text color',
      category: ['Day window'],
      defaultValue: '#2a2a2a',
      showIf: (c) => c.showDayWindow,
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
    })
    .addBooleanSwitch({
      path: 'dayWindowUppercase',
      name: 'Uppercase',
      category: ['Day window'],
      defaultValue: true,
      showIf: (c) => c.showDayWindow,
    })
    .addTextInput({
      path: 'dayWindowFontFamily',
      name: 'Font family',
      category: ['Day window'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showDayWindow,
    })
    .addSliderInput({
      path: 'dayWindowFontSize',
      name: 'Font size (% of radius)',
      category: ['Day window'],
      defaultValue: 9,
      settings: { min: 2, max: 30, step: 1 },
      showIf: (c) => c.showDayWindow,
    })
    .addColorPicker({
      path: 'dayWindowBorderColor',
      name: 'Border color',
      category: ['Day window'],
      defaultValue: '#1a1a1a',
      showIf: (c) => c.showDayWindow,
    })
    .addSliderInput({
      path: 'dayWindowBorderWidth',
      name: 'Border width (px)',
      category: ['Day window'],
      defaultValue: 0,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showDayWindow,
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
    })
    .addSliderInput({
      path: 'dateWindowDistance',
      name: 'Distance from center (% of radius)',
      category: ['Date window'],
      defaultValue: 40,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showDateWindow,
    })
    .addSliderInput({
      path: 'dateWindowWidth',
      name: 'Width (% of radius)',
      category: ['Date window'],
      defaultValue: 18,
      settings: { min: 3, max: 80, step: 1 },
      showIf: (c) => c.showDateWindow,
    })
    .addSliderInput({
      path: 'dateWindowHeight',
      name: 'Height (% of radius)',
      category: ['Date window'],
      defaultValue: 15,
      settings: { min: 3, max: 60, step: 1 },
      showIf: (c) => c.showDateWindow,
    })
    .addSliderInput({
      path: 'dateWindowCornerRadius',
      name: 'Corner radius (px)',
      category: ['Date window'],
      defaultValue: 3,
      settings: { min: 0, max: 40, step: 1 },
      showIf: (c) => c.showDateWindow,
    })
    .addColorPicker({
      path: 'dateWindowBgColor',
      name: 'Background',
      category: ['Date window'],
      defaultValue: '#f4ecd2',
      showIf: (c) => c.showDateWindow,
    })
    .addColorPicker({
      path: 'dateWindowTextColor',
      name: 'Text color',
      category: ['Date window'],
      defaultValue: '#d94e1f',
      showIf: (c) => c.showDateWindow,
    })
    .addTextInput({
      path: 'dateWindowFontFamily',
      name: 'Font family',
      category: ['Date window'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showDateWindow,
    })
    .addSliderInput({
      path: 'dateWindowFontSize',
      name: 'Font size (% of radius)',
      category: ['Date window'],
      defaultValue: 12,
      settings: { min: 2, max: 30, step: 1 },
      showIf: (c) => c.showDateWindow,
    })
    .addColorPicker({
      path: 'dateWindowBorderColor',
      name: 'Border color',
      category: ['Date window'],
      defaultValue: '#1a1a1a',
      showIf: (c) => c.showDateWindow,
    })
    .addSliderInput({
      path: 'dateWindowBorderWidth',
      name: 'Border width (px)',
      category: ['Date window'],
      defaultValue: 0,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showDateWindow,
    })
    .addBooleanSwitch({
      path: 'dateWindowCurved',
      name: 'Curved (arc cutout)',
      category: ['Date window'],
      defaultValue: false,
      showIf: (c) => c.showDateWindow,
    })
    .addSliderInput({
      path: 'dateWindowArcSpan',
      name: 'Arc span (deg)',
      category: ['Date window'],
      defaultValue: 40,
      settings: { min: 10, max: 180, step: 1 },
      showIf: (c) => c.showDateWindow && c.dateWindowCurved,
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
    })
    .addSliderInput({
      path: 'rollingDateDistance',
      name: 'Distance from center (% of radius)',
      category: ['Rolling date'],
      defaultValue: 45,
      settings: { min: 0, max: 100, step: 1 },
      showIf: (c) => c.showRollingDate,
    })
    .addSliderInput({
      path: 'rollingDateWidth',
      name: 'Width (% of radius)',
      category: ['Rolling date'],
      defaultValue: 22,
      settings: { min: 5, max: 80, step: 1 },
      showIf: (c) => c.showRollingDate,
    })
    .addSliderInput({
      path: 'rollingDateHeight',
      name: 'Height (% of radius)',
      category: ['Rolling date'],
      defaultValue: 38,
      settings: { min: 10, max: 100, step: 1 },
      showIf: (c) => c.showRollingDate,
    })
    .addColorPicker({
      path: 'rollingDateBgColor',
      name: 'Background',
      category: ['Rolling date'],
      defaultValue: '#2a2a2a',
      showIf: (c) => c.showRollingDate,
    })
    .addColorPicker({
      path: 'rollingDateTextColor',
      name: 'Text color',
      category: ['Rolling date'],
      defaultValue: '#f4ecd2',
      showIf: (c) => c.showRollingDate,
    })
    .addColorPicker({
      path: 'rollingDateHighlightColor',
      name: 'Current-day highlight',
      category: ['Rolling date'],
      defaultValue: '#3a3a3a',
      showIf: (c) => c.showRollingDate,
    })
    .addTextInput({
      path: 'rollingDateFontFamily',
      name: 'Font family',
      category: ['Rolling date'],
      defaultValue: 'Helvetica, Arial, sans-serif',
      showIf: (c) => c.showRollingDate,
    })
    .addSliderInput({
      path: 'rollingDateFontSize',
      name: 'Font size (% of radius)',
      category: ['Rolling date'],
      defaultValue: 14,
      settings: { min: 4, max: 40, step: 1 },
      showIf: (c) => c.showRollingDate,
    })
    .addColorPicker({
      path: 'rollingDateBorderColor',
      name: 'Border color',
      category: ['Rolling date'],
      defaultValue: '#1a1a1a',
      showIf: (c) => c.showRollingDate,
    })
    .addSliderInput({
      path: 'rollingDateBorderWidth',
      name: 'Border width (px)',
      category: ['Rolling date'],
      defaultValue: 0,
      settings: { min: 0, max: 10, step: 1 },
      showIf: (c) => c.showRollingDate,
    });

  return builder;
});
