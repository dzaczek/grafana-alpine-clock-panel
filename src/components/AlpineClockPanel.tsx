import React, { useEffect, useRef, useState } from 'react';
import { FieldType, PanelData, PanelProps } from '@grafana/data';
import { css } from '@emotion/css';
import {
  AlpineClockOptions,
  HandShape,
  CounterweightShape,
  DialShape,
  HourNumberStyle,
  MechanicalMovementDriveMode,
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

function MechanicalCylinderWindow({
  cx,
  cy,
  width,
  height,
  cornerRadius,
  bg,
  borderColor,
  borderWidth,
  textColor,
  dimTextColor,
  fontFamily,
  valueFontSize,
  unitFontSize,
  prev,
  curr,
  next,
  unit,
  filterId,
}: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  cornerRadius: number;
  bg: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  dimTextColor: string;
  fontFamily: string;
  valueFontSize: number;
  unitFontSize: number;
  prev: string;
  curr: string;
  next: string;
  unit: string;
  filterId: string;
}) {
  const innerWidth = Math.max(width * 0.56, 1);
  const rowOffset = height * 0.28;
  const bandHeight = height * 0.42;
  const unitGap = Math.max(valueFontSize * 0.16, 4);
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
      <rect
        x={-width / 2 + 1}
        y={-height / 2 + 1}
        width={width - 2}
        height={height * 0.22}
        rx={Math.max(cornerRadius - 1, 0)}
        ry={Math.max(cornerRadius - 1, 0)}
        fill="#ffffff"
        opacity={0.06}
      />
      <rect
        x={-width / 2 + 1}
        y={-bandHeight / 2}
        width={width - 2}
        height={bandHeight}
        rx={Math.max(cornerRadius - 2, 0)}
        ry={Math.max(cornerRadius - 2, 0)}
        fill="#ffffff"
        opacity={0.07}
      />
      <rect
        x={-width / 2 + 1}
        y={height * 0.14}
        width={width - 2}
        height={height * 0.18}
        rx={Math.max(cornerRadius - 1, 0)}
        ry={Math.max(cornerRadius - 1, 0)}
        fill="#000000"
        opacity={0.14}
      />
      <text
        x={0}
        y={-rowOffset}
        fill={dimTextColor}
        opacity={0.3}
        fontFamily={fontFamily}
        fontSize={Math.min(valueFontSize * 0.62, height * 0.26)}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        {...fitText(prev, valueFontSize * 0.62, innerWidth)}
      >
        {prev}
      </text>
      <g>
        <text
          x={unit ? -unitGap / 2 : 0}
          y={0}
          fill={textColor}
          fontFamily={fontFamily}
          fontSize={Math.min(valueFontSize, height * 0.44)}
          fontWeight="bold"
          textAnchor={unit ? 'end' : 'middle'}
          dominantBaseline="central"
          {...fitText(curr, valueFontSize, innerWidth)}
        >
          {curr}
        </text>
        {unit && (
          <text
            x={unitGap / 2}
            y={0}
            fill={dimTextColor}
            fontFamily={fontFamily}
            fontSize={Math.min(unitFontSize, height * 0.2)}
            textAnchor="start"
            dominantBaseline="central"
          >
            {unit}
          </text>
        )}
      </g>
      <text
        x={0}
        y={rowOffset}
        fill={dimTextColor}
        opacity={0.24}
        fontFamily={fontFamily}
        fontSize={Math.min(valueFontSize * 0.58, height * 0.24)}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        {...fitText(next, valueFontSize * 0.58, innerWidth)}
      >
        {next}
      </text>
    </g>
  );
}

