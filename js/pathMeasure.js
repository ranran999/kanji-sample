// Helper utilities for measuring/sampling the real SVG stroke path data
// (kanji.strokes[i].svgPath) so the "見本" (model) demo animation follows the
// true curved/angled shape of a stroke instead of a straight line between
// its start and end points.

let measurePathEl = null;

function getMeasureElement() {
  if (measurePathEl) return measurePathEl;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.style.pointerEvents = 'none';
  svg.setAttribute('aria-hidden', 'true');
  measurePathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.appendChild(measurePathEl);
  document.body.appendChild(svg);
  return measurePathEl;
}

const lengthCache = new Map();
const path2DCache = new Map();

function getTotalLength(d) {
  let len = lengthCache.get(d);
  if (len === undefined) {
    const el = getMeasureElement();
    el.setAttribute('d', d);
    len = el.getTotalLength();
    lengthCache.set(d, len);
  }
  return len;
}

/** Returns a cached Path2D for the given svg path data (0-100 coordinate space). */
export function getPath2D(d) {
  let p2d = path2DCache.get(d);
  if (!p2d) {
    p2d = new Path2D(d);
    path2DCache.set(d, p2d);
  }
  return p2d;
}

/**
 * Samples points along the real path between two progress ratios (0..1),
 * following curves/corners exactly as authored in svgPath.
 */
export function sampleSegment(d, fromProgress, toProgress, steps = 20) {
  const el = getMeasureElement();
  el.setAttribute('d', d);
  const len = getTotalLength(d);
  const from = Math.max(0, Math.min(1, fromProgress));
  const to = Math.max(0, Math.min(1, toProgress));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + (to - from) * (i / steps);
    const pt = el.getPointAtLength(len * t);
    points.push({ x: pt.x, y: pt.y });
  }
  return points;
}

/** Single point along the path at the given progress ratio (0..1). */
export function getPointAtProgress(d, progress) {
  const el = getMeasureElement();
  el.setAttribute('d', d);
  const len = getTotalLength(d);
  const pt = el.getPointAtLength(len * Math.max(0, Math.min(1, progress)));
  return { x: pt.x, y: pt.y };
}
