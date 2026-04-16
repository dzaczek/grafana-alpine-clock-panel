import React, { useEffect, useRef, useState } from 'react';
import { FieldType, PanelData, PanelProps } from '@grafana/data';
import { css } from '@emotion/css';
import {
  AlpineClockOptions,
  HandShape,
  CounterweightShape,
  DialShape,
  SubdialReducer,
  SubdialThresholdMode,
} from '../types';
import { getTimeInZone } from '../timezones';

interface Props extends PanelProps<AlpineClockOptions> {}

/**
 * Stop-to-go second-hand angle.
 * Sweeps a full 360° in `sweepMs` (default 58500 ms), then holds at 0°
 * for `pauseMs` (default 1500 ms) before the minute advances.
 */
function stopToGoSecondAngle(msInMinute: number, sweepMs: number, pauseMs: number): number {
  const total = sweepMs + pauseMs;
  let t = msInMinute % total;
  if (t < 0) {
    t += total;
  }
  if (t >= sweepMs) {
    return 0;
  }
  return (t / sweepMs) * 360;
}

/**
 * Build an SVG path describing the annular sector between two radii, from
 * `startDeg` to `endDeg` (0 = 12 o'clock, clockwise positive). Used by the
 * global metric arc fill.
 */
function buildArcBand(
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number
): string {
  const sweep = endDeg - startDeg;
  if (rOuter <= 0 || rInner < 0 || Math.abs(sweep) < 0.01) {
    return '';
  }
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const a0 = toRad(startDeg);
  const a1 = toRad(endDeg);
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;
  const innerSweepFlag = sweep >= 0 ? 0 : 1;
  const outerStartX = rOuter * Math.cos(a0);
  const outerStartY = rOuter * Math.sin(a0);
  const outerEndX = rOuter * Math.cos(a1);
  const outerEndY = rOuter * Math.sin(a1);
  const innerStartX = rInner * Math.cos(a1);
  const innerStartY = rInner * Math.sin(a1);
  const innerEndX = rInner * Math.cos(a0);
  const innerEndY = rInner * Math.sin(a0);
  return (
    `M ${outerStartX} ${outerStartY} ` +
    `A ${rOuter} ${rOuter} 0 ${largeArc} ${sweepFlag} ${outerEndX} ${outerEndY} ` +
    `L ${innerStartX} ${innerStartY} ` +
    `A ${rInner} ${rInner} 0 ${largeArc} ${innerSweepFlag} ${innerEndX} ${innerEndY} Z`
  );
}

/**
 * Fit a dial shape's intrinsic aspect ratio into the panel box. Without this
 * a "vertical rectangle" silhouette renders wide whenever the panel itself is
 * wide, because the primitive was defined relative to panel halfW/halfH.
 * Returns the half-extents of the shape's bounding box after fitting.
 */
function shapeExtents(
  shape: DialShape,
  halfW: number,
  halfH: number
): { hw: number; hh: number } {
  const fit = (aspect: number) => {
    // aspect = shapeHalfW / shapeHalfH (> 1 = landscape, < 1 = portrait)
    let hh = halfH;
    let hw = hh * aspect;
    if (hw > halfW) {
      hw = halfW;
      hh = hw / aspect;
    }
    return { hw, hh };
  };
  const square = () => {
    const s = Math.min(halfW, halfH);
    return { hw: s, hh: s };
  };
  switch (shape) {
    case 'oval-h':
      return fit(1.3);
    case 'oval-v':
      return fit(0.77);
    case 'rect-h':
      return fit(1.4);
    case 'rect-v':
      return fit(0.7);
    case 'hex-flat':
      return fit(2 / Math.sqrt(3));
    case 'hex-point':
      return fit(Math.sqrt(3) / 2);
    case 'square':
    case 'round':
    default:
      return square();
  }
}

/**
 * Distance from dial center to the dial silhouette edge along a ray at
 * `angle` (radians, same convention as the tick loop: -90° = 12 o'clock).
 * Used to lay out ticks and numbers so they follow non-circular shapes
 * instead of clinging to the inscribed circle. `hw`/`hh` are the fitted
 * half-extents returned by `shapeExtents`.
 */
function dialEdgeRadius(
  shape: DialShape,
  hw: number,
  hh: number,
  angle: number
): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const absC = Math.abs(c);
  const absS = Math.abs(s);
  const eps = 1e-6;

  const ellipse = (rx: number, ry: number) =>
    (rx * ry) / Math.sqrt((ry * c) ** 2 + (rx * s) ** 2);

  const rect = (rhw: number, rhh: number) => {
    const tx = absC < eps ? Infinity : rhw / absC;
    const ty = absS < eps ? Infinity : rhh / absS;
    return Math.min(tx, ty);
  };

  const polygon = (pts: Array<[number, number]>) => {
    let minT = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [p1x, p1y] = pts[i];
      const [p2x, p2y] = pts[(i + 1) % pts.length];
      const ex = p2x - p1x;
      const ey = p2y - p1y;
      const denom = c * ey - s * ex;
      if (Math.abs(denom) < eps) {
        continue;
      }
      const t = (p1x * ey - p1y * ex) / denom;
      const u = (p1x * s - p1y * c) / denom;
      if (t > 0 && u >= 0 && u <= 1 && t < minT) {
        minT = t;
      }
    }
    return minT;
  };

  switch (shape) {
    case 'oval-h':
    case 'oval-v':
      return ellipse(hw, hh);
    case 'square':
    case 'rect-h':
    case 'rect-v':
      return rect(hw, hh);
    case 'hex-flat':
      return polygon([
        [-hw * 0.5, -hh],
        [hw * 0.5, -hh],
        [hw, 0],
        [hw * 0.5, hh],
        [-hw * 0.5, hh],
        [-hw, 0],
      ]);
    case 'hex-point':
      return polygon([
        [0, -hh],
        [hw, -hh * 0.5],
        [hw, hh * 0.5],
        [0, hh],
        [-hw, hh * 0.5],
        [-hw, -hh * 0.5],
      ]);
    case 'round':
    default:
      return Math.min(hw, hh);
  }
}

/**
 * Only force SVG text width when the natural glyph run would overflow.
 * Short labels (single letter, "N", "OK") otherwise got stretched edge-to-edge
 * by `textLength` + `lengthAdjust` and became unreadable.
 */
function fitText(
  text: string,
  fontSize: number,
  maxWidth: number
): { textLength?: number; lengthAdjust?: 'spacingAndGlyphs' } {
  const estimated = (text?.length ?? 0) * fontSize * 0.6;
  if (estimated <= maxWidth) {
    return {};
  }
  return { textLength: maxWidth, lengthAdjust: 'spacingAndGlyphs' };
}

type WindowPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Convert a window position + distance into (x,y) coordinates relative to the
 * dial center. Distance is in pixels (already multiplied by radius %).
 */
function windowAnchor(position: WindowPosition, distance: number): { x: number; y: number } {
  switch (position) {
    case 'top':
      return { x: 0, y: -distance };
    case 'bottom':
      return { x: 0, y: distance };
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
  }
}

/**
 * A recessed text window on the dial: flat background rect with an inner
 * shadow to mimic a cutout, then the text on top. Centred at (cx, cy).
 *
 * The text always fits horizontally via `textLength` + `lengthAdjust` so it
 * gets squished (never clipped) regardless of content length or case.
 */
function TextWindow({
  cx,
  cy,
  width,
  height,
  cornerRadius,
  bg,
  textColor,
  text,
  fontFamily,
  fontSize,
  filterId,
  borderColor,
  borderWidth,
}: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  cornerRadius: number;
  bg: string;
  textColor: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  filterId: string;
  borderColor: string;
  borderWidth: number;
}) {
  // Leave ~12% padding on each side so letters don't touch the rim.
  const innerWidth = Math.max(width * 0.76, 1);
  // Cap font size so tall letters always fit vertically, even for tiny windows.
  const cappedFontSize = Math.min(fontSize, height * 0.8);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={cornerRadius}
        ry={cornerRadius}
        fill={bg}
        stroke={borderWidth > 0 ? borderColor : 'none'}
        strokeWidth={borderWidth}
        filter={`url(#${filterId})`}
      />
      <text
        x={0}
        y={0}
        fill={textColor}
        fontFamily={fontFamily}
        fontSize={cappedFontSize}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        {...fitText(text, cappedFontSize, innerWidth)}
      >
        {text}
      </text>
    </g>
  );
}

/**
 * Read a numeric metric from Grafana's PanelData for a subdial.
 *
 * Behaviour:
 *   - If `fieldName` is provided, look it up by exact name across all series.
 *   - Otherwise, fall back to the first numeric field in the first series.
 *   - Apply `reducer` over the field's values.
 *   - Returns `null` when there is no matching data (component renders "--").
 */
