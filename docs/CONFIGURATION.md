# Alpine Clock Panel Configuration Reference

This document lists the full configuration surface exposed by Alpine Clock Panel.

The plugin currently exposes more than **220 panel editor options**. Some groups are repeated by design:

- 3 main hands: `hour`, `minute`, `second`
- 4 subdials: `subdial1`, `subdial2`, `subdial3`, `subdial4`

## Time

| Key | Purpose |
|---|---|
| `timezone` | IANA timezone name. |
| `useQueryTime` | Use the latest timestamp from query data instead of local wall clock time. |
| `stopToGo` | Enable stop-to-go second-hand behavior. |
| `sweepMs` | Milliseconds used by the fast second-hand sweep. |
| `pauseMs` | Milliseconds used by the second-hand pause at 12. |

## Dial

| Key | Purpose |
|---|---|
| `dialShape` | Dial silhouette: round, oval, rectangle, or hexagon variants. |
| `dialWidthFactor` | Dial width relative to panel width. |
| `dialHeightFactor` | Dial height relative to panel height. |
| `dialCornerRadius` | Corner radius for square and rectangle shapes. |
| `dialBackground` | Primary dial color. |
| `dialBorderColor` | Dial border color. |
| `dialBorderWidth` | Dial border width. |
| `dialFillMode` | Solid, linear, or radial fill. |
| `dialColor2` | Secondary gradient color. |
| `dialGradientFade` | Fade gradient into transparency. |
| `dialGradientAngle` | Linear gradient angle. |
| `dialGradientCenterX` | Radial gradient center X. |
| `dialGradientCenterY` | Radial gradient center Y. |
| `dialGradientInnerStop` | Radial inner stop. |
| `dialGradientOuterStop` | Radial outer stop. |

## Bezel

| Key | Purpose |
|---|---|
| `showBezel` | Toggle outer bezel ring. |
| `bezelThickness` | Bezel thickness relative to radius. |
| `bezelBackground` | Bezel fill color. |
| `bezelBorderColor` | Bezel border color. |
| `bezelBorderWidth` | Bezel border width. |
| `bezelNumbersMode` | Bezel numbering style. |
| `bezelRotationOffset` | Rotate bezel scale independently of the dial. |
| `bezelNumberColor` | Bezel number color. |
| `bezelNumberFontFamily` | Bezel number font. |
| `bezelNumberFontSize` | Bezel number size. |
| `bezelNumberRadius` | Number position within the bezel ring. |
| `bezelNumberUpright` | Keep bezel numerals upright. |
| `showBezelTicks` | Toggle bezel ticks. |
| `bezelTickColor` | Minor tick color. |
| `bezelTickStepDeg` | Minor tick spacing. |
| `bezelTickLength` | Minor tick length. |
| `bezelTickWidth` | Minor tick width. |
| `bezelMajorTickStepDeg` | Major tick spacing. |
| `bezelMajorTickLength` | Major tick length. |
| `bezelMajorTickWidth` | Major tick width. |

## Hour Indices

| Key | Purpose |
|---|---|
| `showHourTicks` | Show hour tick marks. |
| `hourTickColor` | Hour tick color. |
| `hourTickLength` | Hour tick length. |
| `hourTickWidth` | Hour tick width. |
| `hourTickHeight` | Virtual depth used by sun-shadow rendering. |
| `showHourNumbers` | Show hour numerals. |
| `hourNumberStyle` | Arabic, Roman, circled Arabic, or circled Roman. |
| `hourNumberColor` | Numeral color. |
| `hourNumberFontSize` | Numeral size. |
| `hourNumberRadius` | Numeral distance from center. |
| `hourNumberFontFamily` | Numeral font family. |

## Minute Indices

| Key | Purpose |
|---|---|
| `showMinuteTicks` | Show minute tick marks. |
| `minuteTickColor` | Minute tick color. |
| `minuteTickLength` | Minute tick length. |
| `minuteTickWidth` | Minute tick width. |
| `minuteTickHeight` | Virtual depth used by sun-shadow rendering. |
| `showMinuteNumbers` | Show minute numerals. |
| `minuteNumberColor` | Minute numeral color. |
| `minuteNumberFontSize` | Minute numeral size. |
| `minuteNumberRadius` | Minute numeral distance from center. |

## Second Indices

