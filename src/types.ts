export type CounterweightShape = 'none' | 'circle' | 'square' | 'diamond' | 'ring';

export type SubdialMode = 'analog' | 'digital';
export type SubdialLabelPosition = 'none' | 'inside-top' | 'inside-bottom' | 'outer-top' | 'outer-bottom';
export type SubdialReducer =
  | 'last'
  | 'lastNotNull'
  | 'mean'
  | 'min'
  | 'max'
  | 'sum'
  | 'first'
  | 'count';

export type SubdialThresholdMode = 'none' | 'value' | 'background' | 'both';
export type GlobalMetricGaugePlacement = 'none' | 'dial' | 'bezel';
export type GlobalMetricGaugeStyle = 'flat' | 'mechanical';
export type MechanicalMovementMode = 'off' | 'skeleton';
export type MechanicalMovementDriveMode = 'run' | 'wind' | 'set-time';
export type HourNumberStyle = 'arabic' | 'roman' | 'circled-arabic' | 'circled-roman';

export type DialShape =
  | 'round'     // Circle
  | 'oval-h'    // Horizontal ellipse
  | 'oval-v'    // Vertical ellipse
  | 'square'    // Square with equal sides
  | 'rect-h'    // Horizontal rectangle
  | 'rect-v'    // Vertical rectangle
  | 'hex-flat'  // Hexagon with flat top
  | 'hex-point'; // Hexagon with pointy top

export type HandShape =
  | 'rect'      // Classic rectangle
  | 'taper'     // Tapered toward tip (wider at pivot)
  | 'lozenge'   // Diamond/spindle
  | 'pointer'   // Narrow body with triangular tip
  | 'sword'     // Long tapered blade with cross-guard near pivot
  | 'dauphine'  // Faceted faceted triangle with ridge line
  | 'breguet'   // Pointer with a round "moon" ring near tip
  | 'alpha'     // Elongated leaf
  | 'syringe'   // Narrow body with luminous circle mid-way
  | 'arrow'     // Triangular arrowhead on a shaft
  | 'baton'     // Rounded-end plain stick
  | 'leaf'      // Curved bulge (Bezier edges)
  | 'skeleton'  // Outlined rectangle (hollow)
  | 'spade';    // Diamond with rounded shoulders

/** Common geometry & style for a single hand, including its own counterweight and bounce. */
export interface HandOptions {
  color: string;
  length: number;       // % of radius, distance from pivot to tip
  tail: number;         // % of radius, distance from pivot to back end
  pivotOffset: number;  // % of radius, shifts pivot along the hand axis (0 = dial center)
  width: number;        // px
  shape: HandShape;
  smooth: boolean;

  // Per-hand counterweight
  counterweightShape: CounterweightShape;
  counterweightSize: number;     // % of radius
  counterweightPosition: number; // % of radius, + toward tip / - toward tail
  counterweightColor: string;

  // Damped harmonic oscillation on each discrete tick of this hand
  bounce: boolean;
  bounceDurationMs: number;
  bounceAmplitudeDeg: number;
  bounceDamping: number;    // ζ
  bounceFrequency: number;  // ω, rad/s
}

export interface AlpineClockOptions {
  // Time source
  timezone: string;
  useQueryTime: boolean;

  // Stop-to-go second-hand behaviour
  stopToGo: boolean;
  sweepMs: number;
  pauseMs: number;

  // Dial
  dialShape: DialShape;
  dialWidthFactor: number;
  dialHeightFactor: number;
  dialCornerRadius: number;
  dialBackground: string;
  dialBorderColor: string;
  dialBorderWidth: number;

  // Bezel (outer ring / lunette)
  showBezel: boolean;
  bezelThickness: number;       // % of half-extent (radius)
  bezelBackground: string;
  bezelBorderColor: string;
  bezelBorderWidth: number;
  // Bezel markings
  bezelNumbersMode: 'none' | '12' | '24' | '60' | '60-all';
  bezelRotationOffset: number;  // deg, rotates entire bezel scale
  bezelNumberColor: string;
  bezelNumberFontFamily: string;
  bezelNumberFontSize: number;  // % of radius
  bezelNumberRadius: number;    // % of bezel thickness, 0 = inner edge, 100 = outer edge
  bezelNumberUpright: boolean;  // keep numbers always upright (not tangential)
  showBezelTicks: boolean;
  bezelTickStepDeg: number;     // tick every N degrees
  bezelTickColor: string;
  bezelTickLength: number;      // px
  bezelTickWidth: number;       // px
  bezelMajorTickStepDeg: number; // major ticks every N degrees
  bezelMajorTickLength: number;  // px
  bezelMajorTickWidth: number;   // px