function readMetric(
  data: PanelData,
  fieldName: string,
  reducer: SubdialReducer,
  queryRefId: string
): number | null {
  if (!data?.series?.length) {
    return null;
  }
  // Narrow frames by refId if provided. Empty string = consider all frames.
  const frames = queryRefId
    ? data.series.filter((frame) => frame.refId === queryRefId)
    : data.series;
  if (!frames.length) {
    return null;
  }
  // Locate the target field.
  let targetValues: number[] | null = null;
  if (fieldName) {
    for (const frame of frames) {
      const field = frame.fields.find((f) => f.name === fieldName);
      if (field && field.type === FieldType.number) {
        targetValues = field.values as unknown as number[];
        break;
      }
    }
  } else {
    const first = frames[0];
    const numeric = first.fields.find((f) => f.type === FieldType.number);
    if (numeric) {
      targetValues = numeric.values as unknown as number[];
    }
  }
  if (!targetValues || targetValues.length === 0) {
    return null;
  }

  switch (reducer) {
    case 'last':
      return Number(targetValues[targetValues.length - 1]);
    case 'lastNotNull': {
      for (let i = targetValues.length - 1; i >= 0; i--) {
        const v = targetValues[i];
        if (v !== null && v !== undefined && !Number.isNaN(v as number)) {
          return Number(v);
        }
      }
      return null;
    }
    case 'first':
      return Number(targetValues[0]);
    case 'min': {
      let m = Infinity;
      for (const v of targetValues) {
        if (typeof v === 'number' && v < m) {
          m = v;
        }
      }
      return Number.isFinite(m) ? m : null;
    }
    case 'max': {
      let m = -Infinity;
      for (const v of targetValues) {
        if (typeof v === 'number' && v > m) {
          m = v;
        }
      }
      return Number.isFinite(m) ? m : null;
    }
    case 'sum': {
      let s = 0;
      let any = false;
      for (const v of targetValues) {
        if (typeof v === 'number') {
          s += v;
          any = true;
        }
      }
      return any ? s : null;
    }
    case 'mean': {
      let s = 0;
      let n = 0;
      for (const v of targetValues) {
        if (typeof v === 'number') {
          s += v;
          n++;
        }
      }
      return n > 0 ? s / n : null;
    }
    case 'count':
      return targetValues.length;
  }
}

/**
 * Flat-options projection for one subdial. Picks the `subdialNxxx` fields and
 * exposes them as a single typed object so render code does not need to deal
 * with 4 × ~27 raw fields.
 */
interface SubdialConfig {
  enabled: boolean;
  distance: number;
  angle: number;
  size: number;
  mode: 'analog' | 'digital';
  bgColor: string;
  borderColor: string;
  borderWidth: number;
  min: number;
  max: number;
  label: string;
  labelPosition: 'none' | 'inside-top' | 'inside-bottom' | 'outer-top' | 'outer-bottom';
  labelColor: string;
  labelFontSize: number;
  unit: string;
  handColor: string;
  handWidth: number;
  tickCount: number;
  tickColor: string;
  showNumbers: boolean;
  numberColor: string;
  numberFontSize: number;
  digitalColor: string;
  digitalFontSize: number;
  decimals: number;
  fieldName: string;
  reducer: SubdialReducer;
  queryRefId: string;
  scale: number;
  offset: number;
  thresholdMode: SubdialThresholdMode;
  threshold1: number;
  threshold1Color: string;
  threshold2: number;
  threshold2Color: string;
}

function getSubdialConfig(options: AlpineClockOptions, n: 1 | 2 | 3 | 4): SubdialConfig {
  const o = options as unknown as Record<string, unknown>;
  const p = <T,>(key: string): T => o[`subdial${n}${key}`] as T;
  return {
    enabled: p<boolean>('Enabled'),
    distance: p<number>('Distance'),
    angle: p<number>('Angle'),
    size: p<number>('Size'),
    mode: p<'analog' | 'digital'>('Mode'),
    bgColor: p<string>('BgColor'),
    borderColor: p<string>('BorderColor'),
    borderWidth: p<number>('BorderWidth'),
    min: p<number>('Min'),
    max: p<number>('Max'),
    label: p<string>('Label'),
    labelPosition: p<SubdialConfig['labelPosition']>('LabelPosition'),
    labelColor: p<string>('LabelColor'),
    labelFontSize: p<number>('LabelFontSize'),
    unit: p<string>('Unit'),
    handColor: p<string>('HandColor'),
    handWidth: p<number>('HandWidth'),
    tickCount: p<number>('TickCount'),
    tickColor: p<string>('TickColor'),
    showNumbers: p<boolean>('ShowNumbers'),
    numberColor: p<string>('NumberColor'),
    numberFontSize: p<number>('NumberFontSize'),
    digitalColor: p<string>('DigitalColor'),
    digitalFontSize: p<number>('DigitalFontSize'),
    decimals: p<number>('Decimals'),
    fieldName: p<string>('FieldName'),
    reducer: p<SubdialReducer>('Reducer'),
    queryRefId: p<string>('QueryRefId'),
    scale: p<number>('Scale'),
    offset: p<number>('Offset'),
    thresholdMode: p<SubdialThresholdMode>('ThresholdMode'),
    threshold1: p<number>('Threshold1'),
    threshold1Color: p<string>('Threshold1Color'),
    threshold2: p<number>('Threshold2'),
    threshold2Color: p<string>('Threshold2Color'),
  };
}

/**
 * Resolve the effective colour for a subdial element given its current value
 * and the configured thresholds. Two thresholds are supported; whichever is
 * lower is the "warning" level, whichever is higher the "critical" level.
 * Returns `fallback` when thresholds are off or the value is null.
 */
function resolveSubdialThresholdColor(
  value: number | null,
  fallback: string,
  active: boolean,
  t1: number,
  c1: string,
  t2: number,
  c2: string
): string {
  if (!active || value === null || Number.isNaN(value)) {
    return fallback;
  }
  const lower = Math.min(t1, t2);
  const upper = Math.max(t1, t2);
  const lowerColor = t1 <= t2 ? c1 : c2;
  const upperColor = t1 <= t2 ? c2 : c1;
  if (value >= upper) {
    return upperColor;
  }
  if (value >= lower) {
    return lowerColor;
  }
  return fallback;
}

/**
 * Format a metric value with fixed decimals and optional unit suffix.
 * `null` renders as "--".
 */
function formatSubdialValue(value: number | null, decimals: number, unit: string): string {
  if (value === null || Number.isNaN(value)) {
    return '--';
  }
  const safeDec = Math.max(0, Math.min(Math.floor(decimals), 8));
  const text = value.toFixed(safeDec);
  return unit ? `${text}${unit.startsWith(' ') ? unit : ' ' + unit}` : text;
}

/**
 * A single chronograph totalizer subdial. Rendered as a recessed circular
 * cutout on the main dial, with either a miniature analog hand or a digital
 * value display. Uses the shared alpine-inner-shadow filter to look like an
 * actual hole in the dial.
 */
function Subdial({
  cx,
  cy,
  radius,
  config,
  value,
  filterId,
  clockFontFamily,
}: {
  cx: number;
  cy: number;
  radius: number;
  config: SubdialConfig;
  value: number | null;
  filterId: string;
  clockFontFamily: string;
}) {
  if (!config.enabled || radius <= 0) {
    return null;
  }
  const range = config.max - config.min;
  const normalised =
    value === null || range === 0 ? 0 : Math.min(Math.max((value - config.min) / range, 0), 1);

  // Threshold-based color overrides. `thresholdMode` decides whether the
  // value-indicator (hand/digital text), the subdial background, or both are
  // re-coloured when the reading crosses a threshold.
  const valueActive = config.thresholdMode === 'value' || config.thresholdMode === 'both';
  const bgActive = config.thresholdMode === 'background' || config.thresholdMode === 'both';
  const handColor = resolveSubdialThresholdColor(
    value,
    config.handColor,
    valueActive,
    config.threshold1,
    config.threshold1Color,
    config.threshold2,
    config.threshold2Color
  );
  const digitalColor = resolveSubdialThresholdColor(
    value,
    config.digitalColor,
    valueActive,
    config.threshold1,
    config.threshold1Color,
    config.threshold2,
    config.threshold2Color
  );
  const bgColor = resolveSubdialThresholdColor(
    value,
    config.bgColor,
    bgActive,
    config.threshold1,
    config.threshold1Color,
    config.threshold2,
    config.threshold2Color
  );

  // Ticks — only drawn in analog mode (digital hides them for a clean readout).
  const ticks: React.ReactNode[] = [];
  if (config.mode === 'analog' && config.tickCount > 0) {
    for (let i = 0; i < config.tickCount; i++) {
      const a = (i / config.tickCount) * 360 - 90;
      const rad = (a * Math.PI) / 180;
      const outer = radius * 0.92;
      const inner = radius * 0.8;
      ticks.push(
        <line
          key={`t${i}`}
          x1={inner * Math.cos(rad)}
          y1={inner * Math.sin(rad)}
          x2={outer * Math.cos(rad)}
          y2={outer * Math.sin(rad)}
          stroke={config.tickColor}
          strokeWidth={Math.max(radius * 0.03, 0.5)}
        />
      );
    }
  }

  // Optional numbers (min/mid/max markers at 0°, 120°, 240°).
  const numbers: React.ReactNode[] = [];
  if (config.mode === 'analog' && config.showNumbers) {
    const fs = Math.max((radius * config.numberFontSize) / 100, 4);
    const numberR = radius * 0.62;
    const entries = [
      { v: config.min, a: 0 },
      { v: (config.min + config.max) / 2, a: 120 },
      { v: config.max, a: 240 },
    ];
    entries.forEach((e, idx) => {
      const rad = ((e.a - 90) * Math.PI) / 180;
      numbers.push(
        <text
          key={`n${idx}`}
          x={numberR * Math.cos(rad)}
          y={numberR * Math.sin(rad)}
          fill={config.numberColor}
          fontFamily={clockFontFamily}
          fontSize={fs}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {Number.isInteger(e.v) ? e.v : e.v.toFixed(1)}
        </text>
      );
    });
  }

  // Analog hand — maps normalised value to full 0..360° sweep.
  const handAngle = normalised * 360;
  const handLen = radius * 0.8;
  const handW = Math.max((radius * config.handWidth) / 100, 0.5);
  const analogHand = config.mode === 'analog' && (
    <g transform={`rotate(${handAngle})`}>
      <path
        d={`M ${-handW / 2} ${radius * 0.15} L ${handW / 2} ${radius * 0.15} L ${handW / 2} ${-handLen} L ${-handW / 2} ${-handLen} Z`}
        fill={handColor}
      />
      <circle cx={0} cy={0} r={Math.max(handW * 0.9, 1)} fill={handColor} />
    </g>
  );

  // Digital readout text.
  const digitalText = config.mode === 'digital' && (() => {
    const fs = Math.max((radius * config.digitalFontSize) / 100, 4);
    // Clip text to 80% of diameter so long numbers don't overflow the hole.
    const maxWidth = radius * 1.6;
    return (
      <text
        x={0}
        y={0}
        fill={digitalColor}
        fontFamily="Menlo, Monaco, Consolas, monospace"
        fontSize={fs}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        {...fitText(formatSubdialValue(value, config.decimals, config.unit), fs, maxWidth)}
      >
        {formatSubdialValue(value, config.decimals, config.unit)}
      </text>
    );
  })();

  // Label text position.
  const labelFontSize = Math.max((radius * config.labelFontSize) / 100, 4);
  const labelClip = radius * 1.6;
  const labelEl =
    config.labelPosition !== 'none' && config.label ? (() => {
      let lx = 0;
      let ly = 0;
      switch (config.labelPosition) {
        case 'inside-top':
          ly = -radius * 0.55;
          break;
        case 'inside-bottom':
          ly = radius * 0.55;
          break;
        case 'outer-top':
          ly = -radius - labelFontSize * 0.8;
          break;
        case 'outer-bottom':
          ly = radius + labelFontSize * 0.8;
          break;
      }
      return (
        <text
          x={lx}
          y={ly}
          fill={config.labelColor}
          fontFamily={clockFontFamily}
          fontSize={labelFontSize}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
          {...fitText(config.label, labelFontSize, labelClip)}
        >
          {config.label}
        </text>
      );
    })() : null;

  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* Recessed cutout */}
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill={bgColor}
        stroke={config.borderWidth > 0 ? config.borderColor : 'none'}
        strokeWidth={config.borderWidth}
        filter={`url(#${filterId})`}
      />
      {ticks}
      {numbers}
      {analogHand}
      {digitalText}
      {labelEl}
    </g>
  );
}