| Key | Purpose |
|---|---|
| `showSecondTicks` | Show second tick marks. |
| `secondTickColor` | Second tick color. |
| `secondTickLength` | Second tick length. |
| `secondTickWidth` | Second tick width. |
| `secondTickHeight` | Virtual depth used by sun-shadow rendering. |
| `showSecondNumbers` | Show second numerals. |
| `secondNumberColor` | Second numeral color. |
| `secondNumberFontSize` | Second numeral size. |
| `secondNumberRadius` | Second numeral distance from center. |

## Main Hands

Each main hand has its own full option set.

- Hour hand keys start with `hourHand*`, `hourCounterweight*`, `hourBounce*`, plus `smoothHourHand`
- Minute hand keys start with `minuteHand*`, `minuteCounterweight*`, `minuteBounce*`, plus `smoothMinuteHand`
- Second hand keys start with `secondHand*`, `secondCounterweight*`, `secondBounce*`, plus `smoothSecondHand`

For each of the three main hands, the following options exist:

| Suffix / Key | Purpose |
|---|---|
| `Color` | Hand color. |
| `Length` | Distance from pivot to tip. |
| `Tail` | Tail length behind the pivot. |
| `PivotOffset` | Shift the hand mount point away from dial center. |
| `Width` | Hand width. |
| `Shape` | One of the 14 supported hand shapes. |
| `smooth...Hand` | Smooth motion for that hand. |
| `CounterweightShape` | Counterweight geometry. |
| `CounterweightSize` | Counterweight size. |
| `CounterweightPosition` | Counterweight distance along the hand axis. |
| `CounterweightColor` | Counterweight color. |
| `Bounce` | Enable damped bounce on discrete ticks. |
| `BounceDurationMs` | Bounce duration. |
| `BounceAmplitudeDeg` | Bounce amplitude. |
| `BounceDamping` | Bounce damping coefficient. |
| `BounceFrequency` | Bounce angular frequency. |

## Center Cap

| Key | Purpose |
|---|---|
| `centerCapColor` | Pivot cap color. |
| `centerCapSize` | Pivot cap size. |

## Virtual Sun and Dynamic Shadows

| Key | Purpose |
|---|---|
| `showSunShadow` | Enable dynamic hand shadows. |
| `sunShadowColor` | Shadow color. |
| `sunShadowOpacity` | Shadow opacity. |
| `sunShadowBlur` | Shadow blur. |
| `sunShadowMinDistance` | Shortest shadow length. |
| `sunShadowMaxDistance` | Longest shadow length. |
| `sunNightBehavior` | Night behavior for shadows. |
| `showSun` | Show sun marker. |
| `sunColor` | Sun marker color. |
| `sunSize` | Sun marker size. |
| `sunOrbitRadius` | Orbit radius for the sun marker. |

## Day Window

| Key | Purpose |
|---|---|
| `showDayWindow` | Enable day-of-week window. |
| `dayWindowPosition` | Day window anchor position. |
| `dayWindowDistance` | Distance from center. |
| `dayWindowWidth` | Window width. |
| `dayWindowHeight` | Window height. |
| `dayWindowCornerRadius` | Corner radius. |
| `dayWindowBgColor` | Background color. |
| `dayWindowTextColor` | Text color. |
| `dayWindowFormat` | Long, short, or compact weekday format. |
| `dayWindowUppercase` | Force uppercase display. |
| `dayWindowFontFamily` | Font family. |
| `dayWindowFontSize` | Font size. |
| `dayWindowBorderColor` | Border color. |
| `dayWindowBorderWidth` | Border width. |
| `dayWindowCurved` | Use curved cutout styling. |
| `dayWindowArcSpan` | Curved cutout span. |

## Date Window

| Key | Purpose |
|---|---|
| `showDateWindow` | Enable date window. |
| `dateWindowPosition` | Date window anchor position. |
| `dateWindowDistance` | Distance from center. |
| `dateWindowWidth` | Window width. |
| `dateWindowHeight` | Window height. |
| `dateWindowCornerRadius` | Corner radius. |
| `dateWindowBgColor` | Background color. |
| `dateWindowTextColor` | Text color. |
| `dateWindowFontFamily` | Font family. |
| `dateWindowFontSize` | Font size. |
| `dateWindowBorderColor` | Border color. |
| `dateWindowBorderWidth` | Border width. |
| `dateWindowCurved` | Use curved cutout styling. |
| `dateWindowArcSpan` | Curved cutout span. |

## Rolling Date

