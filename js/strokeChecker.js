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

  // If start, end, and direction are good -> Correct stroke!
  return {
    isCorrect: true,
    strokeNumber: expectedStroke.strokeNumber,
    message: 'バッチリ！',
  };
}