/**
 * Simple virtual-sun model.
 *
 * The sun orbits the clock once per 24 hours. At noon (12:00) it sits at the
 * top of the dial (sunAngleDeg = 0); it travels clockwise through the right
 * side in the afternoon, down through the bottom at midnight, and back up
 * through the left in the morning.
 *
 * Elevation is modelled as a simple cosine of the normalised hour: +1 at
 * noon, -1 at midnight, zero at 6 am and 6 pm. Shadow length is an inverse
 * function of elevation, so noon casts a short shadow and low-sun hours
 * stretch the shadow out.
 */
function computeSunShadow(
  hour: number,
  minute: number,
  second: number,
  minDistancePx: number,
  maxDistancePx: number
): { sunAngleDeg: number; elevation: number; dx: number; dy: number } {
  const decimalHour = hour + minute / 60 + second / 3600;
  // Normalised phase where 0 rad = noon and +π = midnight.
  const phase = ((decimalHour - 12) / 12) * Math.PI;
  const elevation = Math.cos(phase); // +1 noon, -1 midnight, 0 at 6:00 / 18:00
  // Angle around the dial (0° = up at noon, grows clockwise).
  const sunAngleDeg = ((decimalHour - 12) / 24) * 360;
  // Shadow direction is opposite the sun.
  const shadowAngleDeg = sunAngleDeg + 180;
  const shadowAngleRad = ((shadowAngleDeg - 90) * Math.PI) / 180;
  // Length: interpolate from min (noon) to max (horizon) based on |elevation|.
  const lengthFactor = 1 - Math.max(elevation, 0); // 0 at noon, 1 at horizon/below
  const length = minDistancePx + (maxDistancePx - minDistancePx) * lengthFactor;
  const dx = length * Math.cos(shadowAngleRad);
  const dy = length * Math.sin(shadowAngleRad);
  return { sunAngleDeg, elevation, dx, dy };
}

/** Center angle (deg, 0 = up / 12 o'clock) for a window position. */
function positionAngle(position: WindowPosition): number {
  switch (position) {
    case 'top':
      return 0;
    case 'right':
      return 90;
    case 'bottom':
      return 180;
    case 'left':
      return 270;
  }
}

/**
 * SVG arc-segment path: an annular sector centred at (0,0) spanning the given
 * angle range between `innerR` and `outerR`. Angles in degrees where 0 = up.
 */
function arcSegmentPath(innerR: number, outerR: number, startDeg: number, endDeg: number): string {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sa = rad(startDeg);
  const ea = rad(endDeg);
  const oSx = outerR * Math.cos(sa);
  const oSy = outerR * Math.sin(sa);
  const oEx = outerR * Math.cos(ea);
  const oEy = outerR * Math.sin(ea);
  const iEx = innerR * Math.cos(ea);
  const iEy = innerR * Math.sin(ea);
  const iSx = innerR * Math.cos(sa);
  const iSy = innerR * Math.sin(sa);
  return (
    `M ${oSx} ${oSy} ` +
    `A ${outerR} ${outerR} 0 ${large} 1 ${oEx} ${oEy} ` +
    `L ${iEx} ${iEy} ` +
    `A ${innerR} ${innerR} 0 ${large} 0 ${iSx} ${iSy} Z`
  );
}

/**
 * Path running along the mid-line of an annular sector. Used as a textPath
 * reference. Direction is chosen so the text baseline is correctly oriented
 * for the given window position (text not rendered upside down at the bottom).
 */
function arcMidPath(
  midR: number,
  centerDeg: number,
  spanDeg: number
): { d: string; reversed: boolean } {
  // For windows on the upper half we want the text to read left-to-right along
  // the OUTSIDE of the arc (natural orientation). For windows on the lower
  // half the natural arc direction would render text upside-down, so we
  // reverse the path direction and let the text sit on top of the reversed
  // arc — which reads correctly right-side up.
  const reversed = centerDeg > 90 && centerDeg < 270;
  const startDeg = centerDeg - spanDeg / 2;
  const endDeg = centerDeg + spanDeg / 2;
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const large = spanDeg > 180 ? 1 : 0;
  if (!reversed) {
    const sa = rad(startDeg);
    const ea = rad(endDeg);
    return {
      d:
        `M ${midR * Math.cos(sa)} ${midR * Math.sin(sa)} ` +
        `A ${midR} ${midR} 0 ${large} 1 ${midR * Math.cos(ea)} ${midR * Math.sin(ea)}`,
      reversed: false,
    };
  }
  // Reversed: draw from endDeg to startDeg in sweep-flag 0 direction.
  const sa = rad(endDeg);
  const ea = rad(startDeg);
  return {
    d:
      `M ${midR * Math.cos(sa)} ${midR * Math.sin(sa)} ` +
      `A ${midR} ${midR} 0 ${large} 0 ${midR * Math.cos(ea)} ${midR * Math.sin(ea)}`,
    reversed: true,
  };
}

/**
 * Curved variant of the recessed text window. Renders as an annular sector
 * cutout with text following the mid-line arc.
 */
function CurvedTextWindow({
  centerAngleDeg,
  midRadius,
  thickness,
  arcSpanDeg,
  bg,
  textColor,
  text,
  fontFamily,
  fontSize,
  filterId,
  borderColor,
  borderWidth,
  pathId,
}: {
  centerAngleDeg: number;
  midRadius: number;
  thickness: number;
  arcSpanDeg: number;
  bg: string;
  textColor: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  filterId: string;
  borderColor: string;
  borderWidth: number;
  pathId: string;
}) {
  const innerR = Math.max(midRadius - thickness / 2, 1);
  const outerR = midRadius + thickness / 2;
  const startDeg = centerAngleDeg - arcSpanDeg / 2;
  const endDeg = centerAngleDeg + arcSpanDeg / 2;
  const segmentD = arcSegmentPath(innerR, outerR, startDeg, endDeg);
  const cappedFontSize = Math.min(fontSize, thickness * 0.75);

  // SVG <textPath> draws glyphs with the BASELINE sitting on the path. The
  // visual centre of capital letters is roughly 35% of the font size above
  // the baseline, so the text appears too far from the dial centre (too
  // "high") by that amount. We compensate by shifting the text path radially
  // so the visual centre of the letters lands exactly on `midRadius`.
  //
  // The direction of "above the baseline" relative to the dial centre
  // depends on whether the arc path runs in the natural direction (top/left
  // /right windows) or was reversed to keep the text upright (bottom
  // windows). For non-reversed paths, glyphs extend OUTWARD from the dial
  // centre, so we pull the path inward. For reversed paths glyphs extend
  // inward, so we push the path outward.
  const baselineShift = cappedFontSize * 0.35;
  // We don't know yet whether the path will be reversed — call arcMidPath
  // first with the original radius just to get the `reversed` flag, then
  // rebuild with the compensated radius.
  const probe = arcMidPath(midRadius, centerAngleDeg, arcSpanDeg * 0.92);
  const adjustedMidR = probe.reversed ? midRadius + baselineShift : midRadius - baselineShift;
  const midPath = arcMidPath(adjustedMidR, centerAngleDeg, arcSpanDeg * 0.92);
  const arcLen = (2 * Math.PI * adjustedMidR * (arcSpanDeg * 0.85)) / 360;

  return (
    <g>
      <path
        d={segmentD}
        fill={bg}
        stroke={borderWidth > 0 ? borderColor : 'none'}
        strokeWidth={borderWidth}
        filter={`url(#${filterId})`}
      />
      <defs>
        <path id={pathId} d={midPath.d} />
      </defs>
      <text
        fill={textColor}
        fontFamily={fontFamily}
        fontSize={cappedFontSize}
        fontWeight="bold"
        dominantBaseline="central"
        {...fitText(text, cappedFontSize, Math.max(arcLen, 1))}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </g>
  );
}

/**
 * Format day-of-week according to configured pattern. Simple English labels —
 * kept deterministic so it renders identically server-side if ever needed.
 */
function formatDayOfWeek(date: Date, fmt: 'dddd' | 'ddd' | 'dd'): string {
  const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const short3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const short2 = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const d = date.getDay();
  if (fmt === 'dddd') {
    return names[d];
  }
  if (fmt === 'ddd') {
    return short3[d];
  }
  return short2[d];
}