| Key | Purpose |
|---|---|
| `showRollingDate` | Enable rolling date strip. |
| `rollingDatePosition` | Strip anchor position. |
| `rollingDateDistance` | Distance from center. |
| `rollingDateWidth` | Strip width. |
| `rollingDateHeight` | Strip height. |
| `rollingDateBgColor` | Background color. |
| `rollingDateTextColor` | Text color. |
| `rollingDateHighlightColor` | Current-day highlight color. |
| `rollingDateFontFamily` | Font family. |
| `rollingDateFontSize` | Font size. |
| `rollingDateBorderColor` | Border color. |
| `rollingDateBorderWidth` | Border width. |

## Global Metric

The global metric feature combines data binding, a large metric hand, optional fill arcs, threshold logic, scale labels, value windows, segmented gauges, and mechanical gauge presentation.

### Data binding and value mapping

| Key | Purpose |
|---|---|
| `gmEnabled` | Enable the global metric layer. |
| `gmFieldName` | Select a specific numeric field. |
| `gmReducer` | Aggregation / reducer. |
| `gmQueryRefId` | Restrict lookup to one query ref ID. |
| `gmScale` | Value multiplier. |
| `gmOffset` | Value offset. |
| `gmMin` | Minimum scale value. |
| `gmMax` | Maximum scale value. |
| `gmDecimals` | Decimal precision. |
| `gmUnit` | Unit label. |
| `gmSmooth` | Smooth value transitions. |

### Sweep geometry and main metric hand

| Key | Purpose |
|---|---|
| `gmStartAngle` | Sweep start angle. |
| `gmSweepAngle` | Sweep span. |
| `gmHandColor` | Hand color. |
| `gmHandLength` | Hand length. |
| `gmHandTail` | Hand tail. |
| `gmHandPivotOffset` | Hand pivot offset. |
| `gmHandWidth` | Hand width. |
| `gmHandShape` | Hand shape. |
| `gmCounterweightShape` | Counterweight shape. |
| `gmCounterweightSize` | Counterweight size. |
| `gmCounterweightPosition` | Counterweight position. |
| `gmCounterweightColor` | Counterweight color. |

### Arc fill and thresholds

| Key | Purpose |
|---|---|
| `gmFillMode` | Arc fill / hand color mode. |
| `gmArcInnerRadius` | Arc inner radius. |
| `gmArcOuterRadius` | Arc outer radius. |
| `gmArcColor` | Arc color. |
| `gmArcOpacity` | Arc opacity. |
| `gmThresholdMode` | Where thresholds apply. |
| `gmThreshold1` | First threshold. |
| `gmThreshold1Color` | First threshold color. |
| `gmThreshold2` | Second threshold. |
| `gmThreshold2Color` | Second threshold color. |

### Scale ring

| Key | Purpose |
|---|---|
| `gmScaleMode` | Scale ring mode. |
| `gmScaleRadius` | Scale ring radius. |
| `gmScaleTickCount` | Tick count. |
| `gmScaleTickLength` | Tick length. |
| `gmScaleTickColor` | Tick color. |
| `gmScaleNumberColor` | Number color. |
| `gmScaleNumberFontFamily` | Number font family. |
| `gmScaleNumberFontSize` | Number font size. |
| `gmScaleDecimals` | Scale-number decimal precision. |

### Value display

| Key | Purpose |
|---|---|
| `gmValueDisplay` | Value display mode. |
| `gmValueWindowPosition` | Window position. |
| `gmValueWindowDistance` | Window distance from center. |
| `gmValueWindowWidth` | Window width. |
| `gmValueWindowHeight` | Window height. |
| `gmValueTextColor` | Text color. |
| `gmValueBgColor` | Background color. |
| `gmValueBorderColor` | Border color. |
| `gmValueBorderWidth` | Border width. |
| `gmValueFontFamily` | Font family. |
| `gmValueFontSize` | Font size. |
| `gmValueCornerRadius` | Corner radius. |

### Segmented gauge