  // Dial fill mode
  dialFillMode: 'solid' | 'linear' | 'radial';
  dialColor2: string;
  dialGradientFade: boolean;      // true = dialColor2 ignored, outer becomes transparent
  dialGradientAngle: number;      // linear only, 0-360°
  dialGradientCenterX: number;    // radial only, 0-100%
  dialGradientCenterY: number;    // radial only, 0-100%
  dialGradientInnerStop: number;  // radial only, 0-100% (solid core)
  dialGradientOuterStop: number;  // radial only, 0-100% (end of gradient)

  // Hour indices
  showHourTicks: boolean;
  hourTickColor: string;
  hourTickLength: number;
  hourTickWidth: number;
  hourTickHeight: number;     // px — 3D elevation for virtual-sun shadow; 0 = flat
  showHourNumbers: boolean;
  hourNumberStyle: HourNumberStyle;
  hourNumberFontSize: number;
  hourNumberColor: string;
  hourNumberFontFamily: string;
  hourNumberRadius: number;

  // Minute indices
  showMinuteTicks: boolean;
  minuteTickColor: string;
  minuteTickLength: number;
  minuteTickWidth: number;
  minuteTickHeight: number;   // px — 3D elevation for virtual-sun shadow; 0 = flat
  showMinuteNumbers: boolean;
  minuteNumberFontSize: number;
  minuteNumberColor: string;
  minuteNumberRadius: number;

  // Second indices
  showSecondTicks: boolean;
  secondTickColor: string;
  secondTickLength: number;
  secondTickWidth: number;
  secondTickHeight: number;   // px — 3D elevation for virtual-sun shadow; 0 = flat
  showSecondNumbers: boolean;
  secondNumberFontSize: number;
  secondNumberColor: string;
  secondNumberRadius: number;

  // Hour hand
  hourHandColor: string;
  hourHandLength: number;
  hourHandTail: number;
  hourHandPivotOffset: number;
  hourHandWidth: number;
  hourHandShape: HandShape;
  smoothHourHand: boolean;
  hourCounterweightShape: CounterweightShape;
  hourCounterweightSize: number;
  hourCounterweightPosition: number;
  hourCounterweightColor: string;
  hourBounce: boolean;
  hourBounceDurationMs: number;
  hourBounceAmplitudeDeg: number;
  hourBounceDamping: number;
  hourBounceFrequency: number;

  // Minute hand
  minuteHandColor: string;
  minuteHandLength: number;
  minuteHandTail: number;
  minuteHandPivotOffset: number;
  minuteHandWidth: number;
  minuteHandShape: HandShape;
  smoothMinuteHand: boolean;
  minuteCounterweightShape: CounterweightShape;
  minuteCounterweightSize: number;
  minuteCounterweightPosition: number;
  minuteCounterweightColor: string;
  minuteBounce: boolean;
  minuteBounceDurationMs: number;
  minuteBounceAmplitudeDeg: number;
  minuteBounceDamping: number;
  minuteBounceFrequency: number;

  // Second hand
  secondHandColor: string;
  secondHandLength: number;
  secondHandTail: number;
  secondHandPivotOffset: number;
  secondHandWidth: number;
  secondHandShape: HandShape;
  secondCounterweightShape: CounterweightShape;
  secondCounterweightSize: number;
  secondCounterweightPosition: number;
  secondCounterweightColor: string;
  secondBounce: boolean;
  secondBounceDurationMs: number;
  secondBounceAmplitudeDeg: number;
  secondBounceDamping: number;
  secondBounceFrequency: number;

  // Center cap
  centerCapColor: string;
  centerCapSize: number;