/**
 * Resolve the `fill` value for the dial given the configured fill mode.
 * Returns either a plain colour string or a url(#id) reference to an SVG
 * gradient that the caller is responsible for rendering in <defs>.
 */
function dialFillValue(
  mode: AlpineClockOptions['dialFillMode'],
  solid: string,
  gradientId: string
): string {
  return mode === 'solid' ? solid : `url(#${gradientId})`;
}

/**
 * <defs> content for the dial gradient (linear or radial).
 * Skipped entirely when fill mode is 'solid'.
 */
function DialGradientDefs({
  id,
  options,
}: {
  id: string;
  options: AlpineClockOptions;
}) {
  if (options.dialFillMode === 'linear') {
    const rad = ((options.dialGradientAngle - 90) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    // Normalize direction into a 0..1 object-bounding-box line.
    const x1 = 0.5 - dx / 2;
    const y1 = 0.5 - dy / 2;
    const x2 = 0.5 + dx / 2;
    const y2 = 0.5 + dy / 2;
    const end = options.dialGradientFade ? 'transparent' : options.dialColor2;
    return (
      <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
        <stop offset="0%" stopColor={options.dialBackground} />
        <stop offset="100%" stopColor={end} />
      </linearGradient>
    );
  }
  if (options.dialFillMode === 'radial') {
    const end = options.dialGradientFade ? 'transparent' : options.dialColor2;
    return (
      <radialGradient
        id={id}
        cx={`${options.dialGradientCenterX}%`}
        cy={`${options.dialGradientCenterY}%`}
        r="70%"
      >
        <stop offset={`${options.dialGradientInnerStop}%`} stopColor={options.dialBackground} />
        <stop offset={`${options.dialGradientOuterStop}%`} stopColor={end} />
      </radialGradient>
    );
  }
  return null;
}

/**
 * Ticks + numbers rendered over the bezel ring. Positioned polar-style on a
 * circular path between `innerR` (inner edge of bezel = outer edge of dial)
 * and `outerR` (outer edge of bezel = outer edge of the clock). Non-round
 * dials still get a circular bezel scale, which is the common watch design.
 */
function BezelMarkings({
  innerR,
  outerR,
  options,
}: {
  innerR: number;
  outerR: number;
  options: AlpineClockOptions;
}) {
  const band = outerR - innerR;
  if (band <= 0) {
    return null;
  }
  const rotation = options.bezelRotationOffset;
  const items: React.ReactNode[] = [];

  // Tick helpers
  const makeTick = (
    angleDeg: number,
    len: number,
    w: number,
    color: string,
    key: string
  ) => {
    const rad = ((angleDeg - 90 + rotation) * Math.PI) / 180;
    const x1 = innerR * Math.cos(rad);
    const y1 = innerR * Math.sin(rad);
    const x2 = (innerR + len) * Math.cos(rad);
    const y2 = (innerR + len) * Math.sin(rad);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />;
  };

  if (options.showBezelTicks) {
    const step = Math.max(options.bezelTickStepDeg, 1);
    const majorStep = Math.max(options.bezelMajorTickStepDeg, step);
    for (let deg = 0; deg < 360; deg += step) {
      const isMajor = Math.abs(deg % majorStep) < 0.001;
      items.push(
        makeTick(
          deg,
          isMajor ? options.bezelMajorTickLength : options.bezelTickLength,
          isMajor ? options.bezelMajorTickWidth : options.bezelTickWidth,
          options.bezelTickColor,
          `bt-${deg}`
        )
      );
    }
  }

  // Numbers
  if (options.bezelNumbersMode !== 'none') {
    const numberR = innerR + (band * options.bezelNumberRadius) / 100;
    const fs = (outerR * options.bezelNumberFontSize) / 100;
    const labels: Array<{ value: string; angle: number }> = [];
    if (options.bezelNumbersMode === '12') {
      for (let i = 1; i <= 12; i++) {
        labels.push({ value: String(i), angle: i * 30 });
      }
    } else if (options.bezelNumbersMode === '24') {
      for (let i = 0; i < 24; i++) {
        labels.push({ value: String(i).padStart(2, '0'), angle: (i / 24) * 360 });
      }
    } else if (options.bezelNumbersMode === '60') {
      for (let i = 0; i < 60; i += 5) {
        labels.push({ value: String(i).padStart(2, '0'), angle: i * 6 });
      }
    } else if (options.bezelNumbersMode === '60-all') {
      for (let i = 0; i < 60; i++) {
        labels.push({ value: String(i), angle: i * 6 });
      }
    }
    labels.forEach((lbl, i) => {
      const angleDeg = lbl.angle + rotation;
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      const x = numberR * Math.cos(rad);
      const y = numberR * Math.sin(rad);
      if (options.bezelNumberUpright) {
        items.push(
          <text
            key={`bn-${i}`}
            x={x}
            y={y}
            fill={options.bezelNumberColor}
            fontFamily={options.bezelNumberFontFamily}
            fontSize={fs}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {lbl.value}
          </text>
        );
      } else {
        // Tangential: rotate so the number's baseline is along the bezel.
        items.push(
          <g key={`bn-${i}`} transform={`translate(${x} ${y}) rotate(${angleDeg})`}>
            <text
              fill={options.bezelNumberColor}
              fontFamily={options.bezelNumberFontFamily}
              fontSize={fs}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {lbl.value}
            </text>
          </g>
        );
      }
    });
  }

  return <g>{items}</g>;
}

/**
 * Background shape of the clock face, centred at (0,0). `halfW` and `halfH`
 * are the half-extents of the bounding box; the shape fills that box.
 */
function DialBackground({
  shape,
  halfW,
  halfH,
  cornerRadius,
  fill,
  stroke,
  strokeWidth,
}: {
  shape: DialShape;
  halfW: number;
  halfH: number;
  cornerRadius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const common = { fill, stroke, strokeWidth };
  const { hw, hh } = shapeExtents(shape, halfW, halfH);
  switch (shape) {
    case 'oval-h':
    case 'oval-v':
      return <ellipse cx={0} cy={0} rx={hw} ry={hh} {...common} />;
    case 'square':
    case 'rect-h':
    case 'rect-v':
      return (
        <rect
          x={-hw}
          y={-hh}
          width={hw * 2}
          height={hh * 2}
          rx={cornerRadius}
          ry={cornerRadius}
          {...common}
        />
      );
    case 'hex-flat': {
      const pts = [
        [-hw * 0.5, -hh],
        [hw * 0.5, -hh],
        [hw, 0],
        [hw * 0.5, hh],
        [-hw * 0.5, hh],
        [-hw, 0],
      ];
      return <polygon points={pts.map((p) => p.join(',')).join(' ')} {...common} />;
    }
    case 'hex-point': {
      const pts = [
        [0, -hh],
        [hw, -hh * 0.5],
        [hw, hh * 0.5],
        [0, hh],
        [-hw, hh * 0.5],
        [-hw, -hh * 0.5],
      ];
      return <polygon points={pts.map((p) => p.join(',')).join(' ')} {...common} />;
    }
    case 'round':
    default:
      return <circle cx={0} cy={0} r={Math.min(hw, hh)} {...common} />;
  }
}

/**
 * Render a hand glyph centred at (0,0) with the tip pointing up (-Y).
 * `tip` is the distance from pivot to tip, `tail` the distance from pivot to back end,
 * both positive.
 */
function HandGlyph({
  shape,
  tip,
  tail,
  width,
  color,
}: {
  shape: HandShape;
  tip: number;
  tail: number;
  width: number;
  color: string;
}) {
  const hw = width / 2;

  switch (shape) {
    case 'taper': {
      const tipHW = Math.max(hw * 0.35, 1);
      const d = `M ${-hw} ${tail} L ${hw} ${tail} L ${tipHW} ${-tip} L ${-tipHW} ${-tip} Z`;
      return <path d={d} fill={color} />;
    }
    case 'lozenge': {
      const d = `M 0 ${tail} L ${hw} 0 L 0 ${-tip} L ${-hw} 0 Z`;
      return <path d={d} fill={color} />;
    }
    case 'pointer': {
      const bodyTop = -tip + width * 1.5;
      const d = `M ${-hw} ${tail} L ${hw} ${tail} L ${hw} ${bodyTop} L 0 ${-tip} L ${-hw} ${bodyTop} Z`;
      return <path d={d} fill={color} />;
    }
    case 'sword': {
      // Long slim blade, slight shoulders, + cross-guard near the pivot
      const guardW = hw * 3.5;
      const guardH = Math.max(width * 0.45, 2);
      const shoulderY = -tip * 0.15;
      const d =
        `M ${-hw} ${tail} ` +
        `L ${hw} ${tail} ` +
        `L ${hw * 0.75} ${shoulderY} ` +
        `L ${hw * 0.35} ${-tip} ` +
        `L ${-hw * 0.35} ${-tip} ` +
        `L ${-hw * 0.75} ${shoulderY} Z`;
      return (
        <g>
          <path d={d} fill={color} />
          <rect x={-guardW / 2} y={-guardH / 2} width={guardW} height={guardH} fill={color} />
        </g>
      );
    }
    case 'dauphine': {
      // Elongated diamond (triangle from pivot) + centre ridge line for faceted look
      const base = `M ${-hw} ${tail} L 0 ${tail * 0.15} L ${hw} ${tail} L ${hw * 0.15} ${-tip * 0.1} L 0 ${-tip} L ${-hw * 0.15} ${-tip * 0.1} Z`;
      return (
        <g>
          <path d={base} fill={color} />
          <line
            x1={0}
            y1={tail}
            x2={0}
            y2={-tip}
            stroke={color}
            strokeWidth={Math.max(width * 0.12, 0.5)}
            opacity={0.35}
          />
        </g>
      );
    }
    case 'breguet': {
      // Narrow shaft with hollow "moon" circle near the tip
      const ringR = Math.max(width * 1.4, 3);
      const ringCy = -tip + ringR + width * 0.5;
      const d =
        `M ${-hw * 0.6} ${tail} L ${hw * 0.6} ${tail} ` +
        `L ${hw * 0.6} ${ringCy + ringR * 0.3} L ${-hw * 0.6} ${ringCy + ringR * 0.3} Z`;
      return (
        <g>
          <path d={d} fill={color} />
          <circle
            cx={0}
            cy={ringCy}
            r={ringR}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(width * 0.5, 1)}
          />
          <circle cx={0} cy={-tip + width * 0.6} r={Math.max(width * 0.35, 1)} fill={color} />
        </g>
      );
    }
    case 'alpha': {
      // Leaf-like: two Bezier curves swelling from pivot to tip
      const bulgeX = hw * 1.8;
      const bulgeY = -tip * 0.45;
      const d =
        `M 0 ${tail} ` +
        `Q ${bulgeX} ${bulgeY}, 0 ${-tip} ` +
        `Q ${-bulgeX} ${bulgeY}, 0 ${tail} Z`;
      return <path d={d} fill={color} />;
    }
    case 'syringe': {
      // Thin shaft with a luminous dot mid-way + a pointed tip
      const dotR = Math.max(width * 0.9, 2);
      const dotCy = -tip * 0.55;
      const d =
        `M ${-hw * 0.5} ${tail} L ${hw * 0.5} ${tail} ` +
        `L ${hw * 0.5} ${-tip + width} L 0 ${-tip} L ${-hw * 0.5} ${-tip + width} Z`;
      return (
        <g>
          <path d={d} fill={color} />
          <circle cx={0} cy={dotCy} r={dotR} fill={color} />
        </g>
      );
    }
    case 'arrow': {
      // Narrow shaft + big triangular arrowhead
      const headHalf = hw * 2.2;
      const headBaseY = -tip + width * 2.8;
      const d =
        `M ${-hw * 0.55} ${tail} L ${hw * 0.55} ${tail} ` +
        `L ${hw * 0.55} ${headBaseY} L ${headHalf} ${headBaseY} ` +
        `L 0 ${-tip} L ${-headHalf} ${headBaseY} L ${-hw * 0.55} ${headBaseY} Z`;
      return <path d={d} fill={color} />;
    }
    case 'baton': {
      // Rounded-end stick
      const d =
        `M ${-hw} ${tail - hw} ` +
        `A ${hw} ${hw} 0 0 0 ${hw} ${tail - hw} ` +
        `L ${hw} ${-tip + hw} ` +
        `A ${hw} ${hw} 0 0 0 ${-hw} ${-tip + hw} Z`;
      return <path d={d} fill={color} />;
    }
    case 'leaf': {
      // Symmetrical bulged leaf with pointed tip
      const widest = hw * 1.6;
      const d =
        `M 0 ${tail} ` +
        `C ${widest} ${tail * 0.3}, ${widest} ${-tip * 0.55}, 0 ${-tip} ` +
        `C ${-widest} ${-tip * 0.55}, ${-widest} ${tail * 0.3}, 0 ${tail} Z`;
      return <path d={d} fill={color} />;
    }
    case 'skeleton': {
      // Hollow rectangle outline
      return (
        <rect
          x={-hw}
          y={-tip}
          width={width}
          height={tip + tail}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(width * 0.25, 1)}
        />
      );
    }
    case 'spade': {
      // Spade / faceted teardrop: diamond body + small tail
      const shoulderY = -tip * 0.3;
      const d =
        `M 0 ${tail} L ${hw * 0.6} ${tail * 0.4} L ${hw * 1.3} ${shoulderY} ` +
        `L 0 ${-tip} L ${-hw * 1.3} ${shoulderY} L ${-hw * 0.6} ${tail * 0.4} Z`;
      return <path d={d} fill={color} />;
    }
    case 'rect':
    default: {
      const d = `M ${-hw} ${tail} L ${hw} ${tail} L ${hw} ${-tip} L ${-hw} ${-tip} Z`;
      return <path d={d} fill={color} />;
    }
  }
}

