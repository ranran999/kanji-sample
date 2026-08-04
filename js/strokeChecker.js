import { sampleSegment } from './pathMeasure.js';

/**
 * Normalizes canvas pixel coordinates to 0-100 range
 */
export function normalizePoint(pt, canvasWidth, canvasHeight) {
  return {
    x: Math.max(0, Math.min(100, (pt.x / canvasWidth) * 100)),
    y: Math.max(0, Math.min(100, (pt.y / canvasHeight) * 100)),
  };
}

/**
 * Calculates Euclidean distance between two 0-100 normalized points
 */
export function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * How far a path's points bulge away from the straight chord connecting
 * its first and last point -- ~0 for a straight line, larger for a path
 * that visibly bends/hooks/curves partway through.
 */
export function maxChordDeviation(points) {
  if (!points || points.length < 2) return 0;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;

  let maxDev = 0;
  for (const p of points) {
    let dev;
    if (lenSq < 1e-6) {
      dev = distance(p, start);
    } else {
      const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq));
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      dev = Math.hypot(p.x - projX, p.y - projY);
    }
    if (dev > maxDev) maxDev = dev;
  }
  return maxDev;
}

// Below this much chord deviation (0-100 space), a stroke's real path is
// essentially straight, so there's no bend to require from the child.
const BEND_SIGNIFICANT_THRESHOLD = 10;
// How much of the real stroke's bend the child's line needs to show, once
// it's decided the real stroke does bend. Kept loose on purpose -- kids
// won't draw as crisp a hook as the reference path, they just shouldn't
// draw straight through it.
const MIN_USER_BEND_FRACTION = 0.2;

/**
 * Evaluates whether a user's drawn stroke (array of normalized points) matches
 * the expected KanjiStroke for the current step.
 */
export function evaluateStroke(userPoints, expectedStroke, tolerance = 24) {
  if (!userPoints || userPoints.length < 2) {
    return {
      isCorrect: false,
      strokeNumber: expectedStroke.strokeNumber,
      message: 'もう少し長くていねいに書いてみよう！',
    };
  }

  const userStart = userPoints[0];
  const userEnd = userPoints[userPoints.length - 1];

  const startDist = distance(userStart, expectedStroke.start);
  const endDist = distance(userEnd, expectedStroke.end);

  // Check start point accuracy
  if (startDist > tolerance) {
    return {
      isCorrect: false,
      strokeNumber: expectedStroke.strokeNumber,
      distanceError: startDist,
      message: '書き始めの位置をもう一度確認してみよう！',
    };
  }

  // Check end point accuracy
  if (endDist > tolerance) {
    return {
      isCorrect: false,
      strokeNumber: expectedStroke.strokeNumber,
      distanceError: endDist,
      message: '書き終わりの場所が少し違うかも？',
    };
  }

  // Check stroke direction
  const expectedDx = expectedStroke.end.x - expectedStroke.start.x;
  const expectedDy = expectedStroke.end.y - expectedStroke.start.y;
  const userDx = userEnd.x - userStart.x;
  const userDy = userEnd.y - userStart.y;

  // Dot strokes or very short strokes
  const expectedLen = Math.sqrt(expectedDx * expectedDx + expectedDy * expectedDy);
  if (expectedLen > 8) {
    const dotProduct =
      (expectedDx * userDx + expectedDy * userDy) /
      (expectedLen * Math.sqrt(userDx * userDx + userDy * userDy) || 1);

    if (dotProduct < 0.25) {
      return {
        isCorrect: false,
        strokeNumber: expectedStroke.strokeNumber,
        message: '筆を動かす向きを確認しよう！',
      };
    }
  }

  // Check that a stroke which is actually meant to bend (a hook, a corner,
  // a sweep) isn't satisfied by a straight scribble between its start and
  // end -- start/end/direction alone can't tell those apart, since a
  // straight line and an L-shaped hook can share the same endpoints and
  // overall direction.
  if (expectedStroke.svgPath) {
    const expectedPoints = sampleSegment(expectedStroke.svgPath, 0, 1, 20);
    const expectedBend = maxChordDeviation(expectedPoints);
    if (expectedBend > BEND_SIGNIFICANT_THRESHOLD) {
      const userBend = maxChordDeviation(userPoints);
      if (userBend < expectedBend * MIN_USER_BEND_FRACTION) {
        return {
          isCorrect: false,
          strokeNumber: expectedStroke.strokeNumber,
          message: 'とちゅうで まがる ところが あるよ！',
        };
      }
    }
  }

  // If start, end, direction, and shape are good -> Correct stroke!
  return {
    isCorrect: true,
    strokeNumber: expectedStroke.strokeNumber,
    message: 'バッチリ！',
  };
}