  // Virtual sun + hand shadow
  showSunShadow: boolean;
  sunShadowColor: string;
  sunShadowOpacity: number;      // 0..100
  sunShadowBlur: number;         // px (feGaussianBlur stdDeviation)
  sunShadowMinDistance: number;  // % of radius — shadow length at noon
  sunShadowMaxDistance: number;  // % of radius — shadow length at low sun
  sunNightBehavior: 'hide' | 'fade' | 'keep'; // what to do when sun is below horizon
  showSun: boolean;              // optional visible sun indicator on the dial
  sunColor: string;
  sunSize: number;               // % of radius
  sunOrbitRadius: number;        // % of radius, distance of sun indicator from center

  // Day-of-week window ("MONDAY" style cutout)
  showDayWindow: boolean;
  dayWindowPosition: 'top' | 'bottom' | 'left' | 'right';
  dayWindowDistance: number;
  dayWindowWidth: number;
  dayWindowHeight: number;
  dayWindowTextColor: string;
  dayWindowBgColor: string;
  dayWindowBorderColor: string;
  dayWindowBorderWidth: number;
  dayWindowFormat: 'dddd' | 'ddd' | 'dd';
  dayWindowFontFamily: string;
  dayWindowFontSize: number;
  dayWindowUppercase: boolean;
  dayWindowCornerRadius: number;
  dayWindowCurved: boolean;
  dayWindowArcSpan: number; // degrees, for curved mode

  // Day-of-month window ("15" style cutout)
  showDateWindow: boolean;
  dateWindowPosition: 'top' | 'bottom' | 'left' | 'right';
  dateWindowDistance: number;
  dateWindowWidth: number;
  dateWindowHeight: number;
  dateWindowTextColor: string;
  dateWindowBgColor: string;
  dateWindowBorderColor: string;
  dateWindowBorderWidth: number;
  dateWindowFontFamily: string;
  dateWindowFontSize: number;
  dateWindowCornerRadius: number;
  dateWindowCurved: boolean;
  dateWindowArcSpan: number;

  // Subdial 1
  subdial1Enabled: boolean;
  subdial1Distance: number;
  subdial1Angle: number;
  subdial1Size: number;
  subdial1Mode: SubdialMode;
  subdial1BgColor: string;
  subdial1BorderColor: string;
  subdial1BorderWidth: number;
  subdial1Min: number;
  subdial1Max: number;
  subdial1Label: string;
  subdial1LabelPosition: SubdialLabelPosition;
  subdial1LabelColor: string;
  subdial1LabelFontSize: number;
  subdial1Unit: string;
  subdial1HandColor: string;
  subdial1HandWidth: number;
  subdial1TickCount: number;
  subdial1TickColor: string;
  subdial1ShowNumbers: boolean;
  subdial1NumberColor: string;
  subdial1NumberFontSize: number;
  subdial1DigitalColor: string;
  subdial1DigitalFontSize: number;
  subdial1Decimals: number;
  subdial1FieldName: string;
  subdial1Reducer: SubdialReducer;
  subdial1QueryRefId: string;
  subdial1Scale: number;
  subdial1Offset: number;
  subdial1ThresholdMode: SubdialThresholdMode;
  subdial1Threshold1: number;
  subdial1Threshold1Color: string;
  subdial1Threshold2: number;
  subdial1Threshold2Color: string;

  // Subdial 2
  subdial2Enabled: boolean;
  subdial2Distance: number;
  subdial2Angle: number;
  subdial2Size: number;
  subdial2Mode: SubdialMode;
  subdial2BgColor: string;
  subdial2BorderColor: string;
  subdial2BorderWidth: number;
  subdial2Min: number;
  subdial2Max: number;
  subdial2Label: string;
  subdial2LabelPosition: SubdialLabelPosition;
  subdial2LabelColor: string;
  subdial2LabelFontSize: number;
  subdial2Unit: string;
  subdial2HandColor: string;
  subdial2HandWidth: number;
  subdial2TickCount: number;
  subdial2TickColor: string;
  subdial2ShowNumbers: boolean;
  subdial2NumberColor: string;
  subdial2NumberFontSize: number;
  subdial2DigitalColor: string;
  subdial2DigitalFontSize: number;
  subdial2Decimals: number;
  subdial2FieldName: string;
  subdial2Reducer: SubdialReducer;
  subdial2QueryRefId: string;
  subdial2Scale: number;
  subdial2Offset: number;
  subdial2ThresholdMode: SubdialThresholdMode;
  subdial2Threshold1: number;
  subdial2Threshold1Color: string;
  subdial2Threshold2: number;
  subdial2Threshold2Color: string;