function Counterweight({
  shape,
  radius,
  color,
}: {
  shape: CounterweightShape;
  radius: number;
  color: string;
}) {
  if (shape === 'none' || radius <= 0) {
    return null;
  }
  switch (shape) {
    case 'square':
      return <rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} fill={color} />;
    case 'diamond':
      return (
        <polygon
          points={`0,${-radius} ${radius},0 0,${radius} ${-radius},0`}
          fill={color}
        />
      );
    case 'ring':
      return (
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(radius * 0.35, 1)}
        />
      );
    case 'circle':
    default:
      return <circle cx={0} cy={0} r={radius} fill={color} />;
  }
}

function Hand({
  angleDeg,
  shape,
  tip,
  tail,
  width,
  color,
  pivotOffset,
  counterweight,
  counterweightOffset,
}: {
  angleDeg: number;
  shape: HandShape;
  tip: number;
  tail: number;
  width: number;
  color: string;
  pivotOffset: number;
  counterweight?: React.ReactNode;
  counterweightOffset?: number;
}) {
  // Rotate around dial center, then translate so the pivot sits at `pivotOffset` along
  // the hand's axis (positive = toward tip = -Y in hand local coords).
  return (
    <g transform={`rotate(${angleDeg}) translate(0 ${-pivotOffset})`}>
      <HandGlyph shape={shape} tip={tip} tail={tail} width={width} color={color} />
      {counterweight && (
        <g transform={`translate(0 ${-(counterweightOffset ?? tip * 0.72)})`}>{counterweight}</g>
      )}
    </g>
  );
}