| Key | Purpose |
|---|---|
| `gmGaugePlacement` | Disabled, dial background, or bezel ring. |
| `gmGaugeStyle` | Flat or mechanical presentation. |
| `gmGaugeOpacity` | Gauge opacity. |
| `gmGaugeStartAngle` | Gauge start angle. |
| `gmGaugeSweepAngle` | Gauge sweep angle. |
| `gmGaugeInnerRadius` | Inner radius. |
| `gmGaugeOuterRadius` | Outer radius. |
| `gmGaugeLabelRadius` | Label radius. |
| `gmGaugeSegmentCount` | Segment count. |
| `gmGaugeSegmentGap` | Segment gap size. |
| `gmGaugeActiveColor1` | Active gradient start color. |
| `gmGaugeActiveColor2` | Active gradient end color. |
| `gmGaugeInactiveColor` | Inactive segment color. |
| `gmGaugeRimEnabled` | Toggle inactive outer rim. |
| `gmGaugeRimColor1` | Outer rim start color. |
| `gmGaugeRimColor2` | Outer rim end color. |
| `gmGaugeRimWidth` | Outer rim width. |
| `gmGaugeLabelValues` | Comma-separated label values. |
| `gmGaugeLabelColor` | Label color. |
| `gmGaugeLabelFontFamily` | Label font family. |
| `gmGaugeLabelFontSize` | Label font size. |
| `gmGaugeShowValue` | Show split value and unit. |
| `gmGaugeValueColor` | Value color. |
| `gmGaugeValueFontFamily` | Value font family. |
| `gmGaugeValueFontSize` | Value font size. |
| `gmGaugeValueYOffset` | Value vertical offset. |
| `gmGaugeUnitColor` | Unit color. |
| `gmGaugeUnitFontSize` | Unit font size. |
| `gmGaugeShowSparkline` | Show sparkline. |
| `gmGaugeSparklineColor` | Sparkline stroke color. |
| `gmGaugeSparklineFillColor` | Sparkline fill color. |
| `gmGaugeSparklineOpacity` | Sparkline fill opacity. |
| `gmGaugeSparklineWidth` | Sparkline width. |
| `gmGaugeSparklineHeight` | Sparkline height. |
| `gmGaugeSparklineYOffset` | Sparkline vertical offset. |
| `gmGaugeSparklineStrokeWidth` | Sparkline stroke width. |

## Mechanical Movement

| Key | Purpose |
|---|---|
| `mechanicalMovementMode` | Toggle transparent dial / skeleton movement rendering. |
| `mechanicalMovementDriveMode` | Run, wind mainspring, or set-time demonstration mode. |
| `mechanicalMovementCrownSpeed` | Crown demo speed. |
| `mechanicalMovementOpacity` | Movement opacity. |
| `mechanicalMovementDialOpacity` | Transparent dial tint opacity. |
| `mechanicalMovementMetalColor` | Wheel metal color. |
| `mechanicalMovementBridgeColor` | Bridge / plate color. |
| `mechanicalMovementJewelColor` | Jewel accent color. |

## Subdials 1-4

Each of the four subdials exposes the same option set with a numbered prefix:

- `subdial1...`
- `subdial2...`
- `subdial3...`
- `subdial4...`

Each numbered subdial supports the following keys:

| Suffix / Key | Purpose |
|---|---|
| `Enabled` | Toggle the subdial. |
| `Distance` | Distance from center. |
| `Angle` | Angular placement. |
| `Size` | Subdial diameter. |
| `Mode` | Analog or digital. |
| `BgColor` | Background color. |
| `BorderColor` | Border color. |
| `BorderWidth` | Border width. |
| `Min` | Minimum value. |
| `Max` | Maximum value. |
| `Label` | Subdial label text. |
| `LabelPosition` | Label position. |
| `LabelColor` | Label color. |
| `LabelFontSize` | Label font size. |
| `Unit` | Unit string. |
| `HandColor` | Analog hand color. |
| `HandWidth` | Analog hand width. |
| `TickCount` | Analog tick count. |
| `TickColor` | Analog tick color. |
| `ShowNumbers` | Show min / mid / max numbers in analog mode. |
| `NumberColor` | Analog number color. |
| `NumberFontSize` | Analog number font size. |
| `DigitalColor` | Digital text color. |
| `DigitalFontSize` | Digital font size. |
| `Decimals` | Decimal precision. |
| `FieldName` | Numeric field selector. |
| `Reducer` | Aggregation / reducer. |
| `QueryRefId` | Query ref ID filter. |
| `Scale` | Value multiplier. |
| `Offset` | Value offset. |
| `ThresholdMode` | Threshold application mode. |
| `Threshold1` | First threshold value. |
| `Threshold1Color` | First threshold color. |
| `Threshold2` | Second threshold value. |
| `Threshold2Color` | Second threshold color. |

## Practical note

You are not expected to use every option in a single panel. The intended workflow is:

1. Pick a silhouette and dial style.
2. Configure the main hands and indices.
3. Add bezel, numerals, windows, and date elements.
4. Add subdials and the global metric layer only if the design needs them.
5. Use the mechanical movement and segmented gauge features as advanced presentation layers.