  // Subdial 3
  subdial3Enabled: boolean;
  subdial3Distance: number;
  subdial3Angle: number;
  subdial3Size: number;
  subdial3Mode: SubdialMode;
  subdial3BgColor: string;
  subdial3BorderColor: string;
  subdial3BorderWidth: number;
  subdial3Min: number;
  subdial3Max: number;
  subdial3Label: string;
  subdial3LabelPosition: SubdialLabelPosition;
  subdial3LabelColor: string;
  subdial3LabelFontSize: number;
  subdial3Unit: string;
  subdial3HandColor: string;
  subdial3HandWidth: number;
  subdial3TickCount: number;
  subdial3TickColor: string;
  subdial3ShowNumbers: boolean;
  subdial3NumberColor: string;
  subdial3NumberFontSize: number;
  subdial3DigitalColor: string;
  subdial3DigitalFontSize: number;
  subdial3Decimals: number;
  subdial3FieldName: string;
  subdial3Reducer: SubdialReducer;
  subdial3QueryRefId: string;
  subdial3Scale: number;
  subdial3Offset: number;
  subdial3ThresholdMode: SubdialThresholdMode;
  subdial3Threshold1: number;
  subdial3Threshold1Color: string;
  subdial3Threshold2: number;
  subdial3Threshold2Color: string;

  // Subdial 4
  subdial4Enabled: boolean;
  subdial4Distance: number;
  subdial4Angle: number;
  subdial4Size: number;
  subdial4Mode: SubdialMode;
  subdial4BgColor: string;
  subdial4BorderColor: string;
  subdial4BorderWidth: number;
  subdial4Min: number;
  subdial4Max: number;
  subdial4Label: string;
  subdial4LabelPosition: SubdialLabelPosition;
  subdial4LabelColor: string;
  subdial4LabelFontSize: number;
  subdial4Unit: string;
  subdial4HandColor: string;
  subdial4HandWidth: number;
  subdial4TickCount: number;
  subdial4TickColor: string;
  subdial4ShowNumbers: boolean;
  subdial4NumberColor: string;
  subdial4NumberFontSize: number;
  subdial4DigitalColor: string;
  subdial4DigitalFontSize: number;
  subdial4Decimals: number;
  subdial4FieldName: string;
  subdial4Reducer: SubdialReducer;
  subdial4QueryRefId: string;
  subdial4Scale: number;
  subdial4Offset: number;
  subdial4ThresholdMode: SubdialThresholdMode;
  subdial4Threshold1: number;
  subdial4Threshold1Color: string;
  subdial4Threshold2: number;
  subdial4Threshold2Color: string;

  // Global metric hand — a gauge overlaid on the whole clock face
  gmEnabled: boolean;

  // Data binding (reuses subdial reducer semantics)
  gmFieldName: string;
  gmReducer: SubdialReducer;
  gmQueryRefId: string;
  gmScale: number;
  gmOffset: number;
  gmMin: number;
  gmMax: number;
  gmDecimals: number;
  gmUnit: string;

  // Sweep geometry
  gmStartAngle: number;   // degrees; 0 = 12 o'clock, positive = clockwise
  gmSweepAngle: number;   // degrees span between min and max (e.g. 270, 360)
  gmSmooth: boolean;      // smooth interpolation when value changes

  // Hand geometry (same vocabulary as other hands)
  gmHandShape: HandShape;
  gmHandColor: string;
  gmHandLength: number;      // % of radius
  gmHandTail: number;        // % of radius
  gmHandPivotOffset: number; // % of radius
  gmHandWidth: number;       // px

  // Counterweight
  gmCounterweightShape: CounterweightShape;
  gmCounterweightSize: number;
  gmCounterweightPosition: number;
  gmCounterweightColor: string;

  // Fill arc between min..value (or threshold bands) across the dial
  gmFillMode: 'none' | 'arc' | 'handColor' | 'both';
  gmArcInnerRadius: number; // % of radius
  gmArcOuterRadius: number; // % of radius
  gmArcColor: string;
  gmArcOpacity: number;     // 0..100

  // Thresholds (same model as subdials)
  gmThresholdMode: SubdialThresholdMode;
  gmThreshold1: number;
  gmThreshold1Color: string;
  gmThreshold2: number;
  gmThreshold2Color: string;