function useAnimationFrame(callback: () => void) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      cbRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export const AlpineClockPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const [, setTick] = useState(0);
  useAnimationFrame(() => setTick((n) => (n + 1) & 0xffff));

  // Per-hand tick tracking. Each ref stores the last observed discrete value
  // (hour 0-11, minute 0-59, second 0-59) and the wall-clock timestamp of the
  // jump, so we can evaluate the damped oscillation formula each frame.
  const hourBounceRef = useRef<{ lastTick: number; jumpAt: number }>({ lastTick: -1, jumpAt: 0 });
  const minuteBounceRef = useRef<{ lastTick: number; jumpAt: number }>({ lastTick: -1, jumpAt: 0 });
  const secondBounceRef = useRef<{ lastTick: number; jumpAt: number }>({ lastTick: -1, jumpAt: 0 });

  // Resolve current time (either from data frame or real-time).
  let now = new Date();
  if (options.useQueryTime && data?.series?.length) {
    const frame = data.series[0];
    const timeField = frame.fields.find((f) => f.type === 'time');
    if (timeField && timeField.values.length > 0) {
      const last = timeField.values[timeField.values.length - 1];
      if (typeof last === 'number') {
        now = new Date(last);
      }
    }
  }

  const { hour, minute, second, ms } = getTimeInZone(options.timezone || '', now);

  // Angles
  const h12 = hour % 12;
  const smoothMin = options.smoothMinuteHand ? minute + (second + ms / 1000) / 60 : minute;
  const smoothHour = options.smoothHourHand ? h12 + smoothMin / 60 : h12 + minute / 60;
  let hourDeg = smoothHour * 30;
  let minuteDeg = smoothMin * 6;

  const msInMinute = second * 1000 + ms;
  let secondDeg = options.stopToGo
    ? stopToGoSecondAngle(msInMinute, options.sweepMs || 58500, options.pauseMs || 1500)
    : (msInMinute / 60000) * 360;

  // Damped harmonic bounce helper.  bounce(t) = A · e^(-ζt) · cos(ωt)
  const nowMs = now.getTime();
  const applyBounce = (
    ref: React.MutableRefObject<{ lastTick: number; jumpAt: number }>,
    currentTick: number,
    enabled: boolean,
    smooth: boolean,
    durationMs: number,
    ampDeg: number,
    damping: number,
    frequency: number
  ): number => {
    if (ref.current.lastTick !== currentTick) {
      ref.current.lastTick = currentTick;
      ref.current.jumpAt = nowMs;
    }
    if (!enabled || smooth) {
      return 0;
    }
    const diff = nowMs - ref.current.jumpAt;
    if (diff < 0 || diff >= durationMs) {
      return 0;
    }
    const t = diff / 1000;
    return ampDeg * Math.exp(-damping * t) * Math.cos(frequency * t);
  };

  hourDeg += applyBounce(
    hourBounceRef,
    h12,
    options.hourBounce,
    options.smoothHourHand,
    options.hourBounceDurationMs,
    options.hourBounceAmplitudeDeg,
    options.hourBounceDamping,
    options.hourBounceFrequency
  );
  minuteDeg += applyBounce(
    minuteBounceRef,
    minute,
    options.minuteBounce,
    options.smoothMinuteHand,
    options.minuteBounceDurationMs,
    options.minuteBounceAmplitudeDeg,
    options.minuteBounceDamping,
    options.minuteBounceFrequency
  );
  // Second-hand bounce only makes sense when stop-to-go is off (otherwise the
  // hand already has its own specialised motion profile).
  if (!options.stopToGo) {
    secondDeg += applyBounce(
      secondBounceRef,
      second,
      options.secondBounce,
      false,
      options.secondBounceDurationMs,
      options.secondBounceAmplitudeDeg,
      options.secondBounceDamping,
      options.secondBounceFrequency
    );
  }

  // Geometry
  const cx = width / 2;
  const cy = height / 2;
  const border = Math.max(options.dialBorderWidth, 0);
  // Outer half-extents of the whole clock footprint (bezel + dial).
  const outerHalfW = (width / 2) * (options.dialWidthFactor / 100) - border / 2;
  const outerHalfH = (height / 2) * (options.dialHeightFactor / 100) - border / 2;
  // Bezel thickness (px) — shrinks the dial content when the bezel is enabled.
  const bezelPx = options.showBezel
    ? (Math.min(outerHalfW, outerHalfH) * options.bezelThickness) / 100
    : 0;
  const halfW = outerHalfW - bezelPx;
  const halfH = outerHalfH - bezelPx;
  // Fit the selected dial shape's intrinsic aspect ratio inside the panel
  // box. Without this a rect-v / oval-v silhouette still follows the panel
  // aspect and ends up "wider than tall" on a landscape panel.
  const fitted = shapeExtents(options.dialShape, halfW, halfH);
  // `r` is the radius of the inscribed circle used for hand lengths and any
  // scaling that should stay uniform in every direction (hands, subdials).
  // Ticks and numbers compute their own per-angle edge via `dialEdgeRadius`
  // so they follow non-circular silhouettes.
  const r = Math.min(fitted.hw, fitted.hh) * 0.95;
  const edgeAt = (angle: number) =>
    dialEdgeRadius(options.dialShape, fitted.hw, fitted.hh, angle) * 0.95;

  // Ticks
  const hourTicks: React.ReactNode[] = [];
  const minuteTicks: React.ReactNode[] = [];
  const secondTicks: React.ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i * 6 - 90) * (Math.PI / 180);
    const edgeR = edgeAt(angle);
    const isHour = i % 5 === 0;
    if (isHour && options.showHourTicks) {
      const len = (edgeR * options.hourTickLength) / 100;
      const x1 = edgeR * Math.cos(angle);
      const y1 = edgeR * Math.sin(angle);
      const x2 = (edgeR - len) * Math.cos(angle);
      const y2 = (edgeR - len) * Math.sin(angle);
      hourTicks.push(
        <line
          key={`h${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={options.hourTickColor}
          strokeWidth={options.hourTickWidth}
          strokeLinecap="butt"
        />
      );
    } else if (!isHour && options.showMinuteTicks) {
      const len = (edgeR * options.minuteTickLength) / 100;
      const x1 = edgeR * Math.cos(angle);
      const y1 = edgeR * Math.sin(angle);
      const x2 = (edgeR - len) * Math.cos(angle);
      const y2 = (edgeR - len) * Math.sin(angle);
      minuteTicks.push(
        <line
          key={`m${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={options.minuteTickColor}
          strokeWidth={options.minuteTickWidth}
        />
      );
    }
    if (options.showSecondTicks && !isHour) {
      const len = (edgeR * options.secondTickLength) / 100;
      const sr = edgeR - (options.minuteTickLength * edgeR) / 100 - 2;
      const x1 = sr * Math.cos(angle);
      const y1 = sr * Math.sin(angle);
      const x2 = (sr - len) * Math.cos(angle);
      const y2 = (sr - len) * Math.sin(angle);
      secondTicks.push(
        <line
          key={`s${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={options.secondTickColor}
          strokeWidth={options.secondTickWidth}
        />
      );
    }
  }

  // Numbers — each group has its own radial distance so they don't overlap.
  const numbers: React.ReactNode[] = [];
  if (options.showHourNumbers) {
    const fontSize = (r * options.hourNumberFontSize) / 100;
    for (let i = 1; i <= 12; i++) {
      const a = (i * 30 - 90) * (Math.PI / 180);
      const radius = (edgeAt(a) * options.hourNumberRadius) / 100;
      numbers.push(
        <text
          key={`hn${i}`}
          x={radius * Math.cos(a)}
          y={radius * Math.sin(a)}
          fontSize={fontSize}
          fill={options.hourNumberColor}
          fontFamily={options.hourNumberFontFamily}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {i}
        </text>
      );
    }
  }
  if (options.showMinuteNumbers) {
    const fontSize = (r * options.minuteNumberFontSize) / 100;
    for (let i = 0; i < 60; i += 5) {
      const a = (i * 6 - 90) * (Math.PI / 180);
      const radius = (edgeAt(a) * options.minuteNumberRadius) / 100;
      numbers.push(
        <text
          key={`mn${i}`}
          x={radius * Math.cos(a)}
          y={radius * Math.sin(a)}
          fontSize={fontSize}
          fill={options.minuteNumberColor}
          fontFamily={options.hourNumberFontFamily}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {i.toString().padStart(2, '0')}
        </text>
      );
    }
  }
  if (options.showSecondNumbers) {
    const fontSize = (r * options.secondNumberFontSize) / 100;
    for (let i = 0; i < 60; i += 5) {
      const a = (i * 6 - 90) * (Math.PI / 180);
      const radius = (edgeAt(a) * options.secondNumberRadius) / 100;
      numbers.push(
        <text
          key={`sn${i}`}
          x={radius * Math.cos(a)}
          y={radius * Math.sin(a)}
          fontSize={fontSize}
          fill={options.secondNumberColor}
          fontFamily={options.hourNumberFontFamily}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {i.toString().padStart(2, '0')}
        </text>
      );
    }
  }

  const hourTip = (r * options.hourHandLength) / 100;
  const hourTail = (r * options.hourHandTail) / 100;
  const hourPivot = (r * options.hourHandPivotOffset) / 100;
  const hourCwSize = (r * options.hourCounterweightSize) / 100;
  const hourCwOffset = (r * options.hourCounterweightPosition) / 100;
  const minTip = (r * options.minuteHandLength) / 100;
  const minTail = (r * options.minuteHandTail) / 100;
  const minPivot = (r * options.minuteHandPivotOffset) / 100;
  const minCwSize = (r * options.minuteCounterweightSize) / 100;
  const minCwOffset = (r * options.minuteCounterweightPosition) / 100;
  const secTip = (r * options.secondHandLength) / 100;
  const secTail = (r * options.secondHandTail) / 100;
  const secPivot = (r * options.secondHandPivotOffset) / 100;
  const secCwSize = (r * options.secondCounterweightSize) / 100;
  const secCwOffset = (r * options.secondCounterweightPosition) / 100;
  const capSize = (r * options.centerCapSize) / 100;

  // Chronograph subdials (1..4). Each reads its metric from the data frame
  // every frame; position is polar on the main dial.
  const subdials = ([1, 2, 3, 4] as const)
    .map((n) => {
      const config = getSubdialConfig(options, n);
      if (!config.enabled) {
        return null;
      }
      const distPx = (r * config.distance) / 100;
      const rad = ((config.angle - 90) * Math.PI) / 180;
      const sdCx = distPx * Math.cos(rad);
      const sdCy = distPx * Math.sin(rad);
      const radius = (r * config.size) / 100 / 2;
      const raw = readMetric(data, config.fieldName, config.reducer, config.queryRefId);
      // Linear transform applied once, BEFORE min/max clamping, reducing and
      // formatting. Defaults are scale=1 / offset=0, so legacy configs stay
      // identical.
      const value =
        raw === null ? null : raw * (config.scale || 1) + (config.offset || 0);
      return { n, config, cx: sdCx, cy: sdCy, radius, value };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Global metric gauge overlay (big metric hand + optional scale / arc / value readout).
  const globalMetric = (() => {
    if (!options.gmEnabled) {
      return null;
    }
    const raw = readMetric(data, options.gmFieldName, options.gmReducer, options.gmQueryRefId);
    const value =
      raw === null ? null : raw * (options.gmScale || 1) + (options.gmOffset || 0);
    const span = options.gmMax - options.gmMin;
    const clamped =
      value === null ? null : Math.max(options.gmMin, Math.min(options.gmMax, value));
    const pct =
      clamped === null || span === 0 ? 0 : (clamped - options.gmMin) / span;
    const angleDeg = options.gmStartAngle + pct * options.gmSweepAngle;
    const tip = (r * options.gmHandLength) / 100;
    const tail = (r * options.gmHandTail) / 100;
    const pivot = (r * options.gmHandPivotOffset) / 100;
    const cwSize = (r * options.gmCounterweightSize) / 100;
    const cwOffset = (r * options.gmCounterweightPosition) / 100;

    const useThresholdOnHand =
      options.gmFillMode === 'handColor' ||
      options.gmFillMode === 'both' ||
      options.gmThresholdMode === 'value' ||
      options.gmThresholdMode === 'both';
    const handColor = resolveSubdialThresholdColor(
      value,
      options.gmHandColor,
      useThresholdOnHand,
      options.gmThreshold1,
      options.gmThreshold1Color,
      options.gmThreshold2,
      options.gmThreshold2Color
    );
    const useThresholdOnArc =
      options.gmThresholdMode === 'background' || options.gmThresholdMode === 'both';
    const arcColor = resolveSubdialThresholdColor(
      value,
      options.gmArcColor,
      useThresholdOnArc,
      options.gmThreshold1,
      options.gmThreshold1Color,
      options.gmThreshold2,
      options.gmThreshold2Color
    );

    const scaleLabels: Array<{ value: number; angleDeg: number }> = [];
    if (options.gmScaleMode !== 'none' && options.gmScaleTickCount > 1) {
      const steps = options.gmScaleTickCount - 1;
      for (let i = 0; i <= steps; i++) {
        const v = options.gmMin + (span * i) / steps;
        const a = options.gmStartAngle + (i / steps) * options.gmSweepAngle;
        scaleLabels.push({ value: v, angleDeg: a });
      }
    }

    const formatted =
      value === null
        ? '--'
        : `${value.toFixed(options.gmDecimals)}${options.gmUnit ? options.gmUnit : ''}`;

    return {
      value,
      formatted,
      angleDeg,
      pct,
      tip,
      tail,
      pivot,
      cwSize,
      cwOffset,
      handColor,
      arcColor,
      scaleLabels,
    };
  })();

  // Virtual-sun shadow vector (dx, dy, elevation). Evaluated each frame.
  const sunShadow = computeSunShadow(
    hour,
    minute,
    second,
    (r * options.sunShadowMinDistance) / 100,
    (r * options.sunShadowMaxDistance) / 100
  );
  // Opacity is scaled by night behaviour: below horizon (elevation < 0) the
  // shadow either hides, fades proportionally, or is kept at full strength.
  let effectiveShadowOpacity = options.sunShadowOpacity / 100;
  if (sunShadow.elevation < 0) {
    if (options.sunNightBehavior === 'hide') {
      effectiveShadowOpacity = 0;
    } else if (options.sunNightBehavior === 'fade') {
      effectiveShadowOpacity *= Math.max(0, 1 + sunShadow.elevation);
    }
  }

  // Per-tick-type shadows: same sun direction, length proportional to tick height.
  // minDist = 10% of height (short noon shadow), maxDist = height (full horizon shadow).
  const hourTickShadow = options.showSunShadow && options.hourTickHeight > 0
    ? computeSunShadow(hour, minute, second, options.hourTickHeight * 0.1, options.hourTickHeight)
    : null;
  const minuteTickShadow = options.showSunShadow && options.minuteTickHeight > 0
    ? computeSunShadow(hour, minute, second, options.minuteTickHeight * 0.1, options.minuteTickHeight)
    : null;
  const secondTickShadow = options.showSunShadow && options.secondTickHeight > 0
    ? computeSunShadow(hour, minute, second, options.secondTickHeight * 0.1, options.secondTickHeight)
    : null;

  // Day window geometry & content
  const dayWin = (() => {
    if (!options.showDayWindow) {
      return null;
    }
    const anchor = windowAnchor(options.dayWindowPosition, (r * options.dayWindowDistance) / 100);
    const w = (r * options.dayWindowWidth) / 100;
    const h = (r * options.dayWindowHeight) / 100;
    const fs = (r * options.dayWindowFontSize) / 100;
    let text = formatDayOfWeek(now, options.dayWindowFormat);
    if (!options.dayWindowUppercase) {
      text = text.charAt(0) + text.slice(1).toLowerCase();
    }
    return { anchor, w, h, fs, text };
  })();

  // Date (day-of-month) window geometry & content
  const dateWin = (() => {
    if (!options.showDateWindow) {
      return null;
    }
    const anchor = windowAnchor(
      options.dateWindowPosition,
      (r * options.dateWindowDistance) / 100
    );
    const w = (r * options.dateWindowWidth) / 100;
    const h = (r * options.dateWindowHeight) / 100;
    const fs = (r * options.dateWindowFontSize) / 100;
    const text = String(now.getDate()).padStart(2, '0');
    return { anchor, w, h, fs, text };
  })();

  // Rolling date strip (vertical slot with previous / current / next day)
  const rollingDate = (() => {
    if (!options.showRollingDate) {
      return null;
    }
    const anchor = windowAnchor(
      options.rollingDatePosition,
      (r * options.rollingDateDistance) / 100
    );
    const w = (r * options.rollingDateWidth) / 100;
    const h = (r * options.rollingDateHeight) / 100;
    const fs = (r * options.rollingDateFontSize) / 100;
    const day = now.getDate();
    const prev = new Date(now);
    prev.setDate(day - 1);
    const next = new Date(now);
    next.setDate(day + 1);
    return {
      anchor,
      w,
      h,
      fs,
      prev: String(prev.getDate()).padStart(2, '0'),
      curr: String(day).padStart(2, '0'),
      next: String(next.getDate()).padStart(2, '0'),
    };
  })();

  return (
    <div
      className={css`
        width: ${width}px;
        height: ${height}px;
        display: flex;
        align-items: center;
        justify-content: center;
      `}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <DialGradientDefs id="alpine-dial-gradient" options={options} />
          {/*
            Inner-shadow filter used by recessed text windows.

            Pipeline:
              1. Blur the shape's alpha channel.
              2. Offset the blurred alpha downward (simulating light coming
                 from above — the top inner edge should therefore be the
                 darkest).
              3. Compute `SourceAlpha OUT offsetBlur`: pixels that are inside
                 the original shape but NOT covered by the shifted+blurred
                 version. That yields a thin band hugging the top inner edge.
              4. Flood with dark colour, clip to that band.
              5. Composite over the source so the shadow sits on top of the
                 background fill but the background is still visible beneath.
          */}
          <filter id="alpine-inner-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="blur" />
            <feOffset in="blur" dx="0" dy="2" result="offsetBlur" />
            <feComposite in="SourceAlpha" in2="offsetBlur" operator="out" result="innerEdge" />
            <feFlood floodColor="#000000" floodOpacity="0.8" result="darkColor" />
            <feComposite in="darkColor" in2="innerEdge" operator="in" result="innerShadow" />
            <feComposite in="innerShadow" in2="SourceGraphic" operator="over" />
          </filter>
          {options.showSunShadow && (
            <filter id="alpine-sun-shadow" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow
                dx={sunShadow.dx}
                dy={sunShadow.dy}
                stdDeviation={options.sunShadowBlur}
                floodColor={options.sunShadowColor}
                floodOpacity={effectiveShadowOpacity}
              />
            </filter>
          )}
          {hourTickShadow && (
            <filter id="alpine-tick-shadow-h" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow
                dx={hourTickShadow.dx}
                dy={hourTickShadow.dy}
                stdDeviation={options.sunShadowBlur}
                floodColor={options.sunShadowColor}
                floodOpacity={effectiveShadowOpacity}
              />
            </filter>
          )}
          {minuteTickShadow && (
            <filter id="alpine-tick-shadow-m" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow
                dx={minuteTickShadow.dx}
                dy={minuteTickShadow.dy}
                stdDeviation={options.sunShadowBlur}
                floodColor={options.sunShadowColor}
                floodOpacity={effectiveShadowOpacity}
              />
            </filter>
          )}
          {secondTickShadow && (
            <filter id="alpine-tick-shadow-s" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow
                dx={secondTickShadow.dx}
                dy={secondTickShadow.dy}
                stdDeviation={options.sunShadowBlur}
                floodColor={options.sunShadowColor}
                floodOpacity={effectiveShadowOpacity}
              />
            </filter>
          )}
        </defs>
        <g transform={`translate(${cx} ${cy})`}>
          {options.showBezel && (
            <DialBackground
              shape={options.dialShape}
              halfW={outerHalfW}
              halfH={outerHalfH}
              cornerRadius={options.dialCornerRadius}
              fill={options.bezelBackground}
              stroke={options.bezelBorderColor}
              strokeWidth={options.bezelBorderWidth}
            />
          )}
          <DialBackground
            shape={options.dialShape}
            halfW={halfW}
            halfH={halfH}
            cornerRadius={options.dialCornerRadius}
            fill={dialFillValue(options.dialFillMode, options.dialBackground, 'alpine-dial-gradient')}
            stroke={options.dialBorderColor}
            strokeWidth={options.dialBorderWidth}
          />
          {options.showBezel && (
            <BezelMarkings
              innerR={Math.min(halfW, halfH)}
              outerR={Math.min(outerHalfW, outerHalfH)}
              options={options}
            />
          )}
          <g filter={hourTickShadow ? 'url(#alpine-tick-shadow-h)' : undefined}>{hourTicks}</g>
          <g filter={minuteTickShadow ? 'url(#alpine-tick-shadow-m)' : undefined}>{minuteTicks}</g>
          <g filter={secondTickShadow ? 'url(#alpine-tick-shadow-s)' : undefined}>{secondTicks}</g>
          {numbers}

          {subdials.map((sd) => (
            <Subdial
              key={`subdial-${sd.n}`}
              cx={sd.cx}
              cy={sd.cy}
              radius={sd.radius}
              config={sd.config}
              value={sd.value}
              filterId="alpine-inner-shadow"
              clockFontFamily={options.hourNumberFontFamily}
            />
          ))}

          {dayWin &&
            (options.dayWindowCurved ? (
              <CurvedTextWindow
                centerAngleDeg={positionAngle(options.dayWindowPosition)}
                midRadius={(r * options.dayWindowDistance) / 100}
                thickness={dayWin.h}
                arcSpanDeg={options.dayWindowArcSpan}
                bg={options.dayWindowBgColor}
                textColor={options.dayWindowTextColor}
                text={dayWin.text}
                fontFamily={options.dayWindowFontFamily}
                fontSize={dayWin.fs}
                filterId="alpine-inner-shadow"
                borderColor={options.dayWindowBorderColor}
                borderWidth={options.dayWindowBorderWidth}
                pathId="alpine-day-arc-path"
              />
            ) : (
              <TextWindow
                cx={dayWin.anchor.x}
                cy={dayWin.anchor.y}
                width={dayWin.w}
                height={dayWin.h}
                cornerRadius={options.dayWindowCornerRadius}
                bg={options.dayWindowBgColor}
                textColor={options.dayWindowTextColor}
                text={dayWin.text}
                fontFamily={options.dayWindowFontFamily}
                fontSize={dayWin.fs}
                filterId="alpine-inner-shadow"
                borderColor={options.dayWindowBorderColor}
                borderWidth={options.dayWindowBorderWidth}
              />
            ))}

          {dateWin &&
            (options.dateWindowCurved ? (
              <CurvedTextWindow
                centerAngleDeg={positionAngle(options.dateWindowPosition)}
                midRadius={(r * options.dateWindowDistance) / 100}
                thickness={dateWin.h}
                arcSpanDeg={options.dateWindowArcSpan}
                bg={options.dateWindowBgColor}
                textColor={options.dateWindowTextColor}
                text={dateWin.text}
                fontFamily={options.dateWindowFontFamily}
                fontSize={dateWin.fs}
                filterId="alpine-inner-shadow"
                borderColor={options.dateWindowBorderColor}
                borderWidth={options.dateWindowBorderWidth}
                pathId="alpine-date-arc-path"
              />
            ) : (
              <TextWindow
                cx={dateWin.anchor.x}
                cy={dateWin.anchor.y}
                width={dateWin.w}
                height={dateWin.h}
                cornerRadius={options.dateWindowCornerRadius}
                bg={options.dateWindowBgColor}
                textColor={options.dateWindowTextColor}
                text={dateWin.text}
                fontFamily={options.dateWindowFontFamily}
                fontSize={dateWin.fs}
                filterId="alpine-inner-shadow"
                borderColor={options.dateWindowBorderColor}
                borderWidth={options.dateWindowBorderWidth}
              />
            ))}

          {rollingDate && (() => {
            const innerW = Math.max(rollingDate.w * 0.72, 1);
            const capFs = Math.min(rollingDate.fs, rollingDate.h * 0.45);
            const dimFs = Math.min(rollingDate.fs * 0.75, rollingDate.h * 0.3);
            return (
              <g transform={`translate(${rollingDate.anchor.x} ${rollingDate.anchor.y})`}>
                <rect
                  x={-rollingDate.w / 2}
                  y={-rollingDate.h / 2}
                  width={rollingDate.w}
                  height={rollingDate.h}
                  rx={4}
                  ry={4}
                  fill={options.rollingDateBgColor}
                  stroke={options.rollingDateBorderWidth > 0 ? options.rollingDateBorderColor : 'none'}
                  strokeWidth={options.rollingDateBorderWidth}
                  filter="url(#alpine-inner-shadow)"
                />
                {/* Three-row strip: prev / current (highlighted) / next */}
                <text
                  x={0}
                  y={-rollingDate.h / 3}
                  fill={options.rollingDateTextColor}
                  opacity={0.35}
                  fontFamily={options.rollingDateFontFamily}
                  fontSize={dimFs}
                  textAnchor="middle"
                  dominantBaseline="central"
                  {...fitText(rollingDate.prev, dimFs, innerW)}
                >
                  {rollingDate.prev}
                </text>
                <rect
                  x={-rollingDate.w / 2 + 2}
                  y={-capFs * 0.7}
                  width={rollingDate.w - 4}
                  height={capFs * 1.4}
                  rx={2}
                  ry={2}
                  fill={options.rollingDateHighlightColor}
                />
                <text
                  x={0}
                  y={0}
                  fill={options.rollingDateTextColor}
                  fontFamily={options.rollingDateFontFamily}
                  fontSize={capFs}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  {...fitText(rollingDate.curr, capFs, innerW)}
                >
                  {rollingDate.curr}
                </text>
                <text
                  x={0}
                  y={rollingDate.h / 3}
                  fill={options.rollingDateTextColor}
                  opacity={0.35}
                  fontFamily={options.rollingDateFontFamily}
                  fontSize={dimFs}
                  textAnchor="middle"
                  dominantBaseline="central"
                  {...fitText(rollingDate.next, dimFs, innerW)}
                >
                  {rollingDate.next}
                </text>
              </g>
            );
          })()}

          {/* Optional visible sun indicator orbiting the dial. Rendered
              beneath the hands so it never hides the tips.  */}
          {options.showSun && effectiveShadowOpacity > 0 && (() => {
            const orbit = (r * options.sunOrbitRadius) / 100;
            const sunRad = ((sunShadow.sunAngleDeg - 90) * Math.PI) / 180;
            const sx = orbit * Math.cos(sunRad);
            const sy = orbit * Math.sin(sunRad);
            const sunR = Math.max((r * options.sunSize) / 100, 1);
            return (
              <g>
                <circle cx={sx} cy={sy} r={sunR * 1.6} fill={options.sunColor} opacity={0.25} />
                <circle cx={sx} cy={sy} r={sunR} fill={options.sunColor} />
              </g>
            );
          })()}

          {globalMetric && (() => {
            const gm = globalMetric;
            const arcEnabled = options.gmFillMode === 'arc' || options.gmFillMode === 'both';
            const arcStartDeg = options.gmStartAngle;
            const arcEndDeg = arcStartDeg + gm.pct * options.gmSweepAngle;
            const rInner = (r * options.gmArcInnerRadius) / 100;
            const rOuter = (r * options.gmArcOuterRadius) / 100;
            const arcPath = buildArcBand(rInner, rOuter, arcStartDeg, arcEndDeg);
            const scaleFs = (r * options.gmScaleNumberFontSize) / 100;
            const scaleR = (r * options.gmScaleRadius) / 100;
            const tickLen = (r * options.gmScaleTickLength) / 100;

            return (
              <g>
                {arcEnabled && gm.pct > 0 && (
                  <path
                    d={arcPath}
                    fill={gm.arcColor}
                    opacity={Math.max(0, Math.min(1, options.gmArcOpacity / 100))}
                  />
                )}
                {options.gmScaleMode !== 'none' &&
                  gm.scaleLabels.map((lbl, i) => {
                    const a = ((lbl.angleDeg - 90) * Math.PI) / 180;
                    const cosA = Math.cos(a);
                    const sinA = Math.sin(a);
                    const tx = scaleR * cosA;
                    const ty = scaleR * sinA;
                    const tickOuterX = (scaleR + tickLen / 2) * cosA;
                    const tickOuterY = (scaleR + tickLen / 2) * sinA;
                    const tickInnerX = (scaleR - tickLen / 2) * cosA;
                    const tickInnerY = (scaleR - tickLen / 2) * sinA;
                    const numR = scaleR - tickLen - scaleFs * 0.8;
                    const nx = numR * cosA;
                    const ny = numR * sinA;
                    return (
                      <g key={`gm-scale-${i}`}>
                        {tickLen > 0 && (
                          <line
                            x1={tickInnerX}
                            y1={tickInnerY}
                            x2={tickOuterX}
                            y2={tickOuterY}
                            stroke={options.gmScaleTickColor}
                            strokeWidth={2}
                          />
                        )}
                        <text
                          x={nx}
                          y={ny}
                          fontSize={scaleFs}
                          fill={options.gmScaleNumberColor}
                          fontFamily={options.gmScaleNumberFontFamily}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {lbl.value.toFixed(Math.max(0, options.gmScaleDecimals))}
                        </text>
                        {/* tx/ty unused, kept for layout reference */}
                        {false && <circle cx={tx} cy={ty} r={0} />}
                      </g>
                    );
                  })}
                <Hand
                  angleDeg={gm.angleDeg}
                  shape={options.gmHandShape}
                  tip={gm.tip}
                  tail={gm.tail}
                  width={options.gmHandWidth}
                  color={gm.handColor}
                  pivotOffset={gm.pivot}
                  counterweightOffset={gm.cwOffset}
                  counterweight={
                    options.gmValueDisplay === 'counterweight' ? (
                      <g>
                        <Counterweight
                          shape={options.gmCounterweightShape}
                          radius={gm.cwSize}
                          color={options.gmCounterweightColor}
                        />
                        <g transform={`rotate(${-gm.angleDeg})`}>
                          <text
                            x={0}
                            y={0}
                            fontSize={options.gmValueFontSize}
                            fill={options.gmValueTextColor}
                            fontFamily={options.gmValueFontFamily}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {gm.formatted}
                          </text>
                        </g>
                      </g>
                    ) : (
                      <Counterweight
                        shape={options.gmCounterweightShape}
                        radius={gm.cwSize}
                        color={options.gmCounterweightColor}
                      />
                    )
                  }
                />
                {options.gmValueDisplay === 'window' && (() => {
                  const anchor = windowAnchor(
                    options.gmValueWindowPosition,
                    (r * options.gmValueWindowDistance) / 100
                  );
                  return (
                    <TextWindow
                      cx={anchor.x}
                      cy={anchor.y}
                      width={options.gmValueWindowWidth}
                      height={options.gmValueWindowHeight}
                      cornerRadius={options.gmValueCornerRadius}
                      bg={options.gmValueBgColor}
                      textColor={options.gmValueTextColor}
                      text={gm.formatted}
                      fontFamily={options.gmValueFontFamily}
                      fontSize={options.gmValueFontSize}
                      filterId="alpine-inner-shadow"
                      borderColor={options.gmValueBorderColor}
                      borderWidth={options.gmValueBorderWidth}
                    />
                  );
                })()}
                {options.gmValueDisplay === 'center' && (
                  <text
                    x={0}
                    y={0}
                    fontSize={options.gmValueFontSize}
                    fill={options.gmValueTextColor}
                    fontFamily={options.gmValueFontFamily}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {gm.formatted}
                  </text>
                )}
              </g>
            );
          })()}

          <g filter={options.showSunShadow ? 'url(#alpine-sun-shadow)' : undefined}>
            <Hand
              angleDeg={hourDeg}
              shape={options.hourHandShape}
              tip={hourTip}
              tail={hourTail}
              width={options.hourHandWidth}
              color={options.hourHandColor}
              pivotOffset={hourPivot}
              counterweightOffset={hourCwOffset}
              counterweight={
                <Counterweight
                  shape={options.hourCounterweightShape}
                  radius={hourCwSize}
                  color={options.hourCounterweightColor}
                />
              }
            />
            <Hand
              angleDeg={minuteDeg}
              shape={options.minuteHandShape}
              tip={minTip}
              tail={minTail}
              width={options.minuteHandWidth}
              color={options.minuteHandColor}
              pivotOffset={minPivot}
              counterweightOffset={minCwOffset}
              counterweight={
                <Counterweight
                  shape={options.minuteCounterweightShape}
                  radius={minCwSize}
                  color={options.minuteCounterweightColor}
                />
              }
            />
            <Hand
              angleDeg={secondDeg}
              shape={options.secondHandShape}
              tip={secTip}
              tail={secTail}
              width={options.secondHandWidth}
              color={options.secondHandColor}
              pivotOffset={secPivot}
              counterweightOffset={secCwOffset}
              counterweight={
                <Counterweight
                  shape={options.secondCounterweightShape}
                  radius={secCwSize}
                  color={options.secondCounterweightColor}
                />
              }
            />
          </g>

          {capSize > 0 && <circle cx={0} cy={0} r={capSize} fill={options.centerCapColor} />}
        </g>
      </svg>
    </div>
  );
};