function MechanicalBarsWindow({
  cx,
  cy,
  width,
  height,
  cornerRadius,
  bg,
  borderColor,
  borderWidth,
  values,
  barColor,
  barHighlight,
  filterId,
}: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  cornerRadius: number;
  bg: string;
  borderColor: string;
  borderWidth: number;
  values: number[];
  barColor: string;
  barHighlight: string;
  filterId: string;
}) {
  const samples = values.slice(-18);
  const min = samples.length ? Math.min(...samples) : 0;
  const max = samples.length ? Math.max(...samples) : 1;
  const span = Math.max(max - min, 1e-6);
  const usableHeight = height * 0.72;
  const floorY = height / 2 - height * 0.12;
  const gap = width * 0.015;
  const barWidth = samples.length > 0 ? (width - gap * (samples.length + 1)) / samples.length : 0;
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
      <rect
        x={-width / 2 + 1}
        y={-height / 2 + 1}
        width={width - 2}
        height={height * 0.18}
        rx={Math.max(cornerRadius - 1, 0)}
        ry={Math.max(cornerRadius - 1, 0)}
        fill="#ffffff"
        opacity={0.05}
      />
      <g>
        {samples.map((value, index) => {
          const h = ((value - min) / span) * usableHeight + height * 0.12;
          const x = -width / 2 + gap + index * (barWidth + gap);
          const y = floorY - h;
          const rx = Math.max(Math.min(barWidth * 0.45, 6), 1.5);
          return (
            <g key={`mech-bar-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={rx}
                ry={rx}
                fill={barColor}
                opacity={0.86}
              />
              <rect
                x={x + barWidth * 0.16}
                y={y + 1}
                width={Math.max(barWidth * 0.2, 1)}
                height={Math.max(h - 2, 0)}
                rx={Math.max(rx * 0.55, 1)}
                ry={Math.max(rx * 0.55, 1)}
                fill={barHighlight}
                opacity={0.28}
              />
            </g>
          );
        })}
      </g>
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
 * Raw numeric history for the selected metric. Used by the optional global
 * metric sparkline.
 */
function readMetricSeries(data: PanelData, fieldName: string, queryRefId: string): number[] {
  if (!data?.series?.length) {
    return [];
  }
  const frames = queryRefId
    ? data.series.filter((frame) => frame.refId === queryRefId)
    : data.series;
  if (!frames.length) {
    return [];
  }

  let targetValues: Array<number | null | undefined> | null = null;
  if (fieldName) {
    for (const frame of frames) {
      const field = frame.fields.find((f) => f.name === fieldName);
      if (field && field.type === FieldType.number) {
        targetValues = field.values as unknown as Array<number | null | undefined>;
        break;
      }
    }
  } else {
    const numeric = frames[0].fields.find((f) => f.type === FieldType.number);
    if (numeric) {
      targetValues = numeric.values as unknown as Array<number | null | undefined>;
    }
  }

  if (!targetValues?.length) {
    return [];
  }
  const out: number[] = [];
  for (const v of targetValues) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out.push(v);
    }
  }
  return out;
}

function parseGaugeLabelValues(raw: string, min: number, max: number): number[] {
  if (!raw.trim()) {
    return [];
  }
  const seen = new Set<number>();
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= min && value <= max)
    .sort((a, b) => a - b)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

function formatGaugeLabelValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function toRomanNumeral(value: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = Math.max(1, Math.floor(value));
  let out = '';
  for (const [unit, glyph] of numerals) {
    while (remaining >= unit) {
      out += glyph;
      remaining -= unit;
    }
  }
  return out;
}

function formatHourNumber(value: number, style: HourNumberStyle): string {
  return style === 'roman' || style === 'circled-roman' ? toRomanNumeral(value) : String(value);
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim();
  if (!hex.startsWith('#')) {
    return null;
  }
  const body = hex.slice(1);
  if (body.length === 3) {
    const [r, g, b] = body.split('');
    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
    };
  }
  if (body.length === 6) {
    return {
      r: Number.parseInt(body.slice(0, 2), 16),
      g: Number.parseInt(body.slice(2, 4), 16),
      b: Number.parseInt(body.slice(4, 6), 16),
    };
  }
  return null;
}

function mixHexColor(color1: string, color2: string, t: number): string {
  const a = parseHexColor(color1);
  const b = parseHexColor(color2);
  const clamped = Math.max(0, Math.min(1, t));
  if (!a || !b) {
    return clamped < 0.5 ? color1 : color2;
  }
  const mix = (x: number, y: number) => Math.round(x + (y - x) * clamped);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
}

function withAlpha(color: string, alpha: number): string {
  const parsed = parseHexColor(color);
  const clamped = Math.max(0, Math.min(1, alpha));
  if (!parsed) {
    return color;
  }
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${clamped})`;
}

function spiralPath(
  turns: number,
  startRadius: number,
  endRadius: number,
  angleOffsetDeg = 0
): string {
  const samples = Math.max(32, Math.ceil(turns * 28));
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const angle = ((angleOffsetDeg - 90) * Math.PI) / 180 + t * turns * Math.PI * 2;
    const radius = startRadius + (endRadius - startRadius) * t;
    points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
}

function MovementScrew({
  cx,
  cy,
  radius,
  metalColor,
  shadowColor,
  angleDeg,
}: {
  cx: number;
  cy: number;
  radius: number;
  metalColor: string;
  shadowColor: string;
  angleDeg: number;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angleDeg})`}>
      <circle cx={0} cy={0} r={radius} fill={metalColor} stroke={shadowColor} strokeWidth={Math.max(radius * 0.18, 0.8)} />
      <circle cx={0} cy={0} r={radius * 0.74} fill={withAlpha('#ffffff', 0.16)} />
      <line
        x1={-radius * 0.48}
        y1={0}
        x2={radius * 0.48}
        y2={0}
        stroke={shadowColor}
        strokeWidth={Math.max(radius * 0.22, 1)}
        strokeLinecap="round"
      />
    </g>
  );
}

type GearToothProfile = 'train' | 'ratchet' | 'escape' | 'crown' | 'pinion';

const MECHANICAL_GEAR_TEETH = {
  barrel: 72,
  ratchet: 24,
  crown: 22,
  winding: 18,
  centerPinion: 12,
  centerWheel: 80,
  hourWheel: 32,
  reduction: 20,
  thirdPinion: 10,
  thirdWheel: 75,
  fourthPinion: 10,
  fourthWheel: 60,
  secondsIntermediate: 18,
  escapeDrive: 7,
  escape: 15,
} as const;

function polarPointRad(radius: number, angleRad: number): { x: number; y: number } {
  return { x: radius * Math.cos(angleRad), y: radius * Math.sin(angleRad) };
}

function gearToothControlPoints(
  toothIndex: number,
  teeth: number,
  rootRadius: number,
  tipRadius: number,
  profile: GearToothProfile
): Array<{ x: number; y: number }> {
  const step = (Math.PI * 2) / teeth;
  const start = toothIndex * step;
  const flankRadius = rootRadius + (tipRadius - rootRadius) * (profile === 'pinion' ? 0.82 : 0.58);
  const specs: Array<[number, number]> =
    profile === 'ratchet'
      ? [
          [0, rootRadius],
          [0.08, flankRadius * 0.98],
          [0.18, tipRadius],
          [0.46, tipRadius],
          [1, rootRadius],
        ]
      : profile === 'escape'
        ? [
            [0, rootRadius],
            [0.18, flankRadius],
            [0.42, tipRadius],
            [0.58, tipRadius * 0.98],
            [0.72, flankRadius * 1.03],
            [1, rootRadius],
          ]
        : profile === 'crown'
          ? [
              [0, rootRadius],
              [0.12, flankRadius],
              [0.26, tipRadius],
              [0.74, tipRadius],
              [0.88, flankRadius],
              [1, rootRadius],
            ]
          : profile === 'pinion'
            ? [
                [0, rootRadius],
                [0.14, flankRadius],
                [0.5, tipRadius],
                [0.86, flankRadius],
                [1, rootRadius],
              ]
            : [
                [0, rootRadius],
                [0.14, flankRadius],
                [0.3, tipRadius],
                [0.7, tipRadius],
                [0.86, flankRadius],
                [1, rootRadius],
              ];
  return specs.map(([fraction, radius]) => polarPointRad(radius, start + fraction * step));
}

function buildGearOutlinePath(
  teeth: number,
  rootRadius: number,
  tipRadius: number,
  profile: GearToothProfile
): string {
  const points: Array<{ x: number; y: number }> = [];
  for (let tooth = 0; tooth < teeth; tooth++) {
    const toothPoints = gearToothControlPoints(tooth, teeth, rootRadius, tipRadius, profile);
    if (tooth === 0) {
      points.push(...toothPoints);
    } else {
      points.push(...toothPoints.slice(1));
    }
  }
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
}

function buildGearAccentPath(
  toothIndex: number,
  teeth: number,
  rootRadius: number,
  tipRadius: number,
  profile: GearToothProfile
): string {
  const points = gearToothControlPoints(toothIndex, teeth, rootRadius, tipRadius, profile);
  const insetRoot = rootRadius + (tipRadius - rootRadius) * 0.42;
  const innerStart = polarPointRad(insetRoot, toothIndex * ((Math.PI * 2) / teeth) + ((Math.PI * 2) / teeth) * 0.18);
  const innerEnd = polarPointRad(insetRoot, toothIndex * ((Math.PI * 2) / teeth) + ((Math.PI * 2) / teeth) * 0.82);
  const accentPoints = [innerStart, ...points.slice(1, points.length - 1), innerEnd];
  return `${accentPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
}

function gearPitchRadius(radius: number, toothDepth: number): number {
  return Math.max(radius - toothDepth * 0.56, 1);
}

function meshCenterFrom(
  source: { x: number; y: number },
  sourceRadius: number,
  sourceToothDepth: number,
  targetRadius: number,
  targetToothDepth: number,
  angleDeg: number
): { x: number; y: number } {
  const distance =
    gearPitchRadius(sourceRadius, sourceToothDepth) +
    gearPitchRadius(targetRadius, targetToothDepth);
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: source.x + Math.cos(angleRad) * distance,
    y: source.y + Math.sin(angleRad) * distance,
  };
}

function GearWheel({
  cx,
  cy,
  radius,
  teeth,
  toothDepth,
  spokeCount,
  angleDeg,
  metalColor,
  shadowColor,
  highlightColor,
  jewelColor,
  hubRadius,
  accentColor,
  accentStride,
  accentOffset = 0,
  toothProfile = 'train',
}: {
  cx: number;
  cy: number;
  radius: number;
  teeth: number;
  toothDepth: number;
  spokeCount: number;
  angleDeg: number;
  metalColor: string;
  shadowColor: string;
  highlightColor: string;
  jewelColor: string;
  hubRadius?: number;
  accentColor?: string;
  accentStride?: number;
  accentOffset?: number;
  toothProfile?: GearToothProfile;
}) {
  const toothTipRadius = Math.max(radius, 1);
  const rimRadius = Math.max(radius - toothDepth, 1);
  const innerHub = hubRadius ?? Math.max(radius * 0.2, 3);
  const spokeOuter = rimRadius * 0.68;
  const spokeStroke = Math.max(radius * 0.12, 2);
  const ringStroke = Math.max(radius * 0.055, 1.2);
  const innerRing = Math.max(rimRadius * 0.42, innerHub + 2);
  const gearOutline = buildGearOutlinePath(teeth, rimRadius, toothTipRadius, toothProfile);

  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angleDeg})`}>
      <path d={gearOutline} fill={metalColor} stroke={shadowColor} strokeWidth={ringStroke} strokeLinejoin="round" />
      {accentColor && accentStride && Array.from({ length: teeth }, (_, index) => (
        ((index - accentOffset + teeth) % accentStride === 0) ? (
          <path
            key={`gear-accent-${index}`}
            d={buildGearAccentPath(index, teeth, rimRadius, toothTipRadius, toothProfile)}
            fill={accentColor}
            opacity={0.92}
          />
        ) : null
      ))}
      <circle cx={0} cy={0} r={rimRadius} fill="none" stroke={withAlpha(highlightColor, 0.22)} strokeWidth={Math.max(ringStroke * 0.55, 0.8)} />
      <circle
        cx={0}
        cy={0}
        r={innerRing}
        fill={withAlpha(shadowColor, 0.26)}
        stroke={withAlpha(highlightColor, 0.26)}
        strokeWidth={Math.max(ringStroke * 0.55, 0.8)}
      />
      {Array.from({ length: Math.max(spokeCount, 0) }, (_, index) => (
        <line
          key={`gear-spoke-${index}`}
          x1={0}
          y1={innerHub}
          x2={0}
          y2={spokeOuter}
          stroke={shadowColor}
          strokeWidth={spokeStroke}
          strokeLinecap="round"
          transform={`rotate(${(360 * index) / Math.max(spokeCount, 1)})`}
        />
      ))}
      <circle cx={0} cy={0} r={innerHub * 1.34} fill={shadowColor} opacity={0.56} />
      <circle cx={0} cy={0} r={innerHub} fill={metalColor} stroke={highlightColor} strokeWidth={0.8} />
      <circle cx={0} cy={0} r={Math.max(innerHub * 0.34, 1.6)} fill={jewelColor} />
    </g>
  );
}

function StopToGoGateWheel({
  cx,
  cy,
  radius,
  teeth,
  toothDepth,
  angleDeg,
  gapFraction,
  paused,
  metalColor,
  plateColor,
  shadowColor,
  highlightColor,
  jewelColor,
}: {
  cx: number;
  cy: number;
  radius: number;
  teeth: number;
  toothDepth: number;
  angleDeg: number;
  gapFraction: number;
  paused: boolean;
  metalColor: string;
  plateColor: string;
  shadowColor: string;
  highlightColor: string;
  jewelColor: string;
}) {
  const gapDeg = Math.max(12, Math.min(150, gapFraction * 360));
  const gapPath = buildArcBand(
    Math.max(radius - toothDepth * 1.6, radius * 0.38),
    radius * 1.05,
    -gapDeg / 2,
    gapDeg / 2
  );
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <GearWheel
        cx={0}
        cy={0}
        radius={radius}
        teeth={teeth}
        toothDepth={toothDepth}
        spokeCount={3}
        angleDeg={angleDeg}
        metalColor={metalColor}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        toothProfile="train"
        hubRadius={Math.max(radius * 0.18, 2.2)}
      />
      <g transform={`rotate(${angleDeg})`}>
        <path d={gapPath} fill={plateColor} stroke={withAlpha(shadowColor, 0.34)} strokeWidth={1} />
        <path
          d={buildArcBand(Math.max(radius - toothDepth * 0.9, radius * 0.72), radius * 1.04, -gapDeg * 0.38, gapDeg * 0.38)}
          fill={withAlpha(plateColor, 0.92)}
        />
      </g>
      <circle
        cx={0}
        cy={0}
        r={Math.max(radius * 0.12, 1.8)}
        fill={paused ? mixHexColor(jewelColor, '#ffd89d', 0.22) : jewelColor}
      />
    </g>
  );
}

function BarrelWheel({
  cx,
  cy,
  radius,
  teeth,
  toothDepth,
  angleDeg,
  metalColor,
  shadowColor,
  highlightColor,
  jewelColor,
}: {
  cx: number;
  cy: number;
  radius: number;
  teeth: number;
  toothDepth: number;
  angleDeg: number;
  metalColor: string;
  shadowColor: string;
  highlightColor: string;
  jewelColor: string;
}) {
  const springOuter = radius * 0.72;
  const springInner = radius * 0.16;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <GearWheel
        cx={0}
        cy={0}
        radius={radius}
        teeth={teeth}
        toothDepth={toothDepth}
        spokeCount={0}
        angleDeg={angleDeg}
        metalColor={metalColor}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(radius * 0.16, 4)}
        toothProfile="train"
      />
      <g transform={`rotate(${angleDeg * 0.48})`}>
        <path
          d={spiralPath(4.8, springInner, springOuter, 12)}
          fill="none"
          stroke={withAlpha(shadowColor, 0.72)}
          strokeWidth={Math.max(radius * 0.05, 1.2)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

function BalanceAssembly({
  cx,
  cy,
  radius,
  swingDeg,
  metalColor,
  shadowColor,
  highlightColor,
  jewelColor,
}: {
  cx: number;
  cy: number;
  radius: number;
  swingDeg: number;
  metalColor: string;
  shadowColor: string;
  highlightColor: string;
  jewelColor: string;
}) {
  const rimStroke = Math.max(radius * 0.14, 2.2);
  const hubRadius = Math.max(radius * 0.16, 3);
  const weightRadius = Math.max(radius * 0.1, 2.2);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path
        d={spiralPath(2.4, radius * 0.08, radius * 0.44, 0)}
        fill="none"
        stroke={withAlpha(highlightColor, 0.58)}
        strokeWidth={Math.max(radius * 0.03, 0.8)}
        strokeLinecap="round"
      />
      <g transform={`rotate(${swingDeg})`}>
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill="none"
          stroke={metalColor}
          strokeWidth={rimStroke}
        />
        <circle
          cx={0}
          cy={0}
          r={radius * 0.78}
          fill="none"
          stroke={withAlpha(highlightColor, 0.42)}
          strokeWidth={Math.max(radius * 0.05, 1)}
        />
        <line x1={0} y1={-radius * 0.84} x2={0} y2={radius * 0.84} stroke={shadowColor} strokeWidth={Math.max(radius * 0.08, 1.4)} strokeLinecap="round" />
        <line x1={-radius * 0.84} y1={0} x2={radius * 0.84} y2={0} stroke={shadowColor} strokeWidth={Math.max(radius * 0.08, 1.4)} strokeLinecap="round" />
        <circle cx={radius * 0.84} cy={0} r={weightRadius} fill={metalColor} stroke={shadowColor} strokeWidth={1} />
        <circle cx={-radius * 0.84} cy={0} r={weightRadius} fill={metalColor} stroke={shadowColor} strokeWidth={1} />
      </g>
      <circle cx={0} cy={0} r={hubRadius} fill={shadowColor} />
      <circle cx={0} cy={0} r={Math.max(hubRadius * 0.36, 1.4)} fill={jewelColor} />
    </g>
  );
}

function ForkAssembly({
  cx,
  cy,
  angleDeg,
  size,
  color,
  jewelColor,
}: {
  cx: number;
  cy: number;
  angleDeg: number;
  size: number;
  color: string;
  jewelColor: string;
}) {
  const arm = size * 0.82;
  const width = Math.max(size * 0.18, 2);
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angleDeg})`}>
      <line x1={0} y1={0} x2={0} y2={-arm} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <line x1={0} y1={-arm} x2={-size * 0.42} y2={-size * 1.12} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <line x1={0} y1={-arm} x2={size * 0.42} y2={-size * 1.12} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <circle cx={0} cy={0} r={Math.max(size * 0.16, 2)} fill={jewelColor} />
    </g>
  );
}