  // Scale ring (numeric labels around the dial mapped from min..max)
  gmScaleMode: 'none' | 'ring' | 'replaceHours';
  gmScaleRadius: number;        // % of radius where ring sits
  gmScaleTickCount: number;     // major ticks
  gmScaleTickLength: number;    // % of radius
  gmScaleTickColor: string;
  gmScaleNumberColor: string;
  gmScaleNumberFontSize: number;  // % of radius
  gmScaleNumberFontFamily: string;
  gmScaleDecimals: number;

  // Value display (numeric readout of the current metric value)
  gmValueDisplay: 'none' | 'window' | 'center' | 'counterweight';
  gmValueWindowPosition: 'top' | 'bottom' | 'left' | 'right';
  gmValueWindowDistance: number;
  gmValueWindowWidth: number;
  gmValueWindowHeight: number;
  gmValueTextColor: string;
  gmValueBgColor: string;
  gmValueBorderColor: string;
  gmValueBorderWidth: number;
  gmValueFontFamily: string;
  gmValueFontSize: number;   // px for window/center, % of radius for center mode
  gmValueCornerRadius: number;

  // Optional segmented semi-gauge tied to the same global metric value.
  gmGaugePlacement: GlobalMetricGaugePlacement;
  gmGaugeStyle: GlobalMetricGaugeStyle;
  gmGaugeOpacity: number;          // 0..100
  gmGaugeStartAngle: number;       // degrees; 0 = 12 o'clock, positive = clockwise
  gmGaugeSweepAngle: number;       // degrees span (typically 180)
  gmGaugeInnerRadius: number;      // % of placement base radius
  gmGaugeOuterRadius: number;      // % of placement base radius
  gmGaugeLabelRadius: number;      // % of placement base radius
  gmGaugeSegmentCount: number;
  gmGaugeSegmentGap: number;       // % of each segment reserved as spacing
  gmGaugeActiveColor1: string;
  gmGaugeActiveColor2: string;
  gmGaugeInactiveColor: string;
  gmGaugeRimEnabled: boolean;
  gmGaugeRimColor1: string;
  gmGaugeRimColor2: string;
  gmGaugeRimWidth: number;         // px
  gmGaugeLabelValues: string;      // comma-separated values, e.g. "10,30,60,90"
  gmGaugeLabelColor: string;
  gmGaugeLabelFontFamily: string;
  gmGaugeLabelFontSize: number;    // % of placement base radius
  gmGaugeShowValue: boolean;
  gmGaugeValueColor: string;
  gmGaugeValueFontFamily: string;
  gmGaugeValueFontSize: number;    // px
  gmGaugeValueYOffset: number;     // % of placement base radius
  gmGaugeUnitColor: string;
  gmGaugeUnitFontSize: number;     // px
  gmGaugeShowSparkline: boolean;
  gmGaugeSparklineColor: string;
  gmGaugeSparklineFillColor: string;
  gmGaugeSparklineOpacity: number; // 0..100
  gmGaugeSparklineWidth: number;   // % of placement base radius
  gmGaugeSparklineHeight: number;  // % of placement base radius
  gmGaugeSparklineYOffset: number; // % of placement base radius
  gmGaugeSparklineStrokeWidth: number; // px

  // Skeleton movement shown through a transparent dial. This is a separate
  // dial style and works best on clean watches without metric overlays.
  mechanicalMovementMode: MechanicalMovementMode;
  mechanicalMovementDriveMode: MechanicalMovementDriveMode;
  mechanicalMovementCrownSpeed: number;  // crown turns per minute in wind / set-time demos
  mechanicalMovementOpacity: number;      // 0..100
  mechanicalMovementDialOpacity: number;  // 0..100
  mechanicalMovementMetalColor: string;
  mechanicalMovementBridgeColor: string;
  mechanicalMovementJewelColor: string;

  // Vertical rolling date strip
  showRollingDate: boolean;
  rollingDatePosition: 'top' | 'bottom' | 'left' | 'right';
  rollingDateDistance: number;
  rollingDateWidth: number;
  rollingDateHeight: number;
  rollingDateTextColor: string;
  rollingDateBgColor: string;
  rollingDateBorderColor: string;
  rollingDateBorderWidth: number;
  rollingDateHighlightColor: string;
  rollingDateFontFamily: string;
  rollingDateFontSize: number;
}