function MovementBridge({
  d,
  width,
  fill,
  shadow,
}: {
  d: string;
  width: number;
  fill: string;
  shadow: string;
}) {
  return (
    <g>
      <path d={d} fill="none" stroke={shadow} strokeWidth={width + 2} strokeLinecap="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={width} strokeLinecap="round" />
    </g>
  );
}

function normalizeAngleDeg(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function turnsToAngleDeg(turns: number): number {
  return normalizeAngleDeg(turns * 360);
}

function angleDegToTurns(angleDeg: number): number {
  return angleDeg / 360;
}

function meshDrivenTurns(driverTurns: number, driverTeeth: number, drivenTeeth: number): number {
  return -driverTurns * (driverTeeth / drivenTeeth);
}

interface MechanicalMovementState {
  driveMode: MechanicalMovementDriveMode;
  stopToGoEnabled: boolean;
  stopToGoPauseActive: boolean;
  stopToGoGateAngle: number;
  stopToGoGapFraction: number;
  handHourDeg: number;
  handMinuteDeg: number;
  handSecondDeg: number;
  barrelAngle: number;
  ratchetAngle: number;
  crownAngle: number;
  windingAngle: number;
  centerAngle: number;
  hourWheelAngle: number;
  reductionAngle: number;
  thirdAngle: number;
  fourthAngle: number;
  secondsIntermediateAngle: number;
  escapeAngle: number;
  balanceSwing: number;
  forkAngle: number;
  windingLeverAngle: number;
  clickAngle: number;
}

function buildMechanicalMovementState({
  nowMs,
  hourDeg,
  minuteDeg,
  secondDeg,
  driveMode,
  crownTurnsPerMinute,
  stopToGoEnabled,
  sweepMs,
  pauseMs,
}: {
  nowMs: number;
  hourDeg: number;
  minuteDeg: number;
  secondDeg: number;
  driveMode: MechanicalMovementDriveMode;
  crownTurnsPerMinute: number;
  stopToGoEnabled: boolean;
  sweepMs: number;
  pauseMs: number;
}): MechanicalMovementState {
  const centerTurns = angleDegToTurns(minuteDeg);
  const hourTurns = angleDegToTurns(hourDeg);
  const secondTurns = angleDegToTurns(secondDeg);
  const minuteIndex = Math.floor(centerTurns * 60 + 1e-6);
  const hourIndex = Math.floor(hourTurns * 12 + 1e-6);
  const minuteCycleMs = 60000;
  const continuousSecondFractionTurns =
    ((((nowMs % minuteCycleMs) + minuteCycleMs) % minuteCycleMs) / minuteCycleMs);
  const displayFourthTurns = minuteIndex + secondTurns;
  const continuousFourthTurns = minuteIndex + continuousSecondFractionTurns;
  const sweepWindowMs = Math.max(sweepMs, 1);
  const stopWindowMs = Math.max(pauseMs, 0);
  const stopCycleMs = sweepWindowMs + stopWindowMs;
  const stopCyclePosMs =
    stopCycleMs > 0 ? (((nowMs % stopCycleMs) + stopCycleMs) % stopCycleMs) : 0;
  const stopToGoPauseActive = stopToGoEnabled && stopWindowMs > 0 && stopCyclePosMs >= sweepWindowMs;
  const stopToGoGapFraction =
    stopToGoEnabled && stopCycleMs > 0 ? Math.max(0.04, Math.min(0.42, stopWindowMs / stopCycleMs)) : 0;
  const continuousTrainCenterTurns = minuteIndex / 60 + continuousSecondFractionTurns / 60;
  const continuousTrainHourTurns = hourIndex / 12 + continuousTrainCenterTurns / 12;
  const baseBarrelTurns =
    -continuousTrainCenterTurns * (MECHANICAL_GEAR_TEETH.centerPinion / MECHANICAL_GEAR_TEETH.barrel);
  const baseReductionTurns = meshDrivenTurns(
    continuousTrainCenterTurns,
    MECHANICAL_GEAR_TEETH.centerWheel,
    MECHANICAL_GEAR_TEETH.reduction
  );
  const baseThirdTurns = meshDrivenTurns(
    continuousTrainCenterTurns,
    MECHANICAL_GEAR_TEETH.centerWheel,
    MECHANICAL_GEAR_TEETH.thirdPinion
  );
  const baseFourthTurns = displayFourthTurns;
  const baseSecondsIntermediateTurns = meshDrivenTurns(
    continuousTrainCenterTurns,
    MECHANICAL_GEAR_TEETH.centerWheel,
    MECHANICAL_GEAR_TEETH.secondsIntermediate
  );
  const baseGateTurns = continuousFourthTurns;
  const baseEscapeTurns = meshDrivenTurns(
    continuousFourthTurns,
    MECHANICAL_GEAR_TEETH.fourthWheel,
    MECHANICAL_GEAR_TEETH.escapeDrive
  );
  const beatPhase = baseEscapeTurns * MECHANICAL_GEAR_TEETH.escape * Math.PI;
  const balanceSwing = Math.sin(beatPhase) * 28;
  const forkAngle = Math.sin(beatPhase + Math.PI / 3) * 12;

  if (driveMode === 'wind') {
    const crownTurns = (nowMs / 60000) * crownTurnsPerMinute;
    const windingTurns = meshDrivenTurns(
      crownTurns,
      MECHANICAL_GEAR_TEETH.crown,
      MECHANICAL_GEAR_TEETH.winding
    );
    const ratchetAdvanceTurns =
      crownTurns * (MECHANICAL_GEAR_TEETH.crown / MECHANICAL_GEAR_TEETH.ratchet) * 0.18;
    const clickPhase = crownTurns * Math.PI * 2;
    return {
      driveMode,
      stopToGoEnabled,
      stopToGoPauseActive,
      stopToGoGateAngle: turnsToAngleDeg(baseGateTurns),
      stopToGoGapFraction,
      handHourDeg: turnsToAngleDeg(hourTurns),
      handMinuteDeg: turnsToAngleDeg(centerTurns),
      handSecondDeg: turnsToAngleDeg(secondTurns),
      barrelAngle: turnsToAngleDeg(baseBarrelTurns + ratchetAdvanceTurns * 0.12),
      ratchetAngle: turnsToAngleDeg(baseBarrelTurns + ratchetAdvanceTurns),
      crownAngle: turnsToAngleDeg(crownTurns),
      windingAngle: turnsToAngleDeg(windingTurns),
      centerAngle: turnsToAngleDeg(continuousTrainCenterTurns),
      hourWheelAngle: turnsToAngleDeg(continuousTrainHourTurns),
      reductionAngle: turnsToAngleDeg(baseReductionTurns),
      thirdAngle: turnsToAngleDeg(baseThirdTurns),
      fourthAngle: turnsToAngleDeg(baseFourthTurns),
      secondsIntermediateAngle: turnsToAngleDeg(baseSecondsIntermediateTurns),
      escapeAngle: turnsToAngleDeg(baseEscapeTurns),
      balanceSwing,
      forkAngle,
      windingLeverAngle: Math.sin(clickPhase * 0.5) * 6,
      clickAngle: Math.max(0, Math.sin(clickPhase * 6)) * 14,
    };
  }

  if (driveMode === 'set-time') {
    const crownTurns = (nowMs / 60000) * crownTurnsPerMinute;
    const windingTurns =
      meshDrivenTurns(crownTurns, MECHANICAL_GEAR_TEETH.crown, MECHANICAL_GEAR_TEETH.winding) *
      0.42;
    const settingReductionTurns =
      baseReductionTurns +
      meshDrivenTurns(crownTurns, MECHANICAL_GEAR_TEETH.crown, MECHANICAL_GEAR_TEETH.reduction) *
        0.34;
    return {
      driveMode,
      stopToGoEnabled,
      stopToGoPauseActive,
      stopToGoGateAngle: turnsToAngleDeg(baseGateTurns),
      stopToGoGapFraction,
      handHourDeg: turnsToAngleDeg(hourTurns),
      handMinuteDeg: turnsToAngleDeg(centerTurns),
      handSecondDeg: turnsToAngleDeg(secondTurns),
      barrelAngle: turnsToAngleDeg(baseBarrelTurns),
      ratchetAngle: turnsToAngleDeg(baseBarrelTurns),
      crownAngle: turnsToAngleDeg(crownTurns),
      windingAngle: turnsToAngleDeg(windingTurns),
      centerAngle: turnsToAngleDeg(continuousTrainCenterTurns),
      hourWheelAngle: turnsToAngleDeg(continuousTrainHourTurns),
      reductionAngle: turnsToAngleDeg(settingReductionTurns),
      thirdAngle: turnsToAngleDeg(baseThirdTurns),
      fourthAngle: turnsToAngleDeg(baseFourthTurns),
      secondsIntermediateAngle: turnsToAngleDeg(baseSecondsIntermediateTurns),
      escapeAngle: turnsToAngleDeg(baseEscapeTurns),
      balanceSwing,
      forkAngle,
      windingLeverAngle: Math.sin(crownTurns * Math.PI * 0.8) * 5,
      clickAngle: 0,
    };
  }

  return {
    driveMode: 'run',
    stopToGoEnabled,
    stopToGoPauseActive,
    stopToGoGateAngle: turnsToAngleDeg(baseGateTurns),
    stopToGoGapFraction,
    handHourDeg: turnsToAngleDeg(hourTurns),
    handMinuteDeg: turnsToAngleDeg(centerTurns),
    handSecondDeg: turnsToAngleDeg(secondTurns),
    barrelAngle: turnsToAngleDeg(baseBarrelTurns),
    ratchetAngle: turnsToAngleDeg(baseBarrelTurns),
    crownAngle: 0,
    windingAngle: 0,
    centerAngle: turnsToAngleDeg(continuousTrainCenterTurns),
    hourWheelAngle: turnsToAngleDeg(continuousTrainHourTurns),
    reductionAngle: turnsToAngleDeg(baseReductionTurns),
    thirdAngle: turnsToAngleDeg(baseThirdTurns),
    fourthAngle: turnsToAngleDeg(baseFourthTurns),
    secondsIntermediateAngle: turnsToAngleDeg(baseSecondsIntermediateTurns),
    escapeAngle: turnsToAngleDeg(baseEscapeTurns),
    balanceSwing,
    forkAngle,
    windingLeverAngle: 0,
    clickAngle: 0,
  };
}

function SkeletonMovement({
  r,
  state,
  metalColor,
  bridgeColor,
  jewelColor,
  opacity,
}: {
  r: number;
  state: MechanicalMovementState;
  metalColor: string;
  bridgeColor: string;
  jewelColor: string;
  opacity: number;
}) {
  const shadowColor = mixHexColor(metalColor, '#111111', 0.52);
  const highlightColor = mixHexColor(metalColor, '#ffffff', 0.26);
  const plateColor = mixHexColor(bridgeColor, '#0f1216', 0.34);
  const barrelSpec = { radius: r * 0.265, toothDepth: Math.max(r * 0.16, 4) };
  const ratchetSpec = { radius: r * 0.118, toothDepth: Math.max(r * 0.026, 2.6) };
  const crownSpec = { radius: r * 0.102, toothDepth: Math.max(r * 0.026, 2.6) };
  const windingSpec = { radius: r * 0.092, toothDepth: Math.max(r * 0.022, 2.2) };
  const centerWheelSpec = { radius: r * 0.224, toothDepth: Math.max(r * 0.034, 3.4) };
  const centerPinionSpec = { radius: r * 0.068, toothDepth: Math.max(r * 0.012, 1.4) };
  const hourWheelSpec = { radius: r * 0.148, toothDepth: Math.max(r * 0.018, 1.8) };
  const reductionSpec = { radius: r * 0.092, toothDepth: Math.max(r * 0.016, 1.8) };
  const thirdWheelSpec = { radius: r * 0.142, toothDepth: Math.max(r * 0.028, 2.6) };
  const thirdPinionSpec = { radius: r * 0.058, toothDepth: Math.max(r * 0.011, 1.2) };
  const fourthWheelSpec = { radius: r * 0.102, toothDepth: Math.max(r * 0.02, 2) };
  const fourthPinionSpec = { radius: r * 0.046, toothDepth: Math.max(r * 0.01, 1.1) };
  const secondsIntermediateSpec = { radius: r * 0.072, toothDepth: Math.max(r * 0.017, 1.6) };
  const stopGateSpec = { radius: r * 0.064, toothDepth: Math.max(r * 0.016, 1.5) };
  const escapeDriveSpec = { radius: r * 0.05, toothDepth: Math.max(r * 0.01, 1.1) };
  const escapeSpec = { radius: r * 0.086, toothDepth: Math.max(r * 0.022, 2) };
  const barrelPos = { x: -r * 0.33, y: r * 0.02 };
  const centerPos = meshCenterFrom(
    barrelPos,
    barrelSpec.radius,
    barrelSpec.toothDepth,
    centerPinionSpec.radius,
    centerPinionSpec.toothDepth,
    12
  );
  const thirdPos = meshCenterFrom(
    centerPos,
    centerWheelSpec.radius,
    centerWheelSpec.toothDepth,
    thirdPinionSpec.radius,
    thirdPinionSpec.toothDepth,
    -28
  );
  const fourthPos = meshCenterFrom(
    thirdPos,
    thirdWheelSpec.radius,
    thirdWheelSpec.toothDepth,
    fourthPinionSpec.radius,
    fourthPinionSpec.toothDepth,
    18
  );
  const escapePos = meshCenterFrom(
    fourthPos,
    fourthWheelSpec.radius,
    fourthWheelSpec.toothDepth,
    escapeDriveSpec.radius,
    escapeDriveSpec.toothDepth,
    84
  );
  const stopGatePos = {
    x: fourthPos.x + (escapePos.x - fourthPos.x) * 0.48 + r * 0.04,
    y: fourthPos.y + (escapePos.y - fourthPos.y) * 0.42 - r * 0.045,
  };
  const crownPos = meshCenterFrom(
    barrelPos,
    ratchetSpec.radius,
    ratchetSpec.toothDepth,
    crownSpec.radius,
    crownSpec.toothDepth,
    -34
  );
  const windingPos = meshCenterFrom(
    crownPos,
    crownSpec.radius,
    crownSpec.toothDepth,
    windingSpec.radius,
    windingSpec.toothDepth,
    -8
  );
  const reductionPos = meshCenterFrom(
    centerPos,
    centerWheelSpec.radius,
    centerWheelSpec.toothDepth,
    reductionSpec.radius,
    reductionSpec.toothDepth,
    128
  );
  const barrel = { ...barrelPos, radius: barrelSpec.radius, toothDepth: barrelSpec.toothDepth, angle: state.barrelAngle };
  const ratchet = { ...barrelPos, radius: ratchetSpec.radius, toothDepth: ratchetSpec.toothDepth, angle: state.ratchetAngle };
  const crown = { ...crownPos, radius: crownSpec.radius, toothDepth: crownSpec.toothDepth, angle: state.crownAngle };
  const winding = { ...windingPos, radius: windingSpec.radius, toothDepth: windingSpec.toothDepth, angle: state.windingAngle };
  const center = { ...centerPos, radius: centerWheelSpec.radius, toothDepth: centerWheelSpec.toothDepth, angle: state.centerAngle };
  const hourWheel = { ...centerPos, radius: hourWheelSpec.radius, toothDepth: hourWheelSpec.toothDepth, angle: state.hourWheelAngle };
  const reduction = { ...reductionPos, radius: reductionSpec.radius, toothDepth: reductionSpec.toothDepth, angle: state.reductionAngle };
  const third = { ...thirdPos, radius: thirdWheelSpec.radius, toothDepth: thirdWheelSpec.toothDepth, angle: state.thirdAngle };
  const fourth = { ...fourthPos, radius: fourthWheelSpec.radius, toothDepth: fourthWheelSpec.toothDepth, angle: state.fourthAngle };
  const secondsIntermediate = {
    ...meshCenterFrom(
      centerPos,
      centerWheelSpec.radius,
      centerWheelSpec.toothDepth,
      secondsIntermediateSpec.radius,
      secondsIntermediateSpec.toothDepth,
      70
    ),
    radius: secondsIntermediateSpec.radius,
    toothDepth: secondsIntermediateSpec.toothDepth,
    angle: state.secondsIntermediateAngle,
  };
  const stopGate = {
    ...stopGatePos,
    radius: stopGateSpec.radius,
    toothDepth: stopGateSpec.toothDepth,
    angle: state.stopToGoGateAngle,
  };
  const escape = { ...escapePos, radius: escapeSpec.radius, toothDepth: escapeSpec.toothDepth, angle: state.escapeAngle };
  const escapeDrive = { ...escapePos, radius: escapeDriveSpec.radius, toothDepth: escapeDriveSpec.toothDepth, angle: state.escapeAngle };
  const balance = { x: -r * 0.08, y: r * 0.56, radius: r * 0.185 };
  const screwRadius = Math.max(r * 0.028, 3);
  const screwMetal = mixHexColor(bridgeColor, metalColor, 0.42);
  const plateStroke = withAlpha(highlightColor, 0.18);
  const mainPlatePath =
    `M ${-r * 0.72} ${-r * 0.18} ` +
    `C ${-r * 0.62} ${-r * 0.5} ${-r * 0.1} ${-r * 0.56} ${r * 0.18} ${-r * 0.28} ` +
    `C ${r * 0.36} ${-r * 0.1} ${r * 0.36} ${r * 0.06} ${r * 0.16} ${r * 0.14} ` +
    `C ${-r * 0.12} ${r * 0.24} ${-r * 0.58} ${r * 0.18} ${-r * 0.72} ${-r * 0.18} Z`;
  const lowerPlatePath =
    `M ${-r * 0.22} ${r * 0.18} ` +
    `C ${r * 0.08} ${r * 0.08} ${r * 0.5} ${r * 0.16} ${r * 0.56} ${r * 0.44} ` +
    `C ${r * 0.44} ${r * 0.72} ${r * 0.06} ${r * 0.78} ${-r * 0.2} ${r * 0.58} ` +
    `C ${-r * 0.32} ${r * 0.46} ${-r * 0.32} ${r * 0.28} ${-r * 0.22} ${r * 0.18} Z`;
  const keylessPlatePath =
    `M ${r * 0.02} ${-r * 0.56} ` +
    `C ${r * 0.26} ${-r * 0.66} ${r * 0.58} ${-r * 0.62} ${r * 0.68} ${-r * 0.42} ` +
    `C ${r * 0.6} ${-r * 0.18} ${r * 0.38} ${-r * 0.08} ${r * 0.14} ${-r * 0.16} ` +
    `C ${r * 0.04} ${-r * 0.28} ${-r * 0.02} ${-r * 0.46} ${r * 0.02} ${-r * 0.56} Z`;
  const screws = [
    { x: -r * 0.54, y: -r * 0.46, angle: 14 },
    { x: -r * 0.58, y: r * 0.12, angle: -22 },
    { x: -r * 0.1, y: -r * 0.42, angle: 36 },
    { x: r * 0.16, y: -r * 0.46, angle: -8 },
    { x: r * 0.44, y: -r * 0.26, angle: 42 },
    { x: r * 0.38, y: r * 0.04, angle: -18 },
    { x: r * 0.08, y: r * 0.68, angle: 20 },
    { x: -r * 0.34, y: r * 0.56, angle: -34 },
  ];
  const extraJewels = [
    { x: -r * 0.1, y: -r * 0.24, radius: r * 0.026 },
    { x: r * 0.06, y: r * 0.26, radius: r * 0.024 },
    { x: r * 0.4, y: r * 0.36, radius: r * 0.022 },
    { x: r * 0.5, y: -r * 0.22, radius: r * 0.022 },
  ];
  const pivots = [
    barrel,
    crown,
    winding,
    center,
    reduction,
    third,
    fourth,
    secondsIntermediate,
    escapeDrive,
    balance,
  ];

  return (
    <g opacity={opacity}>
      <circle cx={0} cy={0} r={r * 0.86} fill={withAlpha(plateColor, 0.16)} />
      <circle cx={0} cy={0} r={r * 0.66} fill={withAlpha(plateColor, 0.1)} />
      <path d={mainPlatePath} fill={withAlpha(plateColor, 0.22)} stroke={plateStroke} strokeWidth={Math.max(r * 0.01, 1)} />
      <path d={lowerPlatePath} fill={withAlpha(plateColor, 0.18)} stroke={plateStroke} strokeWidth={Math.max(r * 0.01, 1)} />
      <path d={keylessPlatePath} fill={withAlpha(plateColor, 0.2)} stroke={plateStroke} strokeWidth={Math.max(r * 0.01, 1)} />

      <circle cx={-r * 0.56} cy={r * 0.42} r={r * 0.1} fill={withAlpha('#000000', 0.06)} stroke={withAlpha(highlightColor, 0.12)} strokeWidth={1} />
      <circle cx={r * 0.36} cy={r * 0.54} r={r * 0.08} fill={withAlpha('#000000', 0.05)} stroke={withAlpha(highlightColor, 0.1)} strokeWidth={1} />
      <circle cx={r * 0.54} cy={-r * 0.38} r={r * 0.07} fill={withAlpha('#000000', 0.05)} stroke={withAlpha(highlightColor, 0.1)} strokeWidth={1} />

      <MovementBridge
        d={`M ${ratchet.x} ${ratchet.y} Q ${-r * 0.32} ${-r * 0.22} ${barrel.x} ${barrel.y} Q ${-r * 0.18} ${-r * 0.08} ${center.x} ${center.y} Q ${r * 0.1} ${r * 0.02} ${third.x} ${third.y}`}
        width={Math.max(r * 0.18, 18)}
        fill={withAlpha(bridgeColor, 0.88)}
        shadow={withAlpha('#000000', 0.18)}
      />
      <MovementBridge
        d={`M ${crown.x} ${crown.y} Q ${r * 0.38} ${-r * 0.28} ${winding.x} ${winding.y} Q ${r * 0.42} ${-r * 0.02} ${third.x} ${third.y} Q ${r * 0.48} ${r * 0.04} ${fourth.x} ${fourth.y}`}
        width={Math.max(r * 0.125, 13)}
        fill={withAlpha(mixHexColor(bridgeColor, metalColor, 0.1), 0.84)}
        shadow={withAlpha('#000000', 0.18)}
      />
      <MovementBridge
        d={`M ${reduction.x} ${reduction.y} Q ${-r * 0.08} ${r * 0.22} ${center.x} ${center.y} Q ${r * 0.08} ${r * 0.16} ${secondsIntermediate.x} ${secondsIntermediate.y} Q ${r * 0.26} ${r * 0.44} ${escape.x} ${escape.y} Q ${r * 0.02} ${r * 0.7} ${balance.x} ${balance.y}`}
        width={Math.max(r * 0.115, 12)}
        fill={withAlpha(mixHexColor(bridgeColor, metalColor, 0.12), 0.82)}
        shadow={withAlpha('#000000', 0.16)}
      />
      {state.stopToGoEnabled && (
        <MovementBridge
          d={`M ${fourth.x} ${fourth.y} Q ${stopGate.x - r * 0.02} ${stopGate.y - r * 0.02} ${stopGate.x} ${stopGate.y} Q ${escape.x + r * 0.04} ${escape.y - r * 0.08} ${escape.x} ${escape.y}`}
          width={Math.max(r * 0.064, 7)}
          fill={withAlpha(mixHexColor(bridgeColor, metalColor, 0.18), 0.74)}
          shadow={withAlpha('#000000', 0.14)}
        />
      )}
      <MovementBridge
        d={`M ${hourWheel.x - r * 0.12} ${hourWheel.y - r * 0.02} Q ${hourWheel.x} ${hourWheel.y - r * 0.16} ${hourWheel.x + r * 0.12} ${hourWheel.y - r * 0.02}`}
        width={Math.max(r * 0.082, 9)}
        fill={withAlpha(mixHexColor(bridgeColor, metalColor, 0.18), 0.8)}
        shadow={withAlpha('#000000', 0.14)}
      />

      <GearWheel
        cx={ratchet.x}
        cy={ratchet.y}
        radius={ratchet.radius}
        teeth={MECHANICAL_GEAR_TEETH.ratchet}
        toothDepth={ratchet.toothDepth}
        spokeCount={4}
        angleDeg={ratchet.angle}
        metalColor={mixHexColor(metalColor, '#f6efdf', 0.08)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        toothProfile="ratchet"
        accentColor={mixHexColor(jewelColor, '#ffe6af', 0.18)}
        accentStride={6}
      />
      <GearWheel
        cx={crown.x}
        cy={crown.y}
        radius={crown.radius}
        teeth={MECHANICAL_GEAR_TEETH.crown}
        toothDepth={crown.toothDepth}
        spokeCount={4}
        angleDeg={crown.angle}
        metalColor={mixHexColor(metalColor, bridgeColor, 0.16)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        accentColor={mixHexColor(jewelColor, '#ffffff', 0.18)}
        accentStride={5}
        toothProfile="crown"
      />
      <BarrelWheel
        cx={barrel.x}
        cy={barrel.y}
        radius={barrel.radius}
        teeth={MECHANICAL_GEAR_TEETH.barrel}
        toothDepth={barrel.toothDepth}
        angleDeg={barrel.angle}
        metalColor={metalColor}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
      />
      <GearWheel
        cx={center.x}
        cy={center.y}
        radius={center.radius}
        teeth={MECHANICAL_GEAR_TEETH.centerWheel}
        toothDepth={center.toothDepth}
        spokeCount={6}
        angleDeg={center.angle}
        metalColor={mixHexColor(metalColor, '#f5efe2', 0.06)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(r * 0.03, 4)}
        toothProfile="train"
      />
      <GearWheel
        cx={center.x}
        cy={center.y}
        radius={centerPinionSpec.radius}
        teeth={MECHANICAL_GEAR_TEETH.centerPinion}
        toothDepth={centerPinionSpec.toothDepth}
        spokeCount={0}
        angleDeg={center.angle}
        metalColor={mixHexColor(metalColor, bridgeColor, 0.22)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(r * 0.016, 2.2)}
        toothProfile="pinion"
      />
      <GearWheel
        cx={hourWheel.x}
        cy={hourWheel.y}
        radius={hourWheel.radius}
        teeth={MECHANICAL_GEAR_TEETH.hourWheel}
        toothDepth={hourWheel.toothDepth}
        spokeCount={4}
        angleDeg={hourWheel.angle}
        metalColor={mixHexColor(bridgeColor, metalColor, 0.36)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(r * 0.022, 2.8)}
        toothProfile="train"
      />
      <GearWheel
        cx={reduction.x}
        cy={reduction.y}
        radius={reduction.radius}
        teeth={MECHANICAL_GEAR_TEETH.reduction}
        toothDepth={reduction.toothDepth}
        spokeCount={3}
        angleDeg={reduction.angle}
        metalColor={mixHexColor(bridgeColor, metalColor, 0.26)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        toothProfile="pinion"
      />
      <GearWheel
        cx={winding.x}
        cy={winding.y}
        radius={winding.radius}
        teeth={MECHANICAL_GEAR_TEETH.winding}
        toothDepth={winding.toothDepth}
        spokeCount={4}
        angleDeg={winding.angle}
        metalColor={mixHexColor(metalColor, bridgeColor, 0.22)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        toothProfile="crown"
      />
      <GearWheel
        cx={third.x}
        cy={third.y}
        radius={third.radius}
        teeth={MECHANICAL_GEAR_TEETH.thirdWheel}
        toothDepth={third.toothDepth}
        spokeCount={4}
        angleDeg={third.angle}
        metalColor={mixHexColor(metalColor, bridgeColor, 0.12)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        accentColor={mixHexColor(jewelColor, metalColor, 0.35)}
        accentStride={7}
        toothProfile="train"
      />
      <GearWheel
        cx={third.x}
        cy={third.y}
        radius={thirdPinionSpec.radius}
        teeth={MECHANICAL_GEAR_TEETH.thirdPinion}
        toothDepth={thirdPinionSpec.toothDepth}
        spokeCount={0}
        angleDeg={third.angle}
        metalColor={mixHexColor(metalColor, bridgeColor, 0.28)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(r * 0.015, 2)}
        toothProfile="pinion"
      />
      <GearWheel
        cx={fourth.x}
        cy={fourth.y}
        radius={fourth.radius}
        teeth={MECHANICAL_GEAR_TEETH.fourthWheel}
        toothDepth={fourth.toothDepth}
        spokeCount={4}
        angleDeg={fourth.angle}
        metalColor={mixHexColor(metalColor, '#ffffff', 0.08)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        accentColor={mixHexColor(jewelColor, '#ffd29a', 0.25)}
        accentStride={4}
        toothProfile="train"
      />
      <GearWheel
        cx={fourth.x}
        cy={fourth.y}
        radius={fourthPinionSpec.radius}
        teeth={MECHANICAL_GEAR_TEETH.fourthPinion}
        toothDepth={fourthPinionSpec.toothDepth}
        spokeCount={0}
        angleDeg={fourth.angle}
        metalColor={mixHexColor(metalColor, '#f1e4c8', 0.18)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(r * 0.013, 1.8)}
        toothProfile="pinion"
      />
      <GearWheel
        cx={secondsIntermediate.x}
        cy={secondsIntermediate.y}
        radius={secondsIntermediate.radius}
        teeth={MECHANICAL_GEAR_TEETH.secondsIntermediate}
        toothDepth={secondsIntermediate.toothDepth}
        spokeCount={3}
        angleDeg={secondsIntermediate.angle}
        metalColor={mixHexColor(metalColor, bridgeColor, 0.08)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        accentColor={mixHexColor(jewelColor, metalColor, 0.28)}
        accentStride={4}
        toothProfile="pinion"
      />
      {state.stopToGoEnabled && (
        <StopToGoGateWheel
          cx={stopGate.x}
          cy={stopGate.y}
          radius={stopGate.radius}
          teeth={18}
          toothDepth={stopGate.toothDepth}
          angleDeg={stopGate.angle}
          gapFraction={state.stopToGoGapFraction}
          paused={state.stopToGoPauseActive}
          metalColor={mixHexColor(metalColor, '#efe2c0', 0.12)}
          plateColor={withAlpha(plateColor, 0.98)}
          shadowColor={shadowColor}
          highlightColor={highlightColor}
          jewelColor={jewelColor}
        />
      )}
      <GearWheel
        cx={escapeDrive.x}
        cy={escapeDrive.y}
        radius={escapeDrive.radius}
        teeth={MECHANICAL_GEAR_TEETH.escapeDrive}
        toothDepth={escapeDrive.toothDepth}
        spokeCount={0}
        angleDeg={escapeDrive.angle}
        metalColor={mixHexColor(metalColor, '#ead7b7', 0.18)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        hubRadius={Math.max(r * 0.013, 1.8)}
        toothProfile="pinion"
      />
      <GearWheel
        cx={escape.x}
        cy={escape.y}
        radius={escape.radius}
        teeth={MECHANICAL_GEAR_TEETH.escape}
        toothDepth={escape.toothDepth}
        spokeCount={5}
        angleDeg={escape.angle}
        metalColor={mixHexColor(metalColor, jewelColor, 0.08)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
        accentColor={mixHexColor(jewelColor, '#ffe3a8', 0.22)}
        accentStride={3}
        toothProfile="escape"
      />
      <g transform={`translate(${r * 0.48} ${-r * 0.28}) rotate(${state.windingLeverAngle})`}>
        <path
          d={`M ${-r * 0.06} ${-r * 0.16} Q ${r * 0.02} ${-r * 0.2} ${r * 0.12} ${-r * 0.1} Q ${r * 0.08} ${0} ${-r * 0.02} ${r * 0.04}`}
          fill="none"
          stroke={withAlpha(mixHexColor(bridgeColor, metalColor, 0.18), 0.9)}
          strokeWidth={Math.max(r * 0.026, 2.4)}
          strokeLinecap="round"
        />
        <line
          x1={-r * 0.16}
          y1={-r * 0.02}
          x2={r * 0.2}
          y2={-r * 0.02}
          stroke={withAlpha(metalColor, 0.72)}
          strokeWidth={Math.max(r * 0.016, 1.4)}
          strokeLinecap="round"
        />
        <circle cx={-r * 0.16} cy={-r * 0.02} r={Math.max(r * 0.018, 2)} fill={jewelColor} />
      </g>
      {state.stopToGoEnabled && (
        <g transform={`translate(${stopGate.x + r * 0.075} ${stopGate.y - r * 0.02})`}>
          <path
            d={`M ${-r * 0.012} ${-r * 0.05} Q ${r * 0.01} ${-r * 0.02} ${-r * 0.004} ${r * 0.06}`}
            fill="none"
            stroke={withAlpha(state.stopToGoPauseActive ? jewelColor : mixHexColor(bridgeColor, metalColor, 0.22), 0.94)}
            strokeWidth={Math.max(r * 0.014, 1.4)}
            strokeLinecap="round"
          />
          <circle
            cx={-r * 0.012}
            cy={-r * 0.05}
            r={Math.max(r * 0.012, 1.6)}
            fill={state.stopToGoPauseActive ? mixHexColor(jewelColor, '#ffd89d', 0.2) : jewelColor}
          />
        </g>
      )}
      <g transform={`translate(${ratchet.x + r * 0.12} ${ratchet.y + r * 0.03}) rotate(${state.clickAngle})`}>
        <path
          d={`M ${-r * 0.05} ${r * 0.02} Q ${r * 0.01} ${-r * 0.08} ${r * 0.08} ${-r * 0.02}`}
          fill="none"
          stroke={withAlpha(mixHexColor(bridgeColor, metalColor, 0.28), 0.92)}
          strokeWidth={Math.max(r * 0.02, 2)}
          strokeLinecap="round"
        />
        <circle cx={-r * 0.05} cy={r * 0.02} r={Math.max(r * 0.014, 1.8)} fill={jewelColor} />
      </g>
      <ForkAssembly
        cx={escape.x - r * 0.04}
        cy={escape.y - r * 0.04}
        angleDeg={state.forkAngle}
        size={r * 0.05}
        color={mixHexColor(bridgeColor, metalColor, 0.18)}
        jewelColor={jewelColor}
      />
      <BalanceAssembly
        cx={balance.x}
        cy={balance.y}
        radius={balance.radius}
        swingDeg={state.balanceSwing}
        metalColor={mixHexColor(metalColor, '#f4eee3', 0.1)}
        shadowColor={shadowColor}
        highlightColor={highlightColor}
        jewelColor={jewelColor}
      />

      {extraJewels.map((bearing, index) => (
        <g key={`bearing-${index}`} transform={`translate(${bearing.x} ${bearing.y})`}>
          <circle cx={0} cy={0} r={bearing.radius} fill={withAlpha(bridgeColor, 0.86)} />
          <circle cx={0} cy={0} r={bearing.radius * 0.68} fill={withAlpha(metalColor, 0.9)} />
          <circle cx={0} cy={0} r={bearing.radius * 0.3} fill={jewelColor} />
        </g>
      ))}

      {screws.map((screw, index) => (
        <MovementScrew
          key={`movement-screw-${index}`}
          cx={screw.x}
          cy={screw.y}
          radius={screwRadius}
          metalColor={screwMetal}
          shadowColor={shadowColor}
          angleDeg={screw.angle}
        />
      ))}

      {pivots.map((pivot, index) => (
        <g key={`pivot-cap-${index}`} transform={`translate(${pivot.x} ${pivot.y})`}>
          <circle cx={0} cy={0} r={Math.max(pivot.radius * 0.16, 2)} fill={withAlpha(bridgeColor, 0.88)} />
          <circle cx={0} cy={0} r={Math.max(pivot.radius * 0.07, 1.2)} fill={jewelColor} />
        </g>
      ))}
    </g>
  );
}

function buildSparklinePaths(values: number[], width: number, height: number): { line: string; area: string } | null {
  if (values.length === 0 || width <= 0 || height <= 0) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : -width / 2 + (width * index) / (values.length - 1);
    const y = span === 0 ? 0 : height / 2 - ((value - min) / span) * height;
    return { x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area =
    `${line} ` +
    `L ${width / 2} ${height / 2} ` +
    `L ${-width / 2} ${height / 2} Z`;
  return { line, area };
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

function polarPoint(radius: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

function buildSampleDegrees(startDeg: number, endDeg: number, maxStepDeg = 3): number[] {
  const sweep = endDeg - startDeg;
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / maxStepDeg));
  return Array.from({ length: steps + 1 }, (_, i) => startDeg + (sweep * i) / steps);
}

function variableBandPath(
  startDeg: number,
  endDeg: number,
  innerRadiusAtDeg: (deg: number) => number,
  outerRadiusAtDeg: (deg: number) => number
): string {
  if (Math.abs(endDeg - startDeg) < 0.01) {
    return '';
  }
  const degrees = buildSampleDegrees(startDeg, endDeg);
  const outerPts = degrees.map((deg) => polarPoint(Math.max(0, outerRadiusAtDeg(deg)), deg));
  const innerPts = degrees
    .slice()
    .reverse()
    .map((deg) => polarPoint(Math.max(0, innerRadiusAtDeg(deg)), deg));
  const pts = outerPts.concat(innerPts);
  return pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';
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

/** Simple SVG arc stroke path (no closing line), used by gauge rims. */
function arcLinePath(radius: number, startDeg: number, endDeg: number): string {
  if (radius <= 0 || Math.abs(endDeg - startDeg) < 0.01) {
    return '';
  }
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg >= startDeg ? 1 : 0;
  const sa = rad(startDeg);
  const ea = rad(endDeg);
  return (
    `M ${radius * Math.cos(sa)} ${radius * Math.sin(sa)} ` +
    `A ${radius} ${radius} 0 ${large} ${sweep} ${radius * Math.cos(ea)} ${radius * Math.sin(ea)}`
  );
}

function variableLinePath(
  startDeg: number,
  endDeg: number,
  radiusAtDeg: (deg: number) => number
): string {
  if (Math.abs(endDeg - startDeg) < 0.01) {
    return '';
  }
  const degrees = buildSampleDegrees(startDeg, endDeg);
  const points = degrees.map((deg) => polarPoint(Math.max(0, radiusAtDeg(deg)), deg));
  return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
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

function DialGlassOverlay({
  shape,
  halfW,
  halfH,
  cornerRadius,
}: {
  shape: DialShape;
  halfW: number;
  halfH: number;
  cornerRadius: number;
}) {
  const { hw, hh } = shapeExtents(shape, halfW, halfH);
  const isHex = shape === 'hex-flat' || shape === 'hex-point';
  const isRect = shape === 'square' || shape === 'rect-h' || shape === 'rect-v';
  const streakHalfW = hw * (isHex ? 0.76 : isRect ? 0.72 : 0.82);
  const streakHalfH = hh * (shape === 'oval-v' ? 0.66 : shape === 'round' ? 0.54 : 0.48);
  const glintHalfW = hw * (isHex ? 0.42 : isRect ? 0.46 : 0.5);
  const glintHalfH = hh * (shape === 'oval-h' ? 0.18 : shape === 'oval-v' ? 0.24 : 0.22);
  const innerStroke = Math.max(Math.min(hw, hh) * 0.014, 1);

  return (
    <>
      <DialBackground
        shape={shape}
        halfW={halfW}
        halfH={halfH}
        cornerRadius={cornerRadius}
        fill="url(#alpine-mechanical-glass-wash)"
        stroke="none"
        strokeWidth={0}
      />
      <g transform={`translate(${-hw * 0.16} ${-hh * 0.24}) rotate(-18)`} opacity={0.94}>
        <DialBackground
          shape={shape}
          halfW={streakHalfW}
          halfH={streakHalfH}
          cornerRadius={Math.max(cornerRadius * 0.72, 2)}
          fill="url(#alpine-mechanical-glass-streak)"
          stroke="none"
          strokeWidth={0}
        />
      </g>
      <g transform={`translate(${hw * 0.26} ${hh * 0.18}) rotate(18)`} opacity={0.72}>
        <DialBackground
          shape={shape}
          halfW={glintHalfW}
          halfH={glintHalfH}
          cornerRadius={Math.max(cornerRadius * 0.48, 1)}
          fill="url(#alpine-mechanical-glass-glint)"
          stroke="none"
          strokeWidth={0}
        />
      </g>
      <DialBackground
        shape={shape}
        halfW={halfW * 0.985}
        halfH={halfH * 0.985}
        cornerRadius={cornerRadius}
        fill="none"
        stroke={withAlpha('#ffffff', 0.08)}
        strokeWidth={innerStroke}
      />
    </>
  );
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

function useAnimationClock(callback: () => void, intervalMs = 33) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);
  useEffect(() => {
    let raf = 0;
    let interval = 0;
    const loop = () => {
      cbRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    interval = window.setInterval(() => cbRef.current(), intervalMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, [intervalMs]);
}

export const AlpineClockPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const [frameNowMs, setFrameNowMs] = useState(() => Date.now());
  useAnimationClock(() => setFrameNowMs(Date.now()));
  const queryClockAnchorRef = useRef<{ queryMs: number; wallMs: number } | null>(null);

  // Per-hand tick tracking. Each ref stores the last observed discrete value
  // (hour 0-11, minute 0-59, second 0-59) and the wall-clock timestamp of the
  // jump, so we can evaluate the damped oscillation formula each frame.
  const hourBounceRef = useRef<{ lastTick: number; jumpAt: number }>({ lastTick: -1, jumpAt: 0 });
  const minuteBounceRef = useRef<{ lastTick: number; jumpAt: number }>({ lastTick: -1, jumpAt: 0 });
  const secondBounceRef = useRef<{ lastTick: number; jumpAt: number }>({ lastTick: -1, jumpAt: 0 });

  // Resolve current time (either from data frame or real-time).
  const wallNowMs = frameNowMs;
  let now = new Date(wallNowMs);
  if (options.useQueryTime && data?.series?.length) {
    const frame = data.series[0];
    const timeField = frame.fields.find((f) => f.type === 'time');
    if (timeField && timeField.values.length > 0) {
      const last = timeField.values[timeField.values.length - 1];
      const queryMs =
        typeof last === 'number'
          ? last
          : last instanceof Date
            ? last.getTime()
            : Number(last);
      if (Number.isFinite(queryMs)) {
        const anchor = queryClockAnchorRef.current;
        if (!anchor || anchor.queryMs !== queryMs) {
          queryClockAnchorRef.current = { queryMs, wallMs: wallNowMs };
        }
        const activeAnchor = queryClockAnchorRef.current!;
        now = new Date(activeAnchor.queryMs + (wallNowMs - activeAnchor.wallMs));
      }
    }
  } else {
    queryClockAnchorRef.current = null;
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
  const outerFitted = shapeExtents(options.dialShape, outerHalfW, outerHalfH);
  // `r` is the radius of the inscribed circle used for hand lengths and any
  // scaling that should stay uniform in every direction (hands, subdials).
  // Ticks and numbers compute their own per-angle edge via `dialEdgeRadius`
  // so they follow non-circular silhouettes.
  const r = Math.min(fitted.hw, fitted.hh) * 0.95;
  const edgeAt = (angle: number) =>
    dialEdgeRadius(options.dialShape, fitted.hw, fitted.hh, angle) * 0.95;
  const outerEdgeAt = (angle: number) =>
    dialEdgeRadius(options.dialShape, outerFitted.hw, outerFitted.hh, angle) * 0.98;

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
    const hourNumberStyle = options.hourNumberStyle ?? 'arabic';
    const circled =
      hourNumberStyle === 'circled-arabic' || hourNumberStyle === 'circled-roman';
    const fontSize = (r * options.hourNumberFontSize) / 100;
    const circleFill = mixHexColor(options.dialBackground, options.hourNumberColor, 0.08);
    const circleStroke = mixHexColor(options.hourNumberColor, options.dialBackground, 0.12);
    for (let i = 1; i <= 12; i++) {
      const a = (i * 30 - 90) * (Math.PI / 180);
      const radius = (edgeAt(a) * options.hourNumberRadius) / 100;
      const label = formatHourNumber(i, hourNumberStyle);
      const x = radius * Math.cos(a);
      const y = radius * Math.sin(a);
      const circleRadius = Math.max(fontSize * 0.88, label.length * fontSize * 0.38);
      numbers.push(
        circled ? (
          <g key={`hn${i}`}>
            <circle
              cx={x}
              cy={y}
              r={circleRadius}
              fill={circleFill}
              stroke={circleStroke}
              strokeWidth={Math.max(fontSize * 0.09, 1)}
            />
            <text
              x={x}
              y={y}
              fontSize={fontSize}
              fill={options.hourNumberColor}
              fontFamily={options.hourNumberFontFamily}
              textAnchor="middle"
              dominantBaseline="central"
              {...fitText(label, fontSize, circleRadius * 1.55)}
            >
              {label}
            </text>
          </g>
        ) : (
          <text
            key={`hn${i}`}
            x={x}
            y={y}
            fontSize={fontSize}
            fill={options.hourNumberColor}
            fontFamily={options.hourNumberFontFamily}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {label}
          </text>
        )
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
    const gmMin = options.gmMin ?? 0;
    const gmMax = options.gmMax ?? 100;
    const gmDecimals = options.gmDecimals ?? 1;
    const gmUnit = options.gmUnit ?? '';
    const valueScale = options.gmScale || 1;
    const valueOffset = options.gmOffset || 0;
    const raw = readMetric(data, options.gmFieldName, options.gmReducer, options.gmQueryRefId);
    const history = readMetricSeries(data, options.gmFieldName, options.gmQueryRefId)
      .map((sample) => sample * valueScale + valueOffset)
      .filter((sample) => Number.isFinite(sample));
    const value =
      raw === null ? null : raw * valueScale + valueOffset;
    const span = gmMax - gmMin;
    const clamped =
      value === null ? null : Math.max(gmMin, Math.min(gmMax, value));
    const pct =
      clamped === null || span === 0 ? 0 : (clamped - gmMin) / span;
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

    const formattedValue = value === null ? '--' : value.toFixed(gmDecimals);
    const formatted =
      value === null ? '--' : `${formattedValue}${gmUnit ? gmUnit : ''}`;

    const gaugePlacement = options.gmGaugePlacement ?? 'none';
    const gaugeStyle = options.gmGaugeStyle ?? 'flat';
    const gaugeBaseRadius =
      gaugePlacement === 'bezel' ? Math.min(outerHalfW, outerHalfH) * 0.98 : r;
    const gaugeInnerRadiusPct = options.gmGaugeInnerRadius ?? 58;
    const gaugeOuterRadiusPct = options.gmGaugeOuterRadius ?? 74;
    const gaugeLabelRadiusPct = options.gmGaugeLabelRadius ?? 84;
    const gaugeShapeAware = options.dialShape !== 'round';
    const gaugePlacementRadiusAtDeg = (deg: number) => {
      const angle = ((deg - 90) * Math.PI) / 180;
      return gaugePlacement === 'bezel' ? outerEdgeAt(angle) : edgeAt(angle);
    };
    const gaugeLabels = parseGaugeLabelValues(
      options.gmGaugeLabelValues ?? '10,30,60,90',
      gmMin,
      gmMax
    ).map((labelValue) => ({
      value: labelValue,
      angleDeg:
        span === 0
          ? options.gmGaugeStartAngle ?? 225
          : (options.gmGaugeStartAngle ?? 225) +
            ((labelValue - gmMin) / span) * (options.gmGaugeSweepAngle ?? 180),
    }));
    const gauge =
      gaugePlacement === 'none'
        ? null
        : {
            placement: gaugePlacement,
            style: gaugeStyle,
            shapeAware: gaugeShapeAware,
            placementRadiusAtDeg: gaugePlacementRadiusAtDeg,
            innerRadiusPct: gaugeInnerRadiusPct,
            outerRadiusPct: gaugeOuterRadiusPct,
            labelRadiusPct: gaugeLabelRadiusPct,
            opacity: Math.max(0, Math.min(100, options.gmGaugeOpacity ?? 30)),
            startAngle: options.gmGaugeStartAngle ?? 225,
            sweepAngle: options.gmGaugeSweepAngle ?? 180,
            innerRadius: (gaugeBaseRadius * gaugeInnerRadiusPct) / 100,
            outerRadius: (gaugeBaseRadius * gaugeOuterRadiusPct) / 100,
            labelRadius: (gaugeBaseRadius * gaugeLabelRadiusPct) / 100,
            segmentCount: Math.max(3, Math.round(options.gmGaugeSegmentCount ?? 30)),
            segmentGap: Math.max(0, Math.min(90, options.gmGaugeSegmentGap ?? 32)),
            activeColor1: options.gmGaugeActiveColor1 ?? '#f3c54b',
            activeColor2: options.gmGaugeActiveColor2 ?? '#ff6b5f',
            inactiveColor: options.gmGaugeInactiveColor ?? '#3a3f47',
            rimEnabled: options.gmGaugeRimEnabled ?? true,
            rimColor1: options.gmGaugeRimColor1 ?? '#9cd8d8',
            rimColor2: options.gmGaugeRimColor2 ?? '#ff8a3d',
            rimWidth: options.gmGaugeRimWidth ?? 2,
            labels: gaugeLabels,
            labelColor: options.gmGaugeLabelColor ?? '#d0d5db',
            labelFontFamily: options.gmGaugeLabelFontFamily ?? 'Arial, sans-serif',
            labelFontSize: (gaugeBaseRadius * (options.gmGaugeLabelFontSize ?? 6)) / 100,
            showValue: options.gmGaugeShowValue ?? true,
            valueColor: options.gmGaugeValueColor ?? '#ffffff',
            valueFontFamily: options.gmGaugeValueFontFamily ?? 'Arial, sans-serif',
            valueFontSize: options.gmGaugeValueFontSize ?? 36,
            valueYOffset: (gaugeBaseRadius * (options.gmGaugeValueYOffset ?? 12)) / 100,
            unitColor: options.gmGaugeUnitColor ?? '#d0d5db',
            unitFontSize: options.gmGaugeUnitFontSize ?? 16,
            showSparkline: options.gmGaugeShowSparkline ?? false,
            sparklineColor: options.gmGaugeSparklineColor ?? '#ff6b5f',
            sparklineFillColor: options.gmGaugeSparklineFillColor ?? '#ff6b5f',
            sparklineOpacity: Math.max(0, Math.min(100, options.gmGaugeSparklineOpacity ?? 35)),
            sparklineWidth: (gaugeBaseRadius * (options.gmGaugeSparklineWidth ?? 82)) / 100,
            sparklineHeight: (gaugeBaseRadius * (options.gmGaugeSparklineHeight ?? 20)) / 100,
            sparklineYOffset: (gaugeBaseRadius * (options.gmGaugeSparklineYOffset ?? 42)) / 100,
            sparklineStrokeWidth: options.gmGaugeSparklineStrokeWidth ?? 2,
            sparklineValues: history.slice(-48),
            mechanicalWindowBg: mixHexColor(options.gmGaugeInactiveColor ?? '#3a3f47', '#000000', 0.22),
            mechanicalWindowBorder: mixHexColor(options.gmGaugeInactiveColor ?? '#3a3f47', '#ffffff', 0.18),
            mechanicalDimColor: mixHexColor(options.gmGaugeLabelColor ?? '#d0d5db', '#000000', 0.1),
            mechanicalBarHighlight: mixHexColor(options.gmGaugeSparklineColor ?? '#ff6b5f', '#ffffff', 0.35),
            prevValue:
              value === null
                ? '--'
                : Math.max(gmMin, value - Math.pow(10, -gmDecimals)).toFixed(gmDecimals),
            nextValue:
              value === null
                ? '--'
                : Math.min(gmMax, value + Math.pow(10, -gmDecimals)).toFixed(gmDecimals),
          };

    return {
      value,
      formattedValue,
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
      unit: gmUnit,
      gauge,
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

  const mechanicalMovementEnabled = options.mechanicalMovementMode === 'skeleton';
  const mechanicalMovementOpacity = Math.max(
    0,
    Math.min(1, (options.mechanicalMovementOpacity ?? 78) / 100)
  );
  const mechanicalMovementDialOpacity = Math.max(
    0,
    Math.min(1, (options.mechanicalMovementDialOpacity ?? 16) / 100)
  );
  const mechanicalMovementState = mechanicalMovementEnabled
      ? buildMechanicalMovementState({
        nowMs,
        hourDeg,
        minuteDeg,
        secondDeg,
        driveMode: options.mechanicalMovementDriveMode ?? 'run',
        crownTurnsPerMinute: options.mechanicalMovementCrownSpeed ?? 18,
        stopToGoEnabled: options.stopToGo,
        sweepMs: options.sweepMs || 58500,
        pauseMs: options.pauseMs || 1500,
      })
    : null;
  const dialFillRef = dialFillValue(options.dialFillMode, options.dialBackground, 'alpine-dial-gradient');

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
          {mechanicalMovementEnabled && (
            <>
              <clipPath id="alpine-mechanical-movement-clip">
                <DialBackground
                  shape={options.dialShape}
                  halfW={halfW}
                  halfH={halfH}
                  cornerRadius={options.dialCornerRadius}
                  fill="#ffffff"
                  stroke="none"
                  strokeWidth={0}
                />
              </clipPath>
              <linearGradient id="alpine-mechanical-glass-wash" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.12} />
                <stop offset="42%" stopColor="#ffffff" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="alpine-mechanical-glass-streak" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.18} />
                <stop offset="48%" stopColor="#ffffff" stopOpacity={0.06} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
              <radialGradient id="alpine-mechanical-glass-glint" cx="28%" cy="28%" r="78%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.24} />
                <stop offset="62%" stopColor="#ffffff" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </radialGradient>
            </>
          )}
          {globalMetric?.gauge && (
            <>
              <linearGradient id="alpine-gm-gauge-rim-gradient" x1="100%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={globalMetric.gauge.rimColor1} />
                <stop offset="100%" stopColor={globalMetric.gauge.rimColor2} />
              </linearGradient>
              <linearGradient id="alpine-gm-gauge-sparkline-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={globalMetric.gauge.sparklineFillColor}
                  stopOpacity={Math.max(0, Math.min(1, globalMetric.gauge.sparklineOpacity / 100))}
                />
                <stop offset="100%" stopColor={globalMetric.gauge.sparklineFillColor} stopOpacity={0} />
              </linearGradient>
            </>
          )}
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
          {mechanicalMovementEnabled && (
            <g clipPath="url(#alpine-mechanical-movement-clip)">
              <SkeletonMovement
                r={r}
                state={mechanicalMovementState!}
                metalColor={options.mechanicalMovementMetalColor ?? '#b9a27c'}
                bridgeColor={options.mechanicalMovementBridgeColor ?? '#635141'}
                jewelColor={options.mechanicalMovementJewelColor ?? '#cb5a6a'}
                opacity={mechanicalMovementOpacity}
              />
            </g>
          )}
          <DialBackground
            shape={options.dialShape}
            halfW={halfW}
            halfH={halfH}
            cornerRadius={options.dialCornerRadius}
            fill={mechanicalMovementEnabled ? 'none' : dialFillRef}
            stroke={options.dialBorderColor}
            strokeWidth={options.dialBorderWidth}
          />
          {mechanicalMovementEnabled && (
            <>
              <g clipPath="url(#alpine-mechanical-movement-clip)">
                <g opacity={mechanicalMovementDialOpacity}>
                  <DialBackground
                    shape={options.dialShape}
                    halfW={halfW}
                    halfH={halfH}
                    cornerRadius={options.dialCornerRadius}
                    fill={dialFillRef}
                    stroke="none"
                    strokeWidth={0}
                  />
                </g>
                <DialGlassOverlay
                  shape={options.dialShape}
                  halfW={halfW}
                  halfH={halfH}
                  cornerRadius={options.dialCornerRadius}
                />
              </g>
            </>
          )}
          {globalMetric?.gauge && (() => {
            const gm = globalMetric;
            const gauge = gm.gauge;
            if (!gauge) {
              return null;
            }
            const gaugeEnd = gauge.startAngle + gauge.sweepAngle;
            const activeEnd = gauge.startAngle + gm.pct * gauge.sweepAngle;
            const segmentSpan = gauge.sweepAngle / gauge.segmentCount;
            const gap = segmentSpan * (gauge.segmentGap / 100);
            const segments: React.ReactNode[] = [];
            const gaugeInnerPath = (deg: number) =>
              gauge.shapeAware
                ? (gauge.placementRadiusAtDeg(deg) * gauge.innerRadiusPct) / 100
                : gauge.innerRadius;
            const gaugeOuterPath = (deg: number) =>
              gauge.shapeAware
                ? (gauge.placementRadiusAtDeg(deg) * gauge.outerRadiusPct) / 100
                : gauge.outerRadius;

            for (let i = 0; i < gauge.segmentCount; i++) {
              const segStart = gauge.startAngle + i * segmentSpan + gap / 2;
              const segEnd = gauge.startAngle + (i + 1) * segmentSpan - gap / 2;
              if (segEnd <= segStart) {
                continue;
              }
              const activeStart = segStart;
              const activeStop = Math.min(segEnd, activeEnd);
              if (activeStop > activeStart) {
                const mixT = ((activeStart + activeStop) / 2 - gauge.startAngle) / gauge.sweepAngle;
                segments.push(
                  <path
                    key={`gm-gauge-active-${i}`}
                    d={
                      gauge.shapeAware
                        ? variableBandPath(activeStart, activeStop, gaugeInnerPath, gaugeOuterPath)
                        : arcSegmentPath(gauge.innerRadius, gauge.outerRadius, activeStart, activeStop)
                    }
                    fill={mixHexColor(gauge.activeColor1, gauge.activeColor2, mixT)}
                  />
                );
              }
              const inactiveStart = Math.max(segStart, activeEnd);
              if (segEnd > inactiveStart) {
                segments.push(
                  <path
                    key={`gm-gauge-inactive-${i}`}
                    d={
                      gauge.shapeAware
                        ? variableBandPath(inactiveStart, segEnd, gaugeInnerPath, gaugeOuterPath)
                        : arcSegmentPath(gauge.innerRadius, gauge.outerRadius, inactiveStart, segEnd)
                    }
                    fill={gauge.inactiveColor}
                  />
                );
              }
            }

            const sparkline = gauge.showSparkline
              ? buildSparklinePaths(
                  gauge.sparklineValues,
                  gauge.sparklineWidth,
                  gauge.sparklineHeight
                )
              : null;
            const unitGap = Math.max(gauge.valueFontSize * 0.18, 4);
            const showSplitUnit = gm.value !== null && gm.unit;
            const trackOpacity = Math.max(0, Math.min(1, gauge.opacity / 100));
            const infoOpacity =
              gauge.style === 'mechanical'
                ? 1
                : gauge.placement === 'dial'
                  ? Math.max(trackOpacity, 0.72)
                  : 1;
            const mechanicalValueWindowWidth = Math.max(
              gauge.valueFontSize * (gm.unit ? 2.9 : 2.2),
              gauge.sparklineWidth * 0.46
            );
            const mechanicalValueWindowHeight = Math.max(
              gauge.valueFontSize * 1.24,
              gauge.unitFontSize * 2.8
            );
            const mechanicalSparklineHeight = Math.max(gauge.sparklineHeight * 1.9, 22);

            return (
              <g>
                <g opacity={trackOpacity}>
                  {segments}
                  {gauge.rimEnabled && gaugeEnd - activeEnd > 0.5 && (
                    <path
                      d={
                        gauge.shapeAware
                          ? variableLinePath(activeEnd, gaugeEnd, gaugeOuterPath)
                          : arcLinePath(gauge.outerRadius, activeEnd, gaugeEnd)
                      }
                      fill="none"
                      stroke="url(#alpine-gm-gauge-rim-gradient)"
                      strokeWidth={gauge.rimWidth}
                      strokeLinecap="round"
                    />
                  )}
                </g>
                <g opacity={infoOpacity}>
                  {gauge.labels.map((label, index) => {
                    const a = ((label.angleDeg - 90) * Math.PI) / 180;
                    const labelRadius = gauge.shapeAware
                      ? (gauge.placementRadiusAtDeg(label.angleDeg) * gauge.labelRadiusPct) / 100
                      : gauge.labelRadius;
                    return (
                      <text
                        key={`gm-gauge-label-${index}`}
                        x={labelRadius * Math.cos(a)}
                        y={labelRadius * Math.sin(a)}
                        fontSize={gauge.labelFontSize}
                        fill={gauge.labelColor}
                        fontFamily={gauge.labelFontFamily}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {formatGaugeLabelValue(label.value)}
                      </text>
                    );
                  })}
                  {gauge.showValue && (
                    gauge.style === 'mechanical' ? (
                      <MechanicalCylinderWindow
                        cx={0}
                        cy={gauge.valueYOffset}
                        width={mechanicalValueWindowWidth}
                        height={mechanicalValueWindowHeight}
                        cornerRadius={Math.max(mechanicalValueWindowHeight * 0.18, 6)}
                        bg={gauge.mechanicalWindowBg}
                        borderColor={gauge.mechanicalWindowBorder}
                        borderWidth={1.2}
                        textColor={gauge.valueColor}
                        dimTextColor={gauge.mechanicalDimColor}
                        fontFamily={gauge.valueFontFamily}
                        valueFontSize={gauge.valueFontSize}
                        unitFontSize={gauge.unitFontSize}
                        prev={gauge.prevValue}
                        curr={gm.formattedValue}
                        next={gauge.nextValue}
                        unit={gm.unit}
                        filterId="alpine-inner-shadow"
                      />
                    ) : (
                      <g transform={`translate(0 ${gauge.valueYOffset})`}>
                        <text
                          x={showSplitUnit ? -unitGap / 2 : 0}
                          y={0}
                          fontSize={gauge.valueFontSize}
                          fill={gauge.valueColor}
                          fontFamily={gauge.valueFontFamily}
                          fontWeight="bold"
                          textAnchor={showSplitUnit ? 'end' : 'middle'}
                          dominantBaseline="central"
                        >
                          {gm.formattedValue}
                        </text>
                        {showSplitUnit && (
                          <text
                            x={unitGap / 2}
                            y={0}
                            fontSize={gauge.unitFontSize}
                            fill={gauge.unitColor}
                            fontFamily={gauge.valueFontFamily}
                            textAnchor="start"
                            dominantBaseline="central"
                          >
                            {gm.unit}
                          </text>
                        )}
                      </g>
                    )
                  )}
                  {sparkline && (
                    gauge.style === 'mechanical' ? (
                      <MechanicalBarsWindow
                        cx={0}
                        cy={gauge.sparklineYOffset}
                        width={gauge.sparklineWidth}
                        height={mechanicalSparklineHeight}
                        cornerRadius={Math.max(mechanicalSparklineHeight * 0.18, 5)}
                        bg={gauge.mechanicalWindowBg}
                        borderColor={gauge.mechanicalWindowBorder}
                        borderWidth={1.2}
                        values={gauge.sparklineValues}
                        barColor={gauge.sparklineColor}
                        barHighlight={gauge.mechanicalBarHighlight}
                        filterId="alpine-inner-shadow"
                      />
                    ) : (
                      <g transform={`translate(0 ${gauge.sparklineYOffset})`}>
                        <path d={sparkline.area} fill="url(#alpine-gm-gauge-sparkline-fill)" />
                        <path
                          d={sparkline.line}
                          fill="none"
                          stroke={gauge.sparklineColor}
                          strokeWidth={gauge.sparklineStrokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )
                  )}
                </g>
              </g>
            );
          })()}
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
